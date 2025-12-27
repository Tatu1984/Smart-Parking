"""
Detection Event Publisher
Sends detection events to the Next.js API and optionally MQTT
"""
import asyncio
import json
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime
import aiohttp

logger = logging.getLogger(__name__)


@dataclass
class DetectionEvent:
    """Detection event to be published"""
    camera_id: str
    parking_lot_id: str
    timestamp: str
    detections: List[Dict]
    slot_updates: List[Dict]
    frame_number: int
    zone_id: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "cameraId": self.camera_id,
            "parkingLotId": self.parking_lot_id,
            "zoneId": self.zone_id,
            "timestamp": self.timestamp,
            "frameNumber": self.frame_number,
            "detections": self.detections,
            "slotUpdates": self.slot_updates
        }


class EventPublisher:
    """
    Publishes detection events to HTTP API and MQTT broker
    """

    def __init__(
        self,
        api_endpoint: str = "http://localhost:3000/api/realtime/detection",
        batch_size: int = 10,
        flush_interval: float = 1.0,
        mqtt_enabled: bool = False,
        mqtt_host: str = "localhost",
        mqtt_port: int = 1883,
        mqtt_topic_prefix: str = "sparking/detection"
    ):
        self.api_endpoint = api_endpoint
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.mqtt_enabled = mqtt_enabled
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.mqtt_topic_prefix = mqtt_topic_prefix

        self._queue: List[DetectionEvent] = []
        self._session: Optional[aiohttp.ClientSession] = None
        self._mqtt_client = None
        self._running = False
        self._flush_task = None

    async def start(self):
        """Start the publisher"""
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10),
            headers={"Content-Type": "application/json"}
        )
        self._running = True

        if self.mqtt_enabled:
            await self._connect_mqtt()

        # Start background flush task
        self._flush_task = asyncio.create_task(self._flush_loop())
        logger.info("Event publisher started")

    async def stop(self):
        """Stop the publisher and flush remaining events"""
        self._running = False

        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass

        # Flush remaining events
        if self._queue:
            await self._flush()

        if self._session:
            await self._session.close()

        if self._mqtt_client:
            self._mqtt_client.disconnect()

        logger.info("Event publisher stopped")

    async def publish(self, event: DetectionEvent):
        """Queue an event for publishing"""
        self._queue.append(event)

        # Immediate flush if batch size reached
        if len(self._queue) >= self.batch_size:
            await self._flush()

    async def publish_slot_update(
        self,
        camera_id: str,
        parking_lot_id: str,
        slot_id: str,
        is_occupied: bool,
        confidence: float = 0.0,
        vehicle_type: Optional[str] = None,
        license_plate: Optional[str] = None
    ):
        """Publish a single slot update immediately"""
        payload = {
            "cameraId": camera_id,
            "parkingLotId": parking_lot_id,
            "slotId": slot_id,
            "isOccupied": is_occupied,
            "confidence": confidence,
            "vehicleType": vehicle_type,
            "licensePlate": license_plate,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        try:
            async with self._session.post(
                f"{self.api_endpoint}/slot",
                json=payload
            ) as response:
                if response.status != 200:
                    logger.warning(f"Slot update failed: {response.status}")
        except Exception as e:
            logger.error(f"Failed to publish slot update: {e}")

        # Also publish to MQTT if enabled
        if self.mqtt_enabled and self._mqtt_client:
            topic = f"{self.mqtt_topic_prefix}/slot/{slot_id}"
            self._mqtt_client.publish(topic, json.dumps(payload))

    async def _flush_loop(self):
        """Background task to flush events periodically"""
        while self._running:
            await asyncio.sleep(self.flush_interval)
            if self._queue:
                await self._flush()

    async def _flush(self):
        """Flush queued events to API"""
        if not self._queue:
            return

        events = self._queue.copy()
        self._queue.clear()

        # Prepare batch payload
        payload = {
            "events": [e.to_dict() for e in events],
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        try:
            async with self._session.post(
                self.api_endpoint,
                json=payload
            ) as response:
                if response.status == 200:
                    logger.debug(f"Published {len(events)} events")
                else:
                    text = await response.text()
                    logger.warning(f"API returned {response.status}: {text}")
                    # Re-queue events on failure
                    self._queue = events + self._queue

        except aiohttp.ClientError as e:
            logger.error(f"HTTP error publishing events: {e}")
            # Re-queue events on failure
            self._queue = events + self._queue

        except Exception as e:
            logger.error(f"Failed to publish events: {e}")

        # Publish to MQTT if enabled
        if self.mqtt_enabled and self._mqtt_client:
            for event in events:
                topic = f"{self.mqtt_topic_prefix}/camera/{event.camera_id}"
                try:
                    self._mqtt_client.publish(topic, json.dumps(event.to_dict()))
                except Exception as e:
                    logger.error(f"MQTT publish failed: {e}")

    async def _connect_mqtt(self):
        """Connect to MQTT broker"""
        try:
            import paho.mqtt.client as mqtt

            self._mqtt_client = mqtt.Client()

            def on_connect(client, userdata, flags, rc):
                if rc == 0:
                    logger.info(f"Connected to MQTT broker at {self.mqtt_host}:{self.mqtt_port}")
                else:
                    logger.error(f"MQTT connection failed with code {rc}")

            self._mqtt_client.on_connect = on_connect
            self._mqtt_client.connect_async(self.mqtt_host, self.mqtt_port)
            self._mqtt_client.loop_start()

        except ImportError:
            logger.warning("paho-mqtt not installed, MQTT disabled")
            self.mqtt_enabled = False
        except Exception as e:
            logger.error(f"Failed to connect to MQTT: {e}")
            self.mqtt_enabled = False


class WebSocketPublisher:
    """
    Publishes events via WebSocket for real-time updates
    """

    def __init__(self, ws_url: str = "ws://localhost:3000/api/realtime/ws"):
        self.ws_url = ws_url
        self._ws = None
        self._running = False

    async def connect(self):
        """Connect to WebSocket server"""
        try:
            import websockets
            self._ws = await websockets.connect(self.ws_url)
            self._running = True
            logger.info(f"Connected to WebSocket at {self.ws_url}")
        except Exception as e:
            logger.error(f"WebSocket connection failed: {e}")
            raise

    async def disconnect(self):
        """Disconnect from WebSocket server"""
        self._running = False
        if self._ws:
            await self._ws.close()

    async def publish(self, event: DetectionEvent):
        """Publish event via WebSocket"""
        if not self._ws:
            logger.warning("WebSocket not connected")
            return

        try:
            await self._ws.send(json.dumps({
                "type": "detection",
                "data": event.to_dict()
            }))
        except Exception as e:
            logger.error(f"WebSocket send failed: {e}")
            # Try to reconnect
            await self.connect()
