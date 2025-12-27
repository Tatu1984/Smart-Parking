"""
Camera Stream Processor
Handles RTSP stream capture and frame processing
"""
import cv2
import numpy as np
import asyncio
import threading
import queue
from typing import Optional, Callable, Dict, List
from dataclasses import dataclass
import logging
import time

logger = logging.getLogger(__name__)


@dataclass
class FrameData:
    """Frame data with metadata"""
    frame: np.ndarray
    frame_number: int
    timestamp: float
    camera_id: str


class CameraStream:
    """
    Camera stream capture with buffering and reconnection
    """

    def __init__(
        self,
        camera_id: str,
        rtsp_url: str,
        buffer_size: int = 30,
        reconnect_delay: float = 5.0,
        target_fps: Optional[float] = None
    ):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.buffer_size = buffer_size
        self.reconnect_delay = reconnect_delay
        self.target_fps = target_fps

        self._capture: Optional[cv2.VideoCapture] = None
        self._frame_queue: queue.Queue = queue.Queue(maxsize=buffer_size)
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._frame_number = 0
        self._last_frame_time = 0
        self._fps = 0.0

    def start(self):
        """Start the camera stream capture"""
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logger.info(f"Camera {self.camera_id} started: {self.rtsp_url}")

    def stop(self):
        """Stop the camera stream capture"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5.0)
        if self._capture:
            self._capture.release()
        logger.info(f"Camera {self.camera_id} stopped")

    def get_frame(self, timeout: float = 1.0) -> Optional[FrameData]:
        """Get the next frame from the buffer"""
        try:
            return self._frame_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def get_latest_frame(self) -> Optional[FrameData]:
        """Get the most recent frame, discarding older frames"""
        latest = None
        while True:
            try:
                latest = self._frame_queue.get_nowait()
            except queue.Empty:
                break
        return latest

    @property
    def fps(self) -> float:
        """Current capture FPS"""
        return self._fps

    @property
    def is_connected(self) -> bool:
        """Check if camera is connected"""
        return self._capture is not None and self._capture.isOpened()

    def _capture_loop(self):
        """Main capture loop running in background thread"""
        while self._running:
            # Connect if not connected
            if not self.is_connected:
                if not self._connect():
                    time.sleep(self.reconnect_delay)
                    continue

            # Read frame
            ret, frame = self._capture.read()

            if not ret:
                logger.warning(f"Camera {self.camera_id}: Frame read failed, reconnecting...")
                self._capture.release()
                self._capture = None
                continue

            # FPS limiting
            current_time = time.time()
            if self.target_fps:
                min_interval = 1.0 / self.target_fps
                if current_time - self._last_frame_time < min_interval:
                    continue

            # Calculate actual FPS
            if self._last_frame_time > 0:
                self._fps = 1.0 / (current_time - self._last_frame_time)
            self._last_frame_time = current_time
            self._frame_number += 1

            # Add to queue
            frame_data = FrameData(
                frame=frame,
                frame_number=self._frame_number,
                timestamp=current_time,
                camera_id=self.camera_id
            )

            try:
                self._frame_queue.put_nowait(frame_data)
            except queue.Full:
                # Drop oldest frame
                try:
                    self._frame_queue.get_nowait()
                    self._frame_queue.put_nowait(frame_data)
                except queue.Empty:
                    pass

    def _connect(self) -> bool:
        """Connect to the RTSP stream"""
        try:
            # Use FFMPEG backend with optimized settings
            self._capture = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)

            # Set buffer size to reduce latency
            self._capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            # Set timeout (if supported)
            self._capture.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
            self._capture.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)

            if self._capture.isOpened():
                # Get stream properties
                width = int(self._capture.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(self._capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = self._capture.get(cv2.CAP_PROP_FPS)
                logger.info(f"Camera {self.camera_id}: Connected - {width}x{height} @ {fps:.1f} FPS")
                return True
            else:
                logger.error(f"Camera {self.camera_id}: Failed to connect")
                return False

        except Exception as e:
            logger.error(f"Camera {self.camera_id}: Connection error - {e}")
            return False


class CameraManager:
    """
    Manages multiple camera streams
    """

    def __init__(self):
        self._cameras: Dict[str, CameraStream] = {}
        self._running = False

    def add_camera(
        self,
        camera_id: str,
        rtsp_url: str,
        **kwargs
    ) -> CameraStream:
        """Add a camera stream"""
        camera = CameraStream(camera_id, rtsp_url, **kwargs)
        self._cameras[camera_id] = camera
        if self._running:
            camera.start()
        return camera

    def remove_camera(self, camera_id: str):
        """Remove a camera stream"""
        if camera_id in self._cameras:
            self._cameras[camera_id].stop()
            del self._cameras[camera_id]

    def get_camera(self, camera_id: str) -> Optional[CameraStream]:
        """Get a camera stream by ID"""
        return self._cameras.get(camera_id)

    def start_all(self):
        """Start all camera streams"""
        self._running = True
        for camera in self._cameras.values():
            camera.start()

    def stop_all(self):
        """Stop all camera streams"""
        self._running = False
        for camera in self._cameras.values():
            camera.stop()

    def get_status(self) -> Dict[str, Dict]:
        """Get status of all cameras"""
        return {
            camera_id: {
                "connected": camera.is_connected,
                "fps": camera.fps,
                "frameNumber": camera._frame_number
            }
            for camera_id, camera in self._cameras.items()
        }

    @property
    def cameras(self) -> List[CameraStream]:
        """List of all cameras"""
        return list(self._cameras.values())


class FrameProcessor:
    """
    Processes frames from multiple cameras
    """

    def __init__(
        self,
        camera_manager: CameraManager,
        process_interval: int = 3  # Process every N frames
    ):
        self.camera_manager = camera_manager
        self.process_interval = process_interval
        self._running = False
        self._process_callbacks: List[Callable] = []

    def add_callback(self, callback: Callable[[FrameData], None]):
        """Add a frame processing callback"""
        self._process_callbacks.append(callback)

    async def run(self):
        """Run the frame processor"""
        self._running = True
        logger.info("Frame processor started")

        while self._running:
            for camera in self.camera_manager.cameras:
                frame_data = camera.get_latest_frame()

                if frame_data is None:
                    continue

                # Skip frames based on interval
                if frame_data.frame_number % self.process_interval != 0:
                    continue

                # Call all processing callbacks
                for callback in self._process_callbacks:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(frame_data)
                        else:
                            callback(frame_data)
                    except Exception as e:
                        logger.error(f"Frame processing error: {e}")

            # Small delay to prevent busy loop
            await asyncio.sleep(0.01)

    def stop(self):
        """Stop the frame processor"""
        self._running = False


class MockCameraStream:
    """
    Mock camera stream for testing without real cameras
    Generates synthetic frames with random vehicle placements
    """

    def __init__(
        self,
        camera_id: str,
        width: int = 1280,
        height: int = 720,
        fps: float = 30.0
    ):
        self.camera_id = camera_id
        self.width = width
        self.height = height
        self.target_fps = fps

        self._running = False
        self._frame_number = 0
        self._frame_queue: queue.Queue = queue.Queue(maxsize=30)
        self._thread: Optional[threading.Thread] = None

    def start(self):
        """Start generating mock frames"""
        self._running = True
        self._thread = threading.Thread(target=self._generate_loop, daemon=True)
        self._thread.start()
        logger.info(f"Mock camera {self.camera_id} started")

    def stop(self):
        """Stop generating mock frames"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)

    def get_frame(self, timeout: float = 1.0) -> Optional[FrameData]:
        """Get the next frame"""
        try:
            return self._frame_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def get_latest_frame(self) -> Optional[FrameData]:
        """Get the most recent frame"""
        latest = None
        while True:
            try:
                latest = self._frame_queue.get_nowait()
            except queue.Empty:
                break
        return latest

    @property
    def fps(self) -> float:
        return self.target_fps

    @property
    def is_connected(self) -> bool:
        return self._running

    def _generate_loop(self):
        """Generate synthetic frames"""
        interval = 1.0 / self.target_fps

        while self._running:
            # Create a simple parking lot image
            frame = self._create_parking_lot_frame()

            self._frame_number += 1
            frame_data = FrameData(
                frame=frame,
                frame_number=self._frame_number,
                timestamp=time.time(),
                camera_id=self.camera_id
            )

            try:
                self._frame_queue.put_nowait(frame_data)
            except queue.Full:
                try:
                    self._frame_queue.get_nowait()
                    self._frame_queue.put_nowait(frame_data)
                except queue.Empty:
                    pass

            time.sleep(interval)

    def _create_parking_lot_frame(self) -> np.ndarray:
        """Create a synthetic parking lot frame"""
        # Create base frame (asphalt gray)
        frame = np.full((self.height, self.width, 3), (80, 80, 80), dtype=np.uint8)

        # Draw parking slots
        slot_width = 120
        slot_height = 200
        num_slots = 8
        start_x = 100
        start_y = 100

        for i in range(num_slots):
            x = start_x + i * (slot_width + 20)
            y = start_y

            # Draw slot outline (white lines)
            cv2.rectangle(frame, (x, y), (x + slot_width, y + slot_height),
                         (255, 255, 255), 2)

            # Randomly occupy some slots
            if np.random.random() > 0.5:
                # Draw a "car" (colored rectangle)
                car_color = tuple(map(int, np.random.randint(100, 255, 3)))
                cv2.rectangle(
                    frame,
                    (x + 10, y + 20),
                    (x + slot_width - 10, y + slot_height - 20),
                    car_color, -1
                )

        return frame
