"""
Feature Matching Service for SParking

FastAPI service that:
1. Extracts vehicle features from images using a ResNet-based model
2. Stores features in MilvusDB for similarity search
3. Subscribes to MQTT for automatic feature extraction from detections
4. Provides API endpoints for image-based vehicle search
"""

import asyncio
import io
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiofiles
import httpx
import numpy as np
import paho.mqtt.client as mqtt
import torch
import torchvision.transforms as transforms
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel

from milvus_utils import get_milvus_index

# Configure logging
log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER", "mqtt")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_FEATURE_TOPIC", "sparking/features/#")
SPARKING_API = os.getenv("SPARKING_API_ENDPOINT", "http://app:3000")
DETECTION_API_KEY = os.getenv("DETECTION_API_KEY", "")
STATIC_DIR = Path("/usr/src/app/static")
STATIC_DIR.mkdir(exist_ok=True)

# Feature extraction model
feature_extractor = None
transform = None


def load_feature_extractor():
    """Load pre-trained ResNet model for feature extraction."""
    global feature_extractor, transform

    try:
        import timm

        # Use a pre-trained model optimized for vehicle re-identification
        # EfficientNet or ResNet50 are good choices
        model_name = os.getenv("FEATURE_MODEL", "resnet50")
        feature_extractor = timm.create_model(
            model_name,
            pretrained=True,
            num_classes=0,  # Remove classification head, get features
        )
        feature_extractor.eval()

        # Move to GPU if available
        if torch.cuda.is_available():
            feature_extractor = feature_extractor.cuda()
            logger.info("Feature extractor loaded on GPU")
        else:
            logger.info("Feature extractor loaded on CPU")

        # Image preprocessing
        transform = transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                ),
            ]
        )

        return True
    except Exception as e:
        logger.error(f"Failed to load feature extractor: {e}")
        return False


def extract_features(image: Image.Image) -> Optional[list[float]]:
    """Extract feature vector from image."""
    global feature_extractor, transform

    if feature_extractor is None or transform is None:
        logger.error("Feature extractor not loaded")
        return None

    try:
        # Convert to RGB if necessary
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Preprocess
        img_tensor = transform(image).unsqueeze(0)

        if torch.cuda.is_available():
            img_tensor = img_tensor.cuda()

        # Extract features
        with torch.no_grad():
            features = feature_extractor(img_tensor)

        # Convert to list and normalize
        feature_vector = features.cpu().numpy().flatten()
        feature_vector = feature_vector / np.linalg.norm(feature_vector)

        return feature_vector.tolist()

    except Exception as e:
        logger.error(f"Feature extraction failed: {e}")
        return None


# MQTT client for receiving detection events
mqtt_client: Optional[mqtt.Client] = None


def on_mqtt_connect(client, userdata, flags, rc, properties=None):
    """MQTT connection callback."""
    if rc == 0:
        logger.info("Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC)
        logger.info(f"Subscribed to: {MQTT_TOPIC}")
    else:
        logger.error(f"MQTT connection failed: {rc}")


def on_mqtt_message(client, userdata, msg):
    """Handle incoming MQTT messages with vehicle features."""
    try:
        payload = json.loads(msg.payload.decode("utf-8"))

        # Check if this is a feature extraction request
        if "feature_vector" in payload and "image_url" in payload:
            # Store feature in Milvus
            milvus = get_milvus_index()
            milvus.insert_feature(
                feature_id=payload.get("id", str(uuid.uuid4())),
                feature_vector=payload["feature_vector"],
                camera_id=payload.get("camera_id", ""),
                detected_at=int(time.time()),
                confidence=payload.get("confidence", 0.5),
                image_url=payload["image_url"],
                vehicle_type=payload.get("vehicle_type", ""),
                vehicle_color=payload.get("vehicle_color", ""),
                license_plate=payload.get("license_plate", ""),
            )
            logger.debug(f"Stored feature from MQTT: {payload.get('id')}")

    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")


def start_mqtt_client():
    """Start MQTT client in background."""
    global mqtt_client

    try:
        mqtt_client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"feature-matching-{uuid.uuid4().hex[:8]}",
        )
        mqtt_client.on_connect = on_mqtt_connect
        mqtt_client.on_message = on_mqtt_message

        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        logger.info("MQTT client started")

    except Exception as e:
        logger.error(f"Failed to start MQTT client: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting Feature Matching Service")

    # Load feature extractor
    if not load_feature_extractor():
        logger.warning("Feature extractor not available, running in limited mode")

    # Connect to Milvus
    milvus = get_milvus_index()
    if milvus.collection:
        logger.info("Connected to MilvusDB")
    else:
        logger.warning("MilvusDB not available")

    # Start MQTT client
    start_mqtt_client()

    yield

    # Shutdown
    logger.info("Shutting down Feature Matching Service")
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
    milvus.close()


# FastAPI app
app = FastAPI(
    title="SParking Feature Matching Service",
    description="Vehicle image search using feature vectors",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (vehicle images)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# Pydantic models
class SearchResult(BaseModel):
    id: str
    score: float
    camera_id: str
    vehicle_type: Optional[str]
    vehicle_color: Optional[str]
    license_plate: Optional[str]
    detected_at: int
    confidence: float
    image_url: str


class SearchResponse(BaseModel):
    success: bool
    matches: list[SearchResult]
    query_time_ms: float


class IndexStats(BaseModel):
    collection_name: str
    num_entities: int
    feature_dim: int


class HealthResponse(BaseModel):
    status: str
    milvus_connected: bool
    feature_extractor_loaded: bool
    mqtt_connected: bool


# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    milvus = get_milvus_index()
    return HealthResponse(
        status="healthy",
        milvus_connected=milvus.collection is not None,
        feature_extractor_loaded=feature_extractor is not None,
        mqtt_connected=mqtt_client is not None and mqtt_client.is_connected(),
    )


@app.get("/stats", response_model=IndexStats)
async def get_stats():
    """Get index statistics."""
    milvus = get_milvus_index()
    stats = milvus.get_stats()
    if not stats:
        raise HTTPException(status_code=503, detail="MilvusDB not available")
    return IndexStats(**stats)


@app.post("/search", response_model=SearchResponse)
async def search_by_image(
    image: UploadFile = File(...),
    limit: int = Query(default=10, ge=1, le=100),
    camera_ids: Optional[str] = Query(default=None, description="Comma-separated camera IDs"),
    min_confidence: float = Query(default=0.0, ge=0.0, le=1.0),
):
    """
    Search for similar vehicles by uploading an image.

    The image will be processed to extract features, then matched against
    stored vehicle features in the database.
    """
    start_time = time.time()

    if feature_extractor is None:
        raise HTTPException(
            status_code=503,
            detail="Feature extractor not available",
        )

    try:
        # Read and process image
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))

        # Extract features
        features = extract_features(pil_image)
        if features is None:
            raise HTTPException(
                status_code=400,
                detail="Failed to extract features from image",
            )

        # Parse camera IDs
        camera_id_list = None
        if camera_ids:
            camera_id_list = [cid.strip() for cid in camera_ids.split(",")]

        # Search in Milvus
        milvus = get_milvus_index()
        results = milvus.search_similar(
            query_vector=features,
            limit=limit,
            camera_ids=camera_id_list,
            min_confidence=min_confidence,
        )

        query_time = (time.time() - start_time) * 1000

        return SearchResponse(
            success=True,
            matches=[SearchResult(**r) for r in results],
            query_time_ms=round(query_time, 2),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/index")
async def index_image(
    image: UploadFile = File(...),
    camera_id: str = Query(...),
    vehicle_type: Optional[str] = Query(default=None),
    vehicle_color: Optional[str] = Query(default=None),
    license_plate: Optional[str] = Query(default=None),
    confidence: float = Query(default=0.5, ge=0.0, le=1.0),
):
    """
    Index a vehicle image for future search.

    Extracts features from the image and stores them in the vector database.
    """
    if feature_extractor is None:
        raise HTTPException(
            status_code=503,
            detail="Feature extractor not available",
        )

    try:
        # Read and process image
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))

        # Extract features
        features = extract_features(pil_image)
        if features is None:
            raise HTTPException(
                status_code=400,
                detail="Failed to extract features from image",
            )

        # Generate ID and save image
        feature_id = str(uuid.uuid4())
        image_filename = f"{feature_id}.jpg"
        image_path = STATIC_DIR / image_filename

        # Save image
        async with aiofiles.open(image_path, "wb") as f:
            await f.write(contents)

        image_url = f"/static/{image_filename}"

        # Store in Milvus
        milvus = get_milvus_index()
        success = milvus.insert_feature(
            feature_id=feature_id,
            feature_vector=features,
            camera_id=camera_id,
            detected_at=int(time.time()),
            confidence=confidence,
            image_url=image_url,
            vehicle_type=vehicle_type or "",
            vehicle_color=vehicle_color or "",
            license_plate=license_plate or "",
        )

        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to store features in database",
            )

        # Notify SParking API
        await notify_sparking_api(
            feature_id=feature_id,
            camera_id=camera_id,
            image_url=image_url,
            vehicle_type=vehicle_type,
            vehicle_color=vehicle_color,
            license_plate=license_plate,
            confidence=confidence,
        )

        return {
            "success": True,
            "id": feature_id,
            "image_url": image_url,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Indexing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/index/{feature_id}")
async def delete_feature(feature_id: str):
    """Delete a feature from the index."""
    milvus = get_milvus_index()
    success = milvus.delete_feature(feature_id)

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to delete feature",
        )

    # Also delete image file
    image_path = STATIC_DIR / f"{feature_id}.jpg"
    if image_path.exists():
        image_path.unlink()

    return {"success": True, "deleted": feature_id}


async def notify_sparking_api(
    feature_id: str,
    camera_id: str,
    image_url: str,
    vehicle_type: Optional[str],
    vehicle_color: Optional[str],
    license_plate: Optional[str],
    confidence: float,
):
    """Notify SParking API about new indexed feature."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SPARKING_API}/api/realtime/detection",
                json={
                    "cameraId": camera_id,
                    "eventType": "VEHICLE_DETECTED",
                    "confidence": confidence,
                    "vehicleType": vehicle_type,
                    "vehicleColor": vehicle_color,
                    "licensePlate": license_plate,
                    "metadata": {
                        "featureId": feature_id,
                        "imageUrl": image_url,
                        "source": "feature-matching",
                    },
                },
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": DETECTION_API_KEY,
                },
                timeout=10.0,
            )

            if response.status_code not in (200, 201):
                logger.warning(
                    f"SParking API notification failed: {response.status_code}"
                )

    except Exception as e:
        logger.warning(f"Failed to notify SParking API: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
