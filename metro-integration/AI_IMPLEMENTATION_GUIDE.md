# Metro AI Suite Integration - Implementation Guide

## Overview

This document provides comprehensive technical details for the Metro AI Suite integration with SParking. It covers the AI pipeline architecture, configuration, model deployment, and operational guidance.

**Target Hardware:** Intel Xeon processors with optional GPU acceleration
**Scale:** 10+ cameras (testing: 1-2)
**AI Framework:** Intel OpenVINO + DL Streamer

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [AI Pipeline Configuration](#ai-pipeline-configuration)
3. [Model Setup & Deployment](#model-setup--deployment)
4. [MQTT Message Format](#mqtt-message-format)
5. [Feature Extraction Service](#feature-extraction-service)
6. [MilvusDB Vector Search](#milvusdb-vector-search)
7. [WebRTC Streaming](#webrtc-streaming)
8. [Configuration Reference](#configuration-reference)
9. [Troubleshooting](#troubleshooting)
10. [Performance Tuning](#performance-tuning)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SParking Metro AI Suite                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌───────────────────┐    ┌───────────────────────┐ │
│  │   RTSP/IP    │───▶│   DL Streamer     │───▶│      MQTT Broker      │ │
│  │   Cameras    │    │  Pipeline Server  │    │    (Mosquitto)        │ │
│  └──────────────┘    └───────────────────┘    └───────────────────────┘ │
│         │                    │                          │                │
│         │                    ▼                          ▼                │
│         │            ┌───────────────┐         ┌───────────────────────┐ │
│         │            │   MediaMTX    │         │   MQTT Translator     │ │
│         │            │  (WebRTC)     │         │  (Metro→SParking)     │ │
│         │            └───────────────┘         └───────────────────────┘ │
│         │                    │                          │                │
│         │                    ▼                          ▼                │
│         │            ┌───────────────┐         ┌───────────────────────┐ │
│         └───────────▶│   Feature     │────────▶│   SParking API        │ │
│                      │  Matching     │         │  /api/realtime/       │ │
│                      │  Service      │         │  detection            │ │
│                      └───────────────┘         └───────────────────────┘ │
│                             │                                            │
│                             ▼                                            │
│                      ┌───────────────┐         ┌───────────────────────┐ │
│                      │   MilvusDB    │◀───────▶│   PostgreSQL          │ │
│                      │ (Vector DB)   │         │ (VehicleFeatureIndex) │ │
│                      └───────────────┘         └───────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Camera Ingestion**: RTSP streams from IP cameras
2. **AI Processing**: DL Streamer runs inference (vehicle detection, attributes, license plates)
3. **Event Publishing**: Detection results published to MQTT topics
4. **Translation**: MQTT Translator converts Metro format to SParking format
5. **API Integration**: Events forwarded to SParking's realtime detection API
6. **Feature Storage**: Vehicle images indexed in MilvusDB for similarity search
7. **Database Sync**: Feature indices stored in PostgreSQL for relational queries

---

## AI Pipeline Configuration

### Pipeline Definitions

Location: `metro-integration/dlstreamer/config.json`

#### Available Pipelines

| Pipeline | Purpose | Models Used |
|----------|---------|-------------|
| `sparking_vehicle_detection` | Basic vehicle detection | YOLOv11s |
| `sparking_vehicle_detection_webrtc` | Detection + WebRTC stream | YOLOv11s |
| `sparking_vehicle_attributes` | Detection + color/type | YOLOv11s + vehicle-attributes |
| `sparking_license_plate` | License plate recognition | YOLOv11s + LPD + LPR |
| `sparking_feature_extraction` | Vehicle re-ID features | YOLOv11s + vehicle-reid |

#### Pipeline Parameters

```json
{
  "detection-device": "CPU|GPU|AUTO",
  "detection-model": "/path/to/model.xml",
  "confidence-threshold": 0.5,
  "inference-interval": 1,
  "mqtt-topic": "object_detection_1"
}
```

### Starting a Pipeline via API

```bash
curl -X POST http://localhost/api/metro/pipelines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "pipelineName": "sparking_vehicle_detection",
    "source": {
      "uri": "rtsp://camera-ip:554/stream",
      "type": "uri"
    },
    "parameters": {
      "detection-device": "CPU",
      "confidence-threshold": 0.5,
      "mqtt-topic": "object_detection_1"
    },
    "cameraId": "camera-uuid-from-sparking"
  }'
```

---

## Model Setup & Deployment

### Required Models

Download and place models in `metro-integration/dlstreamer/models/`:

```
models/
├── yolov11s/
│   ├── yolov11s.xml        # OpenVINO IR format
│   ├── yolov11s.bin
│   └── yolov11s.json       # Labels file
├── vehicle-attributes/
│   ├── vehicle-attributes-recognition-barrier-0042.xml
│   └── vehicle-attributes-recognition-barrier-0042.bin
├── license-plate/
│   ├── vehicle-license-plate-detection-barrier-0106.xml
│   ├── vehicle-license-plate-detection-barrier-0106.bin
│   ├── license-plate-recognition-barrier-0001.xml
│   └── license-plate-recognition-barrier-0001.bin
└── vehicle-reid/
    ├── vehicle-reid-0001.xml
    └── vehicle-reid-0001.bin
```

### Model Download Script

```bash
#!/bin/bash
# download_models.sh

MODELS_DIR="metro-integration/dlstreamer/models"
mkdir -p $MODELS_DIR

# Install OpenVINO model downloader
pip install openvino-dev

# Download Intel models from Open Model Zoo
omz_downloader --name vehicle-attributes-recognition-barrier-0042 \
  -o $MODELS_DIR/vehicle-attributes

omz_downloader --name vehicle-license-plate-detection-barrier-0106 \
  -o $MODELS_DIR/license-plate

omz_downloader --name license-plate-recognition-barrier-0001 \
  -o $MODELS_DIR/license-plate

omz_downloader --name vehicle-reid-0001 \
  -o $MODELS_DIR/vehicle-reid

# For YOLOv11, export from Ultralytics to OpenVINO format
pip install ultralytics
python -c "
from ultralytics import YOLO
model = YOLO('yolo11s.pt')
model.export(format='openvino', imgsz=640)
"
mv yolo11s_openvino_model/* $MODELS_DIR/yolov11s/
```

### Model Conversion (if needed)

```bash
# Convert ONNX to OpenVINO IR
mo --input_model model.onnx \
   --output_dir output/ \
   --data_type FP16 \
   --input_shape [1,3,640,640]
```

---

## MQTT Message Format

### Metro AI Suite Output Format (Input)

```json
{
  "timestamp": 1706889600000,
  "source": "object_detection_1",
  "metadata": {
    "objects": [
      {
        "id": 1,
        "detection": {
          "bounding_box": {
            "x_min": 0.1,
            "y_min": 0.2,
            "x_max": 0.3,
            "y_max": 0.4
          },
          "confidence": 0.95,
          "label": "car"
        },
        "attributes": {
          "color": "white",
          "type": "sedan"
        },
        "tracking_id": "track_001"
      }
    ]
  }
}
```

### SParking Format (Output)

```json
{
  "cameraId": "camera-uuid",
  "eventType": "VEHICLE_DETECTED",
  "confidence": 0.95,
  "bbox": {
    "x": 0.1,
    "y": 0.2,
    "width": 0.2,
    "height": 0.2
  },
  "vehicleType": "CAR",
  "vehicleColor": "white",
  "metadata": {
    "source": "metro-ai-suite",
    "trackingId": "track_001"
  }
}
```

### MQTT Topics

| Topic Pattern | Publisher | Subscriber |
|---------------|-----------|------------|
| `object_detection_<N>` | DL Streamer | MQTT Translator, Node-RED |
| `sparking/slot/slot_occupied` | Node-RED | SParking App |
| `sparking/slot/slot_vacated` | Node-RED | SParking App |
| `sparking/features/#` | Feature Matching | (internal) |

---

## Feature Extraction Service

### Architecture

The Feature Matching Service (`metro-integration/feature-matching/`) provides:

1. **Feature Extraction**: Uses ResNet50/EfficientNet to extract 1000-dimensional feature vectors
2. **Vector Storage**: Stores features in MilvusDB for similarity search
3. **Search API**: FastAPI endpoints for image-based vehicle search
4. **MQTT Integration**: Automatically indexes vehicles from detection events

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health check |
| `/stats` | GET | Index statistics |
| `/search` | POST | Search by image upload |
| `/index` | POST | Index a new vehicle image |
| `/index/{id}` | DELETE | Remove from index |

### Search Request Example

```bash
curl -X POST http://localhost:8001/search \
  -F "image=@vehicle.jpg" \
  -F "limit=10" \
  -F "min_confidence=0.5"
```

### Response Format

```json
{
  "success": true,
  "matches": [
    {
      "id": "feature-uuid",
      "score": 0.92,
      "camera_id": "camera-uuid",
      "vehicle_type": "CAR",
      "vehicle_color": "white",
      "license_plate": "ABC1234",
      "detected_at": 1706889600,
      "confidence": 0.95,
      "image_url": "/static/feature-uuid.jpg"
    }
  ],
  "query_time_ms": 45.2
}
```

### Feature Model Configuration

| Model | Dimension | Use Case |
|-------|-----------|----------|
| ResNet50 | 2048 | High accuracy |
| EfficientNet-B0 | 1280 | Balanced |
| MobileNetV3 | 1000 | Fast inference |

Set via environment variable:
```bash
FEATURE_MODEL_DIM=1000  # Must match model output
```

---

## MilvusDB Vector Search

### Collection Schema

```
Collection: sparking_vehicles
├── id (VARCHAR, primary key)
├── feature_vector (FLOAT_VECTOR, dim=1000)
├── camera_id (VARCHAR)
├── vehicle_type (VARCHAR)
├── vehicle_color (VARCHAR)
├── license_plate (VARCHAR)
├── detected_at (INT64)
├── confidence (FLOAT)
└── image_url (VARCHAR)
```

### Index Configuration

```python
INDEX_PARAMS = {
    "metric_type": "COSINE",
    "index_type": "HNSW",
    "params": {"M": 16, "efConstruction": 256}
}

SEARCH_PARAMS = {
    "metric_type": "COSINE",
    "params": {"ef": 128}
}
```

### Performance Characteristics

| Metric | Value |
|--------|-------|
| Index Build Time | ~1 min/100K vectors |
| Search Latency | <50ms for 1M vectors |
| Memory Usage | ~4GB for 1M vectors |
| Recall@10 | >95% |

### Database Sync

The `VehicleFeatureIndex` Prisma model syncs with MilvusDB:

```prisma
model VehicleFeatureIndex {
  id           String   @id @default(cuid())
  milvusId     String   @unique  // Links to Milvus
  cameraId     String
  vehicleId    String?
  tokenId      String?
  imageUrl     String
  detectedAt   DateTime
  confidence   Float
  vehicleType  String?
  vehicleColor String?
  licensePlate String?
  bbox         Json?

  camera  Camera   @relation(...)
  vehicle Vehicle? @relation(...)
  token   Token?   @relation(...)
}
```

---

## WebRTC Streaming

### Components

1. **MediaMTX**: RTSP to WebRTC conversion
2. **Coturn**: TURN server for NAT traversal
3. **DL Streamer**: Optional WebRTC output pipeline

### WHEP Protocol Flow

```
Client                    MediaMTX
   |                          |
   |--- POST /stream/whep --->|  (SDP Offer)
   |<-- 201 Created ----------|  (SDP Answer)
   |                          |
   |===== WebRTC Media =======|
   |                          |
   |--- DELETE /stream/whep ->|  (Close)
   |<-- 200 OK ---------------|
```

### ICE Server Configuration

```typescript
const iceServers = [
  {
    urls: ['stun:stun.l.google.com:19302'],
  },
  {
    urls: ['turn:localhost:3478'],
    username: 'sparking',
    credential: 'sparking_secret'
  }
]
```

### Frontend Integration

```tsx
import { WebRTCStream } from '@/components/camera/WebRTCStream'

<WebRTCStream
  streamId="camera-1"
  cameraName="Entrance Camera"
  status="ONLINE"
  autoPlay={true}
/>
```

---

## Configuration Reference

### Environment Variables

```bash
# DL Streamer
DLSTREAMER_IMAGE=intel/dlstreamer-pipeline-server:latest
DLSTREAMER_ENDPOINT=http://dlstreamer-pipeline-server:8080
GST_DEBUG=1  # GStreamer debug level (0-5)

# MQTT
MQTT_HOST=mqtt
MQTT_PORT=1883
METRO_MQTT_TOPIC_PREFIX=object_detection
CAMERA_MAPPING='{"1":"camera-uuid-1","2":"camera-uuid-2"}'

# MilvusDB
MILVUS_ENDPOINT=http://milvus-db:19530
MILVUS_COLLECTION=sparking_vehicles
FEATURE_MODEL_DIM=1000

# Feature Matching
FEATURE_MATCHING_ENDPOINT=http://feature-matching:8000

# WebRTC
MEDIAMTX_ENDPOINT=http://mediamtx:8889
WEBRTC_ICE_SERVERS=turn:localhost:3478
TURN_USERNAME=sparking
TURN_PASSWORD=<strong-password>

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<strong-password>
GRAFANA_ROOT_URL=http://localhost/grafana
```

### Docker Compose Profiles

```bash
# Start only AI services
docker compose up -d mqtt node-red mqtt-translator dlstreamer-pipeline-server

# Start with image search
docker compose up -d milvus-db feature-matching

# Full stack
docker compose up -d
```

---

## Troubleshooting

### Common Issues

#### 1. DL Streamer Pipeline Fails to Start

**Symptoms**: Pipeline returns error immediately
**Causes**:
- Model files missing or corrupted
- Invalid RTSP URL
- GPU not accessible

**Solutions**:
```bash
# Check model files exist
ls -la metro-integration/dlstreamer/models/

# Verify RTSP stream
ffprobe rtsp://camera-ip:554/stream

# Check GPU access
docker exec sparking-dlstreamer ls /dev/dri
```

#### 2. MQTT Messages Not Received

**Symptoms**: No detections in SParking
**Debug**:
```bash
# Subscribe to all topics
docker exec sparking-mqtt mosquitto_sub -t '#' -v

# Check translator logs
docker logs sparking-mqtt-translator -f
```

#### 3. MilvusDB Connection Failed

**Symptoms**: Feature search returns empty
**Solutions**:
```bash
# Check Milvus health
curl http://localhost:9091/healthz

# Check collection exists
docker exec sparking-milvus curl http://localhost:19530/v1/vector/collections
```

#### 4. WebRTC Stream Not Playing

**Symptoms**: Black video, connection timeout
**Debug**:
```bash
# Check MediaMTX logs
docker logs sparking-mediamtx -f

# Verify stream exists
curl http://localhost:8889/v3/paths/list
```

### Log Locations

| Service | Log Command |
|---------|-------------|
| DL Streamer | `docker logs sparking-dlstreamer` |
| MQTT Translator | `docker logs sparking-mqtt-translator` |
| Feature Matching | `docker logs sparking-feature-matching` |
| MilvusDB | `docker logs sparking-milvus` |
| Node-RED | `docker logs sparking-nodered` |

---

## Performance Tuning

### DL Streamer Optimization

```bash
# CPU Optimization
export OMP_NUM_THREADS=4
export KMP_AFFINITY=granularity=fine,compact,1,0

# GPU Optimization (Intel)
export LIBVA_DRIVER_NAME=iHD
export GST_VAAPI_ALL_DRIVERS=1
```

### Inference Interval Tuning

| Use Case | Interval | FPS Processed |
|----------|----------|---------------|
| Real-time tracking | 1 | 30 fps |
| Occupancy detection | 3 | 10 fps |
| Energy saving | 5 | 6 fps |

### MilvusDB Performance

```yaml
# For high-throughput indexing
quotaAndLimits:
  dml:
    collectionInsertRate:
      max: 10000000  # 10MB/s

# For fast search
queryCoord:
  searchCacheEnabled: true
```

### Memory Management

| Service | Recommended RAM |
|---------|-----------------|
| DL Streamer | 4-8 GB |
| MilvusDB | 4 GB |
| Feature Matching | 2 GB |
| PostgreSQL | 1 GB |

---

## Migration from Legacy AI Pipeline

### Parallel Operation

1. Keep existing `ai-pipeline` service running
2. Start Metro services alongside
3. Configure both to publish to same MQTT broker
4. SParking API accepts events from both

### Validation Checklist

- [ ] Detection accuracy comparable
- [ ] Latency within acceptable range
- [ ] No missed events
- [ ] Feature search working
- [ ] WebRTC streams stable

### Cutover Steps

1. Stop legacy `ai-pipeline` service
2. Update camera configurations to use Metro pipelines
3. Verify all cameras streaming
4. Remove legacy service from docker-compose

---

## Support & Resources

- **DL Streamer Docs**: https://dlstreamer.github.io/
- **OpenVINO Model Zoo**: https://github.com/openvinotoolkit/open_model_zoo
- **MilvusDB Docs**: https://milvus.io/docs
- **MediaMTX Docs**: https://github.com/bluenviron/mediamtx

---

## Appendix: File Structure

```
metro-integration/
├── AI_IMPLEMENTATION_GUIDE.md  # This document
├── dlstreamer/
│   ├── config.json             # Pipeline definitions
│   └── models/                 # OpenVINO models (download separately)
├── feature-matching/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── server.py               # FastAPI service
│   └── milvus_utils.py         # Vector DB operations
├── grafana/
│   ├── dashboards.yml
│   ├── datasources.yml
│   └── dashboards/
│       └── parking-analytics.json
├── milvus/
│   ├── embedEtcd.yaml
│   └── user.yaml
├── mqtt-translator/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── translator.py           # Metro→SParking translation
│   └── config.yaml
└── node-red/
    ├── flows.json              # Automation rules
    └── settings.js
```
