"""
Configuration management for the AI Pipeline
"""
import os
import json
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from pathlib import Path


@dataclass
class CameraConfig:
    """Camera configuration"""
    id: str
    name: str
    rtsp_url: str
    parking_lot_id: str
    zone_id: Optional[str] = None
    slots: List[Dict] = field(default_factory=list)  # Slot detection regions
    enabled: bool = True


@dataclass
class ModelConfig:
    """Model configuration"""
    name: str
    path: str
    device: str = "CPU"  # CPU, GPU, NPU
    precision: str = "FP32"
    confidence_threshold: float = 0.5


@dataclass
class PipelineConfig:
    """Main pipeline configuration"""
    # API endpoint
    api_endpoint: str = "http://localhost:3000/api/realtime/detection"
    api_batch_size: int = 10
    api_interval_ms: int = 1000

    # MQTT (optional)
    mqtt_enabled: bool = False
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_topic_prefix: str = "sparking/detection"

    # Detection settings
    inference_interval: int = 3  # Process every N frames
    confidence_threshold: float = 0.5
    nms_threshold: float = 0.45

    # Tracking settings
    max_track_age: int = 30
    min_track_hits: int = 3
    iou_threshold: float = 0.3

    # Slot occupancy settings
    occupancy_threshold: float = 0.7
    confirmation_frames: int = 5
    hysteresis_frames: int = 3

    # Models
    vehicle_detection_model: str = "yolov8n"  # or path to OpenVINO model
    vehicle_attributes_model: Optional[str] = None
    lpr_detection_model: Optional[str] = None
    lpr_recognition_model: Optional[str] = None

    # Device
    device: str = "CPU"  # CPU, GPU, NPU

    # Cameras
    cameras: List[CameraConfig] = field(default_factory=list)


def load_config(config_path: str = None) -> PipelineConfig:
    """Load configuration from file or environment"""
    config = PipelineConfig()

    # Load from JSON file if provided
    if config_path and Path(config_path).exists():
        with open(config_path, 'r') as f:
            data = json.load(f)
            # Map JSON config to PipelineConfig
            if 'output' in data:
                if 'http' in data['output']:
                    config.api_endpoint = data['output']['http'].get('endpoint', config.api_endpoint)
                    config.api_batch_size = data['output']['http'].get('batch_size', config.api_batch_size)
                if 'mqtt' in data['output']:
                    config.mqtt_enabled = data['output']['mqtt'].get('enabled', False)
                    config.mqtt_host = data['output']['mqtt'].get('host', config.mqtt_host)
                    config.mqtt_port = data['output']['mqtt'].get('port', config.mqtt_port)
            if 'detection' in data:
                config.confidence_threshold = data['detection'].get('confidence_threshold', config.confidence_threshold)
                if 'model' in data['detection']:
                    config.vehicle_detection_model = data['detection']['model'].get('path', config.vehicle_detection_model)
                    config.device = data['detection']['model'].get('device', config.device)
            if 'classification' in data:
                if 'model' in data['classification']:
                    config.vehicle_attributes_model = data['classification']['model'].get('path')
            if 'license_plate_recognition' in data:
                if 'model' in data['license_plate_recognition']:
                    config.lpr_detection_model = data['license_plate_recognition']['model'].get('detection', {}).get('path')
                    config.lpr_recognition_model = data['license_plate_recognition']['model'].get('recognition', {}).get('path')

    # Override with environment variables
    config.api_endpoint = os.getenv('API_ENDPOINT', config.api_endpoint)
    config.device = os.getenv('DEVICE', config.device)
    config.mqtt_host = os.getenv('MQTT_HOST', config.mqtt_host)
    config.mqtt_port = int(os.getenv('MQTT_PORT', str(config.mqtt_port)))

    # Load cameras from environment or default
    camera_urls = os.getenv('CAMERA_URLS', '').split(',')
    camera_ids = os.getenv('CAMERA_IDS', '').split(',')
    parking_lot_id = os.getenv('PARKING_LOT_ID', 'default')

    for i, url in enumerate(camera_urls):
        if url.strip():
            cam_id = camera_ids[i] if i < len(camera_ids) else f"camera_{i}"
            config.cameras.append(CameraConfig(
                id=cam_id,
                name=f"Camera {i+1}",
                rtsp_url=url.strip(),
                parking_lot_id=parking_lot_id
            ))

    return config
