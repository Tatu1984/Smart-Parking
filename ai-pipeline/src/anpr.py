"""
Automatic Number Plate Recognition (ANPR)
License plate detection and OCR using OpenVINO
"""
import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class LicensePlate:
    """License plate detection result"""
    text: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    country_code: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "text": self.text,
            "confidence": self.confidence,
            "bbox": {
                "x": self.bbox[0],
                "y": self.bbox[1],
                "width": self.bbox[2] - self.bbox[0],
                "height": self.bbox[3] - self.bbox[1]
            },
            "countryCode": self.country_code
        }


class LicensePlateDetector:
    """
    Detect license plates in images using YOLO or OpenVINO model
    """

    def __init__(
        self,
        model_path: str = "license-plate-detection.xml",
        device: str = "CPU",
        confidence_threshold: float = 0.5
    ):
        self.confidence_threshold = confidence_threshold
        self.device = device
        self.model = None

        self._load_model(model_path)

    def _load_model(self, model_path: str):
        """Load license plate detection model"""
        try:
            # Try OpenVINO first
            from openvino import Core

            ie = Core()

            if Path(model_path).exists():
                self.model = ie.compile_model(
                    ie.read_model(model_path),
                    self.device.upper()
                )
                logger.info(f"Loaded LP detection model: {model_path}")
            else:
                logger.warning(f"LP detection model not found: {model_path}")
                # Fall back to Ultralytics if available
                try:
                    from ultralytics import YOLO
                    # Use a pre-trained license plate model
                    self.model = YOLO("yolov8n.pt")  # Replace with LP-specific model
                    logger.info("Using YOLO for license plate detection")
                except ImportError:
                    logger.warning("No LP detection model available")

        except ImportError:
            logger.warning("OpenVINO not available for LP detection")

    def detect(
        self,
        frame: np.ndarray,
        vehicle_bbox: Optional[Tuple[int, int, int, int]] = None
    ) -> List[Tuple[int, int, int, int]]:
        """
        Detect license plates in frame

        Args:
            frame: BGR image
            vehicle_bbox: Optional vehicle bounding box to search within

        Returns:
            List of license plate bounding boxes
        """
        if self.model is None:
            return []

        # Crop to vehicle region if provided
        if vehicle_bbox:
            x1, y1, x2, y2 = vehicle_bbox
            roi = frame[y1:y2, x1:x2]
            offset = (x1, y1)
        else:
            roi = frame
            offset = (0, 0)

        plates = []

        # OpenVINO model inference
        if hasattr(self.model, 'input'):
            input_shape = self.model.input(0).shape
            h, w = input_shape[2], input_shape[3]
            resized = cv2.resize(roi, (w, h))
            input_data = resized.transpose(2, 0, 1).astype(np.float32) / 255.0
            input_data = np.expand_dims(input_data, axis=0)

            output = self.model([input_data])[self.model.output(0)]

            # Parse detections
            roi_h, roi_w = roi.shape[:2]
            scale_x, scale_y = roi_w / w, roi_h / h

            for det in output[0]:
                confidence = det[4]
                if confidence > self.confidence_threshold:
                    cx, cy, bw, bh = det[:4]
                    px1 = int((cx - bw/2) * scale_x) + offset[0]
                    py1 = int((cy - bh/2) * scale_y) + offset[1]
                    px2 = int((cx + bw/2) * scale_x) + offset[0]
                    py2 = int((cy + bh/2) * scale_y) + offset[1]
                    plates.append((px1, py1, px2, py2))

        return plates


class LicensePlateRecognizer:
    """
    Recognize text from license plate images using OCR
    """

    # Character set for license plates
    CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

    def __init__(
        self,
        model_path: str = "license-plate-recognition.xml",
        device: str = "CPU"
    ):
        self.device = device
        self.model = None
        self._load_model(model_path)

    def _load_model(self, model_path: str):
        """Load license plate OCR model"""
        try:
            from openvino import Core

            ie = Core()

            if Path(model_path).exists():
                self.model = ie.compile_model(
                    ie.read_model(model_path),
                    self.device.upper()
                )
                logger.info(f"Loaded LP recognition model: {model_path}")
            else:
                logger.warning(f"LP recognition model not found: {model_path}")

        except ImportError:
            logger.warning("OpenVINO not available for LP recognition")

    def recognize(
        self,
        frame: np.ndarray,
        plate_bbox: Tuple[int, int, int, int]
    ) -> Optional[LicensePlate]:
        """
        Recognize text from license plate region

        Args:
            frame: Full BGR image
            plate_bbox: License plate bounding box

        Returns:
            LicensePlate object with recognized text
        """
        x1, y1, x2, y2 = plate_bbox

        # Extract and preprocess plate region
        plate_img = frame[y1:y2, x1:x2]

        if plate_img.size == 0:
            return None

        # If no model, try basic preprocessing + template matching
        if self.model is None:
            text = self._basic_ocr(plate_img)
            if text:
                return LicensePlate(
                    text=text,
                    confidence=0.5,
                    bbox=plate_bbox
                )
            return None

        # OpenVINO model inference
        try:
            input_shape = self.model.input(0).shape
            h, w = input_shape[2], input_shape[3]

            # Preprocess
            gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
            resized = cv2.resize(gray, (w, h))
            input_data = resized.astype(np.float32) / 255.0
            input_data = np.expand_dims(np.expand_dims(input_data, axis=0), axis=0)

            # Inference
            output = self.model([input_data])[self.model.output(0)]

            # Decode output (CTC or similar)
            text, confidence = self._decode_output(output)

            if text:
                return LicensePlate(
                    text=text,
                    confidence=confidence,
                    bbox=plate_bbox,
                    country_code=self._detect_country(text)
                )

        except Exception as e:
            logger.error(f"LP recognition failed: {e}")

        return None

    def _decode_output(self, output: np.ndarray) -> Tuple[str, float]:
        """Decode model output to text"""
        # Assuming CTC-style output
        # Shape: (batch, time, num_classes)
        probs = output[0]
        text = ""
        confidences = []
        prev_char = None

        for t in range(probs.shape[0]):
            char_idx = np.argmax(probs[t])
            char_prob = probs[t][char_idx]

            if char_idx < len(self.CHARS) and char_idx != prev_char:
                text += self.CHARS[char_idx]
                confidences.append(char_prob)

            prev_char = char_idx

        avg_confidence = np.mean(confidences) if confidences else 0.0
        return text, float(avg_confidence)

    def _basic_ocr(self, plate_img: np.ndarray) -> Optional[str]:
        """Basic OCR using contour analysis (fallback)"""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)

            # Enhance contrast
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)

            # Threshold
            _, thresh = cv2.threshold(
                enhanced, 0, 255,
                cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )

            # Find contours
            contours, _ = cv2.findContours(
                thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            # Sort by x-coordinate
            char_contours = sorted(contours, key=lambda c: cv2.boundingRect(c)[0])

            # This is a placeholder - real OCR would use trained models
            # Return None to indicate no text recognized
            return None

        except Exception as e:
            logger.error(f"Basic OCR failed: {e}")
            return None

    def _detect_country(self, plate_text: str) -> Optional[str]:
        """Detect country based on plate format"""
        # Indian plates: XX 00 XX 0000
        if len(plate_text) >= 9:
            if plate_text[:2].isalpha() and plate_text[2:4].isdigit():
                return "IN"

        # US plates vary by state
        # Add more patterns as needed

        return None


class ANPRPipeline:
    """
    Complete ANPR pipeline combining detection and recognition
    """

    def __init__(
        self,
        detection_model: str = "license-plate-detection.xml",
        recognition_model: str = "license-plate-recognition.xml",
        device: str = "CPU",
        detection_threshold: float = 0.5
    ):
        self.detector = LicensePlateDetector(
            model_path=detection_model,
            device=device,
            confidence_threshold=detection_threshold
        )
        self.recognizer = LicensePlateRecognizer(
            model_path=recognition_model,
            device=device
        )

    def process(
        self,
        frame: np.ndarray,
        vehicle_bboxes: Optional[List[Tuple[int, int, int, int]]] = None
    ) -> List[LicensePlate]:
        """
        Process frame for license plate detection and recognition

        Args:
            frame: BGR image
            vehicle_bboxes: Optional list of vehicle bounding boxes

        Returns:
            List of detected and recognized license plates
        """
        results = []

        if vehicle_bboxes:
            # Search within each vehicle region
            for v_bbox in vehicle_bboxes:
                plate_bboxes = self.detector.detect(frame, v_bbox)
                for p_bbox in plate_bboxes:
                    plate = self.recognizer.recognize(frame, p_bbox)
                    if plate:
                        results.append(plate)
        else:
            # Search entire frame
            plate_bboxes = self.detector.detect(frame)
            for p_bbox in plate_bboxes:
                plate = self.recognizer.recognize(frame, p_bbox)
                if plate:
                    results.append(plate)

        return results

    def process_vehicle_crop(
        self,
        vehicle_crop: np.ndarray,
        offset: Tuple[int, int] = (0, 0)
    ) -> Optional[LicensePlate]:
        """
        Process a cropped vehicle image for license plate

        Args:
            vehicle_crop: Cropped vehicle image (BGR)
            offset: (x, y) offset to add to plate coordinates

        Returns:
            LicensePlate if found, None otherwise
        """
        plate_bboxes = self.detector.detect(vehicle_crop)

        if not plate_bboxes:
            return None

        # Take the first (best) detection
        p_bbox = plate_bboxes[0]

        # Adjust for offset
        adjusted_bbox = (
            p_bbox[0] + offset[0],
            p_bbox[1] + offset[1],
            p_bbox[2] + offset[0],
            p_bbox[3] + offset[1]
        )

        return self.recognizer.recognize(vehicle_crop, p_bbox)
