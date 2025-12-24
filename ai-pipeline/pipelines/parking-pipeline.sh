#!/bin/bash
# Intel DL Streamer Pipeline for Smart Parking
# This script launches the GStreamer-based video analytics pipeline

set -e

# Configuration
CAMERA_URL="${CAMERA_URL:-rtsp://camera1:554/stream}"
MODEL_DIR="${MODEL_DIR:-/opt/intel/openvino/models}"
MQTT_HOST="${MQTT_HOST:-mqtt}"
MQTT_PORT="${MQTT_PORT:-1883}"
API_ENDPOINT="${API_ENDPOINT:-http://app:3000/api/realtime/detection}"
DEVICE="${DEVICE:-GPU}"  # CPU, GPU, or NPU

# Model paths
DETECTION_MODEL="${MODEL_DIR}/yolov10s-int8.xml"
VEHICLE_ATTR_MODEL="${MODEL_DIR}/vehicle-attributes-recognition-barrier-0039.xml"
LPR_DETECTION_MODEL="${MODEL_DIR}/vehicle-license-plate-detection-barrier-0106.xml"
LPR_RECOGNITION_MODEL="${MODEL_DIR}/license-plate-recognition-barrier-0007.xml"

echo "Starting Smart Parking Detection Pipeline"
echo "Camera URL: ${CAMERA_URL}"
echo "Device: ${DEVICE}"
echo "MQTT: ${MQTT_HOST}:${MQTT_PORT}"

# GStreamer pipeline
gst-launch-1.0 \
    urisourcebin uri="${CAMERA_URL}" ! \
    decodebin ! \
    videoconvert ! \
    video/x-raw,format=BGRx ! \
    gvadetect \
        model="${DETECTION_MODEL}" \
        device="${DEVICE}" \
        inference-interval=3 \
        threshold=0.5 ! \
    gvaclassify \
        model="${VEHICLE_ATTR_MODEL}" \
        device="${DEVICE}" \
        object-class=vehicle ! \
    gvatrack \
        tracking-type=short-term-imageless ! \
    gvadetect \
        model="${LPR_DETECTION_MODEL}" \
        device="${DEVICE}" \
        object-class=vehicle \
        threshold=0.6 ! \
    gvaclassify \
        model="${LPR_RECOGNITION_MODEL}" \
        device="${DEVICE}" \
        object-class=license_plate ! \
    gvametaconvert \
        json-indent=2 ! \
    gvametapublish \
        method=mqtt \
        address="${MQTT_HOST}:${MQTT_PORT}" \
        topic="sparking/detection/camera1" ! \
    gvawatermark ! \
    gvafpscounter ! \
    videoconvert ! \
    autovideosink sync=false

echo "Pipeline stopped"
