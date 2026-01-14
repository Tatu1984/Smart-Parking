"""
Vehicle and Parking Slot Detection using YOLO + OpenVINO
"""
import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    """Detection result"""
    class_id: int
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    track_id: Optional[int] = None
    attributes: Dict = None

    def to_dict(self) -> Dict:
        return {
            "classId": self.class_id,
            "className": self.class_name,
            "confidence": self.confidence,
            "bbox": {
                "x": self.bbox[0],
                "y": self.bbox[1],
                "width": self.bbox[2] - self.bbox[0],
                "height": self.bbox[3] - self.bbox[1]
            },
            "trackId": self.track_id,
            "attributes": self.attributes or {}
        }


class VehicleDetector:
    """
    Vehicle detection using YOLO (Ultralytics) with optional OpenVINO backend
    """

    VEHICLE_CLASSES = {
        2: "car",
        3: "motorcycle",
        5: "bus",
        7: "truck"
    }

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        device: str = "cpu",
        confidence_threshold: float = 0.5,
        use_openvino: bool = False
    ):
        self.confidence_threshold = confidence_threshold
        self.device = device.lower()
        self.use_openvino = use_openvino
        self.model = None
        self.ov_model = None

        self._load_model(model_path)

    def _load_model(self, model_path: str):
        """Load YOLO model with optional OpenVINO optimization"""
        try:
            from ultralytics import YOLO

            # Check if it's an OpenVINO model
            if model_path.endswith('.xml') or self.use_openvino:
                self._load_openvino_model(model_path)
            else:
                # Load standard YOLO model
                self.model = YOLO(model_path)

                # Export to OpenVINO format for better performance
                if self.use_openvino:
                    logger.info("Exporting model to OpenVINO format...")
                    ov_path = self.model.export(format="openvino")
                    self._load_openvino_model(ov_path)
                else:
                    logger.info(f"Loaded YOLO model: {model_path}")

        except ImportError:
            logger.warning("Ultralytics not installed, using OpenVINO directly")
            self._load_openvino_model(model_path)

    def _load_openvino_model(self, model_path: str):
        """Load model using OpenVINO runtime"""
        try:
            from openvino import Core

            ie = Core()

            # Find the XML file
            if Path(model_path).is_dir():
                xml_files = list(Path(model_path).glob("*.xml"))
                if xml_files:
                    model_path = str(xml_files[0])

            logger.info(f"Loading OpenVINO model: {model_path}")
            model = ie.read_model(model_path)

            # Compile for target device
            device = self.device.upper()
            if device == "GPU" and "GPU" not in ie.available_devices:
                logger.warning("GPU not available, falling back to CPU")
                device = "CPU"

            self.ov_model = ie.compile_model(model, device)
            logger.info(f"OpenVINO model compiled for {device}")

        except Exception as e:
            logger.error(f"Failed to load OpenVINO model: {e}")
            raise

    def detect(self, frame: np.ndarray) -> List[Detection]:
        """
        Detect vehicles in frame

        Args:
            frame: BGR image (numpy array)

        Returns:
            List of Detection objects
        """
        detections = []

        if self.model is not None:
            # Use Ultralytics YOLO
            results = self.model(frame, verbose=False, conf=self.confidence_threshold)

            for result in results:
                boxes = result.boxes
                for box in boxes:
                    class_id = int(box.cls[0])
                    # Filter for vehicle classes only
                    if class_id in self.VEHICLE_CLASSES:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        detections.append(Detection(
                            class_id=class_id,
                            class_name=self.VEHICLE_CLASSES[class_id],
                            confidence=float(box.conf[0]),
                            bbox=(x1, y1, x2, y2)
                        ))

        elif self.ov_model is not None:
            # Use OpenVINO directly
            detections = self._detect_openvino(frame)

        return detections

    def _detect_openvino(self, frame: np.ndarray) -> List[Detection]:
        """Run detection using OpenVINO model"""
        detections = []

        # Preprocess
        input_shape = self.ov_model.input(0).shape
        h, w = input_shape[2], input_shape[3]
        resized = cv2.resize(frame, (w, h))
        input_data = resized.transpose(2, 0, 1).astype(np.float32) / 255.0
        input_data = np.expand_dims(input_data, axis=0)

        # Inference
        output = self.ov_model([input_data])[self.ov_model.output(0)]

        # Post-process YOLO output
        frame_h, frame_w = frame.shape[:2]
        scale_x, scale_y = frame_w / w, frame_h / h

        # Parse detections (YOLO format)
        for detection in output[0]:
            scores = detection[4:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]

            if confidence > self.confidence_threshold and class_id in self.VEHICLE_CLASSES:
                cx, cy, bw, bh = detection[:4]
                x1 = int((cx - bw/2) * scale_x)
                y1 = int((cy - bh/2) * scale_y)
                x2 = int((cx + bw/2) * scale_x)
                y2 = int((cy + bh/2) * scale_y)

                detections.append(Detection(
                    class_id=int(class_id),
                    class_name=self.VEHICLE_CLASSES.get(int(class_id), "vehicle"),
                    confidence=float(confidence),
                    bbox=(x1, y1, x2, y2)
                ))

        return detections


class SlotOccupancyDetector:
    """
    Detect parking slot occupancy based on vehicle detections and slot regions
    """

    def __init__(
        self,
        iou_threshold: float = 0.3,
        confirmation_frames: int = 5,
        hysteresis_frames: int = 3
    ):
        self.iou_threshold = iou_threshold
        self.confirmation_frames = confirmation_frames
        self.hysteresis_frames = hysteresis_frames

        # Track occupancy state per slot
        self.slot_states: Dict[str, Dict] = {}

    def update(
        self,
        detections: List[Detection],
        slots: List[Dict]
    ) -> List[Dict]:
        """
        Update slot occupancy based on detections

        Args:
            detections: List of vehicle detections
            slots: List of slot definitions with bounding boxes
                   [{"id": "slot-1", "bbox": {"x": 0, "y": 0, "width": 100, "height": 200}}]

        Returns:
            List of slot status updates
        """
        updates = []

        for slot in slots:
            slot_id = slot["id"]
            slot_bbox = slot.get("bbox") or slot.get("detectionBounds")

            if not slot_bbox:
                continue

            # Convert slot bbox to (x1, y1, x2, y2)
            sx1 = int(slot_bbox.get("x", 0))
            sy1 = int(slot_bbox.get("y", 0))
            sx2 = sx1 + int(slot_bbox.get("width", 0))
            sy2 = sy1 + int(slot_bbox.get("height", 0))

            # Check overlap with any vehicle
            is_occupied = False
            best_confidence = 0.0
            matching_vehicle = None

            for det in detections:
                iou = self._calculate_iou(
                    (sx1, sy1, sx2, sy2),
                    det.bbox
                )

                if iou >= self.iou_threshold:
                    is_occupied = True
                    if det.confidence > best_confidence:
                        best_confidence = det.confidence
                        matching_vehicle = det

            # Update state with hysteresis
            if slot_id not in self.slot_states:
                self.slot_states[slot_id] = {
                    "occupied": False,
                    "counter": 0,
                    "confidence": 0.0
                }

            state = self.slot_states[slot_id]
            current_occupied = state["occupied"]

            if is_occupied:
                if not current_occupied:
                    state["counter"] += 1
                    if state["counter"] >= self.confirmation_frames:
                        state["occupied"] = True
                        state["counter"] = 0
                        updates.append({
                            "slotId": slot_id,
                            "isOccupied": True,
                            "confidence": best_confidence,
                            "vehicleType": matching_vehicle.class_name if matching_vehicle else None
                        })
                else:
                    state["counter"] = 0
                state["confidence"] = best_confidence
            else:
                if current_occupied:
                    state["counter"] += 1
                    if state["counter"] >= self.hysteresis_frames:
                        state["occupied"] = False
                        state["counter"] = 0
                        updates.append({
                            "slotId": slot_id,
                            "isOccupied": False,
                            "confidence": 0.0
                        })
                else:
                    state["counter"] = 0

        return updates

    def _calculate_iou(
        self,
        box1: Tuple[int, int, int, int],
        box2: Tuple[int, int, int, int]
    ) -> float:
        """Calculate Intersection over Union"""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])

        intersection = max(0, x2 - x1) * max(0, y2 - y1)

        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0


class VehicleAttributesClassifier:
    """
    Vehicle attributes classification using Intel OpenVINO
    Extracts vehicle type and color from detected vehicle crops
    """

    # Vehicle type labels from vehicle-attributes-recognition-barrier-0039
    VEHICLE_TYPES = ["car", "bus", "truck", "van"]

    # Vehicle color labels
    VEHICLE_COLORS = [
        "white", "gray", "yellow", "red", "green",
        "blue", "black", "silver", "orange", "brown", "pink"
    ]

    def __init__(
        self,
        model_path: str = "/opt/intel/openvino/models/vehicle-attributes-recognition-barrier-0039.xml",
        device: str = "CPU"
    ):
        self.model_path = model_path
        self.device = device.upper()
        self.model = None
        self.input_shape = (72, 72)  # Model input size

        self._load_model()

    def _load_model(self):
        """Load the vehicle attributes model using OpenVINO"""
        try:
            from openvino import Core

            ie = Core()

            if not Path(self.model_path).exists():
                logger.warning(f"Vehicle attributes model not found at {self.model_path}")
                logger.info("Vehicle attributes classification will be disabled")
                return

            logger.info(f"Loading vehicle attributes model: {self.model_path}")
            model = ie.read_model(self.model_path)

            # Check device availability
            device = self.device
            if device == "GPU" and "GPU" not in ie.available_devices:
                logger.warning("GPU not available for attributes model, using CPU")
                device = "CPU"

            self.model = ie.compile_model(model, device)
            logger.info(f"Vehicle attributes model loaded on {device}")

        except ImportError:
            logger.error("OpenVINO not installed, vehicle attributes disabled")
        except Exception as e:
            logger.error(f"Failed to load vehicle attributes model: {e}")

    def classify(self, frame: np.ndarray, detections: List[Detection]) -> List[Detection]:
        """
        Classify vehicle attributes for each detection

        Args:
            frame: Original BGR image
            detections: List of vehicle detections with bounding boxes

        Returns:
            Updated detections with attributes
        """
        if self.model is None:
            return detections

        for detection in detections:
            try:
                # Extract vehicle crop
                x1, y1, x2, y2 = detection.bbox

                # Ensure bbox is within frame bounds
                h, w = frame.shape[:2]
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(w, x2)
                y2 = min(h, y2)

                if x2 <= x1 or y2 <= y1:
                    continue

                crop = frame[y1:y2, x1:x2]

                if crop.size == 0:
                    continue

                # Preprocess for model
                resized = cv2.resize(crop, self.input_shape)
                # Model expects BGR input, normalized
                input_data = resized.transpose(2, 0, 1).astype(np.float32)
                input_data = np.expand_dims(input_data, axis=0)

                # Run inference
                results = self.model([input_data])

                # Parse outputs
                # Model has two outputs: color (index 0) and type (index 1)
                color_output = results[self.model.output(0)][0]
                type_output = results[self.model.output(1)][0]

                # Get predictions
                color_idx = np.argmax(color_output)
                type_idx = np.argmax(type_output)

                color_conf = float(color_output[color_idx])
                type_conf = float(type_output[type_idx])

                # Extract attribute values
                color = self.VEHICLE_COLORS[color_idx] if color_idx < len(self.VEHICLE_COLORS) else "unknown"
                vehicle_type = self.VEHICLE_TYPES[type_idx] if type_idx < len(self.VEHICLE_TYPES) else "unknown"

                # Update detection attributes
                detection.attributes = {
                    "color": color,
                    "colorConfidence": color_conf,
                    "type": vehicle_type,
                    "typeConfidence": type_conf
                }

            except Exception as e:
                logger.debug(f"Failed to classify vehicle attributes: {e}")
                continue

        return detections

    def is_available(self) -> bool:
        """Check if the classifier is ready"""
        return self.model is not None


class SimpleTracker:
    """
    Simple object tracker using IoU matching
    """

    def __init__(self, max_age: int = 30, min_hits: int = 3, iou_threshold: float = 0.3):
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.tracks: Dict[int, Dict] = {}
        self.next_id = 1

    def update(self, detections: List[Detection]) -> List[Detection]:
        """Update tracks with new detections"""
        # Match detections to existing tracks
        matched, unmatched_dets, unmatched_tracks = self._match(detections)

        # Update matched tracks
        for det_idx, track_id in matched:
            det = detections[det_idx]
            det.track_id = track_id
            self.tracks[track_id]["bbox"] = det.bbox
            self.tracks[track_id]["hits"] += 1
            self.tracks[track_id]["age"] = 0

        # Create new tracks for unmatched detections
        for det_idx in unmatched_dets:
            det = detections[det_idx]
            det.track_id = self.next_id
            self.tracks[self.next_id] = {
                "bbox": det.bbox,
                "hits": 1,
                "age": 0
            }
            self.next_id += 1

        # Age unmatched tracks
        for track_id in unmatched_tracks:
            self.tracks[track_id]["age"] += 1

        # Remove old tracks
        self.tracks = {
            k: v for k, v in self.tracks.items()
            if v["age"] < self.max_age
        }

        return detections

    def _match(self, detections: List[Detection]):
        """Match detections to tracks using IoU"""
        matched = []
        unmatched_dets = list(range(len(detections)))
        unmatched_tracks = list(self.tracks.keys())

        if not detections or not self.tracks:
            return matched, unmatched_dets, unmatched_tracks

        # Calculate IoU matrix
        for det_idx, det in enumerate(detections):
            best_iou = 0
            best_track = None

            for track_id, track in self.tracks.items():
                if track_id in unmatched_tracks:
                    iou = self._calculate_iou(det.bbox, track["bbox"])
                    if iou > best_iou and iou >= self.iou_threshold:
                        best_iou = iou
                        best_track = track_id

            if best_track is not None:
                matched.append((det_idx, best_track))
                unmatched_dets.remove(det_idx)
                unmatched_tracks.remove(best_track)

        return matched, unmatched_dets, unmatched_tracks

    def _calculate_iou(self, box1, box2):
        """Calculate IoU between two boxes"""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])

        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0
