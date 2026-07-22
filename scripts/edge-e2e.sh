#!/usr/bin/env bash
# Phase-2 Edge Agent end-to-end check (local validation, no remote site needed).
#
# Proves: local RTSP (sim camera) → Go Edge Agent (ffmpeg HLS-over-HTTP-PUT) →
# SParking ingest → credential-free HLS → health worker flips camera ONLINE.
#
# Prereqs:
#   - Docker (for the simulated camera) OR your own reachable RTSP URL in RTSP_SRC
#   - The SParking dev server running WITH the edge env + health worker, e.g.:
#       CAMERA_HEALTH_WORKER_ENABLED=true CAMERA_HEALTH_POLL_INTERVAL_MS=3000 \
#       EDGE_INGEST_DIR=./.edge-hls INGEST_TOKEN_SECRET=<secret> npm run dev
#   - psql access to seed the edge camera + token (or issue via the dashboard)
#   - Go + ffmpeg installed (to build/run the agent)
#
# This script builds the agent and points it at a stream; verifying the app-side
# ONLINE transition is done by watching /api/cameras/<id>/logs or the dashboard.
set -uo pipefail
cd "$(dirname "$0")/.."

APP="${APP_BASE:-http://localhost:3000}"
RTSP_SRC="${RTSP_SRC:-rtsp://sparking_pub:change_me_publisher_secret@localhost:8554/cam-sim}"
STREAM_KEY="${STREAM_KEY:-edge-e2e}"
TOKEN="${INGEST_TOKEN:-}"

echo "== 1. Build the edge agent =="
( cd edge-agent && go build -o bin/edge-agent ./cmd/edge-agent ) || { echo "build failed"; exit 1; }
echo "  built edge-agent/bin/edge-agent"

if [ -z "$TOKEN" ]; then
  echo ""
  echo "No INGEST_TOKEN provided. Issue one for your edge camera first:"
  echo "  - In the dashboard: create a camera, then POST /api/cameras/<id>/ingest-token"
  echo "  - Set STREAM_KEY to that camera's mediaMtxPath and re-run with INGEST_TOKEN=<token>"
  exit 2
fi

echo "== 2. Ensure the sim camera is up (optional; ignored if RTSP_SRC is your own) =="
if command -v docker >/dev/null 2>&1; then
  docker compose --profile simulate up -d mediamtx simulate-camera >/dev/null 2>&1 || true
fi

echo "== 3. Write a temporary agent config =="
CFG="$(mktemp)"
cat > "$CFG" <<YAML
cameraId: $STREAM_KEY
camera:
  name: Edge E2E
  rtsp: $RTSP_SRC
cloud:
  publish: $APP/api/edge/ingest/$STREAM_KEY/index.m3u8
  token: $TOKEN
ffmpeg:
  transcode: auto
log:
  level: info
YAML

echo "== 4. Run the agent for ~15s (publishes HLS to the ingest) =="
timeout 15 ./edge-agent/bin/edge-agent --config "$CFG" || true
rm -f "$CFG"

echo "== 5. Verify credential-free HLS is served =="
code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$APP/api/edge/ingest/$STREAM_KEY/index.m3u8")
if [ "$code" = "200" ]; then
  echo "  PASS: HLS manifest served (200)"
else
  echo "  FAIL: HLS manifest not served (got $code)"
fi

echo ""
echo "Now check the camera flipped ONLINE:"
echo "  GET $APP/api/cameras/<id>/logs   (expect a CONNECTED row)"
echo "  or watch the dashboard Live view."
