"""
Main AI Pipeline Runner
Orchestrates camera capture, detection, and event publishing
Optimized for <100ms latency
"""
import asyncio
import signal
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional
import aiohttp

from .config import load_config, PipelineConfig, CameraConfig
from .camera import CameraManager, CameraStream, FrameData, MockCameraStream
from .detector import VehicleDetector, SlotOccupancyDetector, SimpleTracker, Detection, VehicleAttributesClassifier
from .anpr import ANPRPipeline, LicensePlate
from .publisher import EventPublisher, DetectionEvent
from .optimization import (
    LatencyMetrics, FrameSkipper, BatchProcessor,
    AsyncInferenceQueue, ROIOptimizer, ModelWarmup,
    LatencyProfiler, get_optimal_config
)

logger = logging.getLogger(__name__)


class ParkingPipeline:
    """
    Main parking detection pipeline
    Optimized for <100ms end-to-end latency
    """

    def __init__(self, config: PipelineConfig):
        self.config = config

        # Get optimal hardware config
        hw_config = get_optimal_config(config.device)
        logger.info(f"Using hardware config: {hw_config}")

        # Initialize components
        self.camera_manager = CameraManager()
        self.vehicle_detector = VehicleDetector(
            model_path=config.vehicle_detection_model,
            device=hw_config['device'],
            confidence_threshold=config.confidence_threshold
        )
        self.slot_detector = SlotOccupancyDetector(
            iou_threshold=config.iou_threshold,
            confirmation_frames=config.confirmation_frames,
            hysteresis_frames=config.hysteresis_frames
        )
        self.tracker = SimpleTracker(
            max_age=config.max_track_age,
            min_hits=config.min_track_hits,
            iou_threshold=config.iou_threshold
        )
        self.anpr = ANPRPipeline(
            detection_model=config.lpr_detection_model or "license-plate-detection.xml",
            recognition_model=config.lpr_recognition_model or "license-plate-recognition.xml",
            device=hw_config['device']
        )
        self.attributes_classifier = VehicleAttributesClassifier(
            model_path=config.vehicle_attributes_model or "/opt/intel/openvino/models/vehicle-attributes-recognition-barrier-0039.xml",
            device=hw_config['device']
        )
        self.publisher = EventPublisher(
            api_endpoint=config.api_endpoint,
            batch_size=config.api_batch_size,
            flush_interval=config.api_interval_ms / 1000.0,
            mqtt_enabled=config.mqtt_enabled,
            mqtt_host=config.mqtt_host,
            mqtt_port=config.mqtt_port,
            mqtt_topic_prefix=config.mqtt_topic_prefix
        )

        # Optimization components
        self.latency_metrics = LatencyMetrics()
        self.frame_skipper = FrameSkipper(
            target_latency_ms=100,
            min_interval=1,
            max_interval=config.inference_interval
        )
        self.roi_optimizer = ROIOptimizer()
        self.profiler = LatencyProfiler()
        self.async_queue = AsyncInferenceQueue(
            max_queue_size=10,
            num_workers=hw_config.get('inference_threads', 2)
        )

        # Camera slot configurations
        self._camera_slots: Dict[str, List[Dict]] = {}

        # Running state
        self._running = False
        self._warmup_done = False

    async def start(self):
        """Start the pipeline"""
        logger.info("Starting parking detection pipeline...")

        # Start publisher
        await self.publisher.start()

        # Fetch slot configurations from API
        await self._fetch_slot_configs()

        # Model warmup for consistent latency
        if not self._warmup_done:
            logger.info("Warming up models...")
            ModelWarmup.warmup_detector(self.vehicle_detector)
            self._warmup_done = True

        # Start cameras
        for camera_config in self.config.cameras:
            if camera_config.enabled:
                self._add_camera(camera_config)

        self.camera_manager.start_all()
        self._running = True

        logger.info(f"Pipeline started with {len(self.config.cameras)} cameras")

    async def stop(self):
        """Stop the pipeline"""
        logger.info("Stopping parking detection pipeline...")
        self._running = False
        self.camera_manager.stop_all()
        self.async_queue.shutdown()
        await self.publisher.stop()

        # Log final latency stats
        stats = self.latency_metrics.get_stats()
        logger.info(f"Final latency stats: {stats}")
        logger.info("Pipeline stopped")

    def _add_camera(self, camera_config: CameraConfig):
        """Add a camera to the pipeline"""
        self.camera_manager.add_camera(
            camera_id=camera_config.id,
            rtsp_url=camera_config.rtsp_url,
            target_fps=10.0  # Limit capture rate
        )

        # Store slot configuration
        self._camera_slots[camera_config.id] = camera_config.slots

    async def run(self):
        """Main processing loop - optimized for <100ms latency"""
        frame_count = 0

        while self._running:
            for camera in self.camera_manager.cameras:
                frame_data = camera.get_latest_frame()

                if frame_data is None:
                    continue

                # Adaptive frame skipping based on measured latency
                if not self.frame_skipper.should_process(frame_data.frame_number):
                    continue

                frame_count += 1

                try:
                    start_time = time.time()
                    await self._process_frame(frame_data)
                    latency_ms = (time.time() - start_time) * 1000

                    # Update adaptive frame skipper
                    self.frame_skipper.update(latency_ms)
                    self.latency_metrics.record('total', latency_ms)

                    # Log if exceeding target latency
                    if latency_ms > 100:
                        logger.warning(f"Frame {frame_data.frame_number} exceeded latency target: {latency_ms:.1f}ms")

                except Exception as e:
                    logger.error(f"Frame processing error: {e}")

            # Prevent busy loop
            await asyncio.sleep(0.005)  # Reduced from 0.01 for faster response

    async def _process_frame(self, frame_data: FrameData):
        """Process a single frame - optimized pipeline"""
        self.profiler.start()

        camera_id = frame_data.camera_id
        frame = frame_data.frame

        # Vehicle detection (primary bottleneck)
        det_start = time.time()
        detections = self.vehicle_detector.detect(frame)
        self.latency_metrics.record('detection', (time.time() - det_start) * 1000)
        self.profiler.checkpoint('detection')

        # Vehicle attributes classification (color, type) - run only if detections exist
        if detections and self.attributes_classifier.is_available():
            detections = self.attributes_classifier.classify(frame, detections)
            self.profiler.checkpoint('classification')

        # Object tracking (fast)
        track_start = time.time()
        detections = self.tracker.update(detections)
        self.latency_metrics.record('tracking', (time.time() - track_start) * 1000)
        self.profiler.checkpoint('tracking')

        # Slot occupancy update
        slots = self._camera_slots.get(camera_id, [])
        slot_updates = self.slot_detector.update(detections, slots)
        self.profiler.checkpoint('slot_update')

        # ANPR for detected vehicles - only for vehicles near entry/exit
        license_plates: List[LicensePlate] = []
        anpr_start = time.time()
        # Limit ANPR to first 3 detections to stay within latency budget
        for det in detections[:3]:
            plates = self.anpr.process(frame, [det.bbox])
            license_plates.extend(plates)
        self.latency_metrics.record('anpr', (time.time() - anpr_start) * 1000)
        self.profiler.checkpoint('anpr')

        # Publish detection event
        event = DetectionEvent(
            camera_id=camera_id,
            parking_lot_id=self._get_parking_lot_id(camera_id),
            timestamp=datetime.utcnow().isoformat() + "Z",
            detections=[d.to_dict() for d in detections],
            slot_updates=slot_updates,
            frame_number=frame_data.frame_number,
            zone_id=self._get_zone_id(camera_id)
        )
        await self.publisher.publish(event)

        # Publish individual slot updates for real-time display
        for update in slot_updates:
            # Find matching license plate
            plate_text = None
            for plate in license_plates:
                plate_text = plate.text
                break

            await self.publisher.publish_slot_update(
                camera_id=camera_id,
                parking_lot_id=self._get_parking_lot_id(camera_id),
                slot_id=update["slotId"],
                is_occupied=update["isOccupied"],
                confidence=update.get("confidence", 0.0),
                vehicle_type=update.get("vehicleType"),
                license_plate=plate_text
            )

        logger.debug(
            f"Camera {camera_id}: {len(detections)} vehicles, "
            f"{len(slot_updates)} slot updates"
        )

    def _get_parking_lot_id(self, camera_id: str) -> str:
        """Get parking lot ID for camera"""
        for cam in self.config.cameras:
            if cam.id == camera_id:
                return cam.parking_lot_id
        return "unknown"

    def _get_zone_id(self, camera_id: str) -> Optional[str]:
        """Get zone ID for camera"""
        for cam in self.config.cameras:
            if cam.id == camera_id:
                return cam.zone_id
        return None

    async def _fetch_slot_configs(self):
        """Fetch slot configurations from API"""
        try:
            async with aiohttp.ClientSession() as session:
                for camera_config in self.config.cameras:
                    # Get slots for this camera's parking lot/zone
                    url = f"{self.config.api_endpoint.rsplit('/', 2)[0]}/slots"
                    params = {"parkingLotId": camera_config.parking_lot_id}

                    if camera_config.zone_id:
                        params["zoneId"] = camera_config.zone_id

                    async with session.get(url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            slots = data.get("slots", [])
                            self._camera_slots[camera_config.id] = slots
                            logger.info(
                                f"Loaded {len(slots)} slots for camera {camera_config.id}"
                            )
                        else:
                            logger.warning(
                                f"Failed to fetch slots for camera {camera_config.id}"
                            )

        except Exception as e:
            logger.error(f"Failed to fetch slot configs: {e}")


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Smart Parking AI Pipeline")
    parser.add_argument(
        "--config", "-c",
        help="Path to configuration file",
        default="config.json"
    )
    parser.add_argument(
        "--mock", "-m",
        help="Use mock cameras for testing",
        action="store_true"
    )
    parser.add_argument(
        "--log-level", "-l",
        help="Logging level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"]
    )
    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Load configuration
    config = load_config(args.config)

    # Create pipeline
    pipeline = ParkingPipeline(config)

    # Handle shutdown signals
    loop = asyncio.get_event_loop()

    def signal_handler():
        logger.info("Shutdown signal received")
        asyncio.create_task(pipeline.stop())

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    try:
        await pipeline.start()

        # Add mock cameras if requested
        if args.mock:
            from .camera import MockCameraStream
            mock_cam = MockCameraStream("mock-cam-1", width=1280, height=720)
            mock_cam.start()
            pipeline.camera_manager._cameras["mock-cam-1"] = mock_cam

        await pipeline.run()

    except KeyboardInterrupt:
        logger.info("Keyboard interrupt")
    finally:
        await pipeline.stop()


if __name__ == "__main__":
    asyncio.run(main())
