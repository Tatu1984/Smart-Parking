#!/usr/bin/env python3
"""
Metro AI Suite to SParking MQTT Translator

Subscribes to Metro AI Suite object detection MQTT topics and translates
detection messages to SParking format, forwarding them to the SParking API.
"""

import json
import logging
import os
import re
import sys
import time
from typing import Any

import paho.mqtt.client as mqtt
import requests
import yaml


# Load configuration
def load_config() -> dict:
    """Load configuration from YAML file with environment variable substitution."""
    config_path = os.getenv("CONFIG_PATH", "config.yaml")

    with open(config_path, "r") as f:
        content = f.read()

    # Substitute environment variables
    pattern = re.compile(r'\$\{(\w+)(?::-([^}]*))?\}')

    def replace_env(match):
        var_name = match.group(1)
        default_value = match.group(2) or ""
        return os.getenv(var_name, default_value)

    content = pattern.sub(replace_env, content)
    return yaml.safe_load(content)


# Initialize logging
def setup_logging(config: dict) -> logging.Logger:
    """Set up logging based on configuration."""
    log_config = config.get("logging", {})
    level = getattr(logging, log_config.get("level", "INFO").upper())
    format_str = log_config.get("format", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")

    logging.basicConfig(level=level, format=format_str, stream=sys.stdout)
    return logging.getLogger("metro-translator")


class MetroTranslator:
    """Translates Metro AI Suite detection messages to SParking format."""

    def __init__(self, config: dict, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.mqtt_client = None
        self.session = requests.Session()

        # Load camera mappings
        self.camera_mappings = self._load_camera_mappings()

        # Detection settings
        detection_config = config.get("detection", {})
        self.min_confidence = detection_config.get("min_confidence", 0.5)
        self.tracked_labels = set(detection_config.get("tracked_labels", ["car"]))
        self.label_mapping = detection_config.get("label_mapping", {})

        # API settings
        api_config = config.get("api", {})
        self.api_endpoint = api_config.get("endpoint")
        self.api_key = api_config.get("api_key")
        self.api_timeout = api_config.get("timeout", 10)
        self.retry_attempts = api_config.get("retry_attempts", 3)
        self.retry_delay = api_config.get("retry_delay", 1)

        # Set up session headers
        if self.api_key:
            self.session.headers["x-api-key"] = self.api_key
        self.session.headers["Content-Type"] = "application/json"

    def _load_camera_mappings(self) -> dict:
        """Load camera mappings from config or environment."""
        # Try environment variable first (JSON format)
        env_mapping = os.getenv("CAMERA_MAPPING")
        if env_mapping:
            try:
                return json.loads(env_mapping)
            except json.JSONDecodeError:
                self.logger.warning("Invalid CAMERA_MAPPING JSON, using config file")

        # Fall back to config file
        return self.config.get("topic_mappings", {})

    def _get_camera_id(self, topic: str) -> str | None:
        """Extract camera ID from MQTT topic."""
        # Extract suffix from topic (e.g., "object_detection_1" -> "1")
        prefix = self.config.get("metro", {}).get("topic_prefix", "object_detection")
        if topic.startswith(prefix + "_"):
            suffix = topic[len(prefix) + 1:]
            return self.camera_mappings.get(suffix, suffix)
        return None

    def translate_message(self, topic: str, payload: dict) -> list[dict]:
        """
        Translate Metro AI Suite detection message to SParking format.

        Metro Format:
        {
            "metadata": {
                "objects": [{
                    "detection": {
                        "bounding_box": {"x_min": 0.1, "y_min": 0.2, "x_max": 0.3, "y_max": 0.4},
                        "confidence": 0.95,
                        "label": "car"
                    }
                }]
            }
        }

        SParking Format:
        {
            "cameraId": "camera-uuid",
            "eventType": "VEHICLE_DETECTED",
            "confidence": 0.95,
            "bbox": {"x": 0.1, "y": 0.2, "width": 0.2, "height": 0.2}
        }
        """
        camera_id = self._get_camera_id(topic)
        if not camera_id:
            self.logger.warning(f"No camera mapping for topic: {topic}")
            return []

        events = []

        # Extract objects from Metro format
        metadata = payload.get("metadata", {})
        objects = metadata.get("objects", [])

        for obj in objects:
            detection = obj.get("detection", {})
            label = detection.get("label", "").lower()
            confidence = detection.get("confidence", 0)

            # Filter by label and confidence
            if label not in self.tracked_labels:
                continue
            if confidence < self.min_confidence:
                continue

            # Extract bounding box
            bbox = detection.get("bounding_box", {})
            x_min = bbox.get("x_min", 0)
            y_min = bbox.get("y_min", 0)
            x_max = bbox.get("x_max", 0)
            y_max = bbox.get("y_max", 0)

            # Convert to SParking format (x, y, width, height)
            sparking_event = {
                "cameraId": camera_id,
                "eventType": "VEHICLE_DETECTED",
                "confidence": confidence,
                "bbox": {
                    "x": x_min,
                    "y": y_min,
                    "width": x_max - x_min,
                    "height": y_max - y_min
                },
                "vehicleType": self.label_mapping.get(label, label.upper()),
                "metadata": {
                    "source": "metro-ai-suite",
                    "originalLabel": label
                }
            }

            # Include additional Metro attributes if available
            if "attributes" in obj:
                attrs = obj["attributes"]
                if "color" in attrs:
                    sparking_event["vehicleColor"] = attrs["color"]
                if "type" in attrs:
                    sparking_event["vehicleType"] = attrs["type"]

            events.append(sparking_event)

        return events

    def forward_to_api(self, event: dict) -> bool:
        """Forward translated event to SParking API with retry logic."""
        for attempt in range(self.retry_attempts):
            try:
                response = self.session.post(
                    self.api_endpoint,
                    json=event,
                    timeout=self.api_timeout
                )

                if response.status_code in (200, 201):
                    self.logger.debug(f"Successfully forwarded event: {event.get('eventType')}")
                    return True
                elif response.status_code == 401:
                    self.logger.error("API authentication failed - check DETECTION_API_KEY")
                    return False
                else:
                    self.logger.warning(
                        f"API returned status {response.status_code}: {response.text}"
                    )
            except requests.RequestException as e:
                self.logger.warning(f"API request failed (attempt {attempt + 1}): {e}")

            if attempt < self.retry_attempts - 1:
                time.sleep(self.retry_delay)

        self.logger.error(f"Failed to forward event after {self.retry_attempts} attempts")
        return False

    def on_connect(self, client: mqtt.Client, userdata: Any, flags: dict, rc: int, properties=None):
        """Handle MQTT connection."""
        if rc == 0:
            self.logger.info("Connected to MQTT broker")
            # Subscribe to Metro AI Suite topics
            pattern = self.config.get("metro", {}).get(
                "subscribe_pattern",
                "object_detection_#"
            )
            client.subscribe(pattern)
            self.logger.info(f"Subscribed to: {pattern}")
        else:
            self.logger.error(f"MQTT connection failed with code: {rc}")

    def on_disconnect(self, client: mqtt.Client, userdata: Any, rc: int, properties=None):
        """Handle MQTT disconnection."""
        self.logger.warning(f"Disconnected from MQTT broker (rc={rc})")

    def on_message(self, client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage):
        """Handle incoming MQTT messages."""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode("utf-8"))

            self.logger.debug(f"Received message on {topic}")

            # Translate and forward
            events = self.translate_message(topic, payload)

            for event in events:
                self.forward_to_api(event)

        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in message: {e}")
        except Exception as e:
            self.logger.error(f"Error processing message: {e}", exc_info=True)

    def connect(self):
        """Connect to MQTT broker and start processing."""
        mqtt_config = self.config.get("mqtt", {})

        # Create MQTT client with version 2 API
        self.mqtt_client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=mqtt_config.get("client_id", "metro-translator")
        )

        # Set callbacks
        self.mqtt_client.on_connect = self.on_connect
        self.mqtt_client.on_disconnect = self.on_disconnect
        self.mqtt_client.on_message = self.on_message

        # Connect
        host = mqtt_config.get("host", "mqtt")
        port = mqtt_config.get("port", 1883)
        keepalive = mqtt_config.get("keepalive", 60)

        self.logger.info(f"Connecting to MQTT broker at {host}:{port}")

        while True:
            try:
                self.mqtt_client.connect(host, port, keepalive)
                break
            except Exception as e:
                self.logger.error(f"Failed to connect to MQTT: {e}")
                time.sleep(5)

        # Start loop
        self.mqtt_client.loop_forever()

    def stop(self):
        """Stop the translator."""
        if self.mqtt_client:
            self.mqtt_client.disconnect()
            self.mqtt_client.loop_stop()


def main():
    """Main entry point."""
    config = load_config()
    logger = setup_logging(config)

    logger.info("Starting Metro AI Suite to SParking MQTT Translator")

    translator = MetroTranslator(config, logger)

    try:
        translator.connect()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        translator.stop()


if __name__ == "__main__":
    main()
