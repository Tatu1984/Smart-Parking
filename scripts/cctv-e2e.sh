#!/usr/bin/env bash
# Phase-1 CCTV end-to-end check. Run from the repo root.
#
# Usage:
#   bash scripts/cctv-e2e.sh
# If your user is NOT in the docker group, run the docker parts with sudo:
#   sudo -E bash scripts/cctv-e2e.sh
#
# Verifies: MediaMTX up, control API internal-only, simulated camera ingests,
# HLS manifest is served. Leaves services running so you can then test the
# health worker (start the app) and browser playback.
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0; fail=0
ok(){ echo "  PASS: $1"; pass=$((pass+1)); }
no(){ echo "  FAIL: $1"; fail=$((fail+1)); }

# The MediaMTX image is distroless (no sh/wget), so we can't `docker exec` tools
# inside it. To reach the internal control API (:9997, not host-mapped) we run a
# tiny curl container ATTACHED to the compose network.
NET="smart-parking_sparking-network"
mtx_api(){  # mtx_api <path> -> echoes body, returns curl exit code
  docker run --rm --network "$NET" curlimages/curl:latest -s -m 5 "http://mediamtx:9997$1"
}

echo "== 1. Bring up MediaMTX + simulated camera together (one network) =="
# Bring both up in a SINGLE compose invocation so they share one freshly-created
# network (two separate `up` calls can race and orphan the network).
docker compose --profile simulate up -d mediamtx simulate-camera || { echo "compose up failed"; exit 1; }

echo "== 2. Wait for control API (:9997, internal via the compose network) =="
api_up=""
for _ in $(seq 1 30); do
  mtx_api /v3/paths/list >/dev/null 2>&1 && { api_up=1; break; }
  sleep 1
done
if [ -n "$api_up" ]; then
  ok "control API reachable on the internal network"
else
  no "control API not reachable"
  echo "  --- last 40 lines of MediaMTX logs (why it didn't come up) ---"
  docker logs --tail 40 sparking-mediamtx 2>&1 | sed 's/^/    /'
fi

echo "== 3. Control API must NOT be exposed on the host =="
if curl -s -m 2 http://localhost:9997/v3/paths/list >/dev/null 2>&1; then
  no "control API :9997 is reachable from host (should be internal-only!)"
else
  ok "control API :9997 not exposed on host (correct)"
fi

echo "== 4. Wait for the simulated camera to publish (path cam-sim ready) =="
ready=""
for _ in $(seq 1 30); do
  info=$(mtx_api /v3/paths/get/cam-sim 2>/dev/null)
  echo "$info" | grep -q '"ready":true' && { ready=1; break; }
  sleep 1
done
if [ -n "$ready" ]; then
  ok "MediaMTX path 'cam-sim' ready (RTSP ingest works)"
else
  no "cam-sim never became ready"
  echo "  --- simulated-camera (ffmpeg) logs ---"
  docker logs --tail 25 sparking-camera-sim 2>&1 | sed 's/^/    /'
fi

echo "== 5. HLS manifest served on :8888 (browser output) =="
code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://localhost:8888/cam-sim/index.m3u8")
[ "$code" = "200" ] && ok "HLS manifest HTTP 200" || no "HLS manifest not 200 (got $code)"

echo "== 6. Manifest looks like valid HLS =="
man=$(curl -s -m 5 "http://localhost:8888/cam-sim/index.m3u8")
echo "$man" | grep -qiE '#EXT-X|\.m3u8|\.mp4' && ok "manifest content is HLS" || no "unexpected manifest content"

echo ""
echo "== RESULT: $pass passed, $fail failed =="
echo "Services left running. Next: start the app (CAMERA_HEALTH_WORKER_ENABLED=true"
echo "npm run dev), register a camera with mediaMtxPath=cam-sim, open it in the"
echo "dashboard, and confirm HLS plays + status flips ONLINE."
echo "Tear down with: docker compose --profile simulate down"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
EOF
