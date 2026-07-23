#!/usr/bin/env bash
# Provision an EDGE_PUSH camera and print the config your on-site friend needs.
#
# Run this on the CLOUD machine (the one running SParking + ngrok), AFTER the
# ngrok tunnel is up so we can bake the public URL into the config.
#
# Usage:
#   NGROK_URL=https://abc123.ngrok-free.app \
#   RTSP_URL='rtsp://user:pass@192.168.1.100:554/Streaming/Channels/101' \
#   bash scripts/edge-provision.sh [streamKey] [cameraName]
#
# Requires: psql access to the sparking DB (same creds as .env DATABASE_URL).
set -uo pipefail
cd "$(dirname "$0")/.."

STREAM_KEY="${1:-friend-cam-1}"
CAM_NAME="${2:-Friend Test Camera}"
NGROK_URL="${NGROK_URL:-}"
RTSP_URL="${RTSP_URL:-rtsp://USER:PASS@192.168.1.100:554/Streaming/Channels/101}"

if [ -z "$NGROK_URL" ]; then
  echo "ERROR: set NGROK_URL to your public ngrok https URL first." >&2
  echo "  e.g. NGROK_URL=https://abc123.ngrok-free.app bash $0" >&2
  exit 1
fi

# DB connection from .env
DB_URL=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
[ -z "$DB_URL" ] && { echo "ERROR: DATABASE_URL not found in .env" >&2; exit 1; }

# Secret used to hash ingest tokens (must match what the server runs with).
SECRET="${INGEST_TOKEN_SECRET:-}"
if [ -z "$SECRET" ]; then
  SECRET=$(grep -E '^ENCRYPTION_KEY=' .env | sed 's/^ENCRYPTION_KEY=//; s/^"//; s/"$//')
fi
[ -z "$SECRET" ] && { echo "ERROR: no INGEST_TOKEN_SECRET or ENCRYPTION_KEY available" >&2; exit 1; }

# Generate token + its keyed hash exactly like src/lib/streaming/ingest-token.ts
read TOKEN HASH < <(SECRET="$SECRET" node -e '
const crypto=require("crypto");
const s=process.env.SECRET;
const t="edge_"+crypto.randomBytes(32).toString("base64url");
const h=crypto.createHmac("sha256",s).update(t).digest("base64url");
process.stdout.write(t+" "+h);
')

LOT=$(psql "$DB_URL" -tAc "SELECT id FROM parking_lots LIMIT 1;")
[ -z "$LOT" ] && { echo "ERROR: no parking lot found — run 'npm run db:seed' first" >&2; exit 1; }

CAM_ID="edge-${STREAM_KEY}"
psql "$DB_URL" -v ON_ERROR_STOP=1 >/dev/null <<SQL
DELETE FROM cameras WHERE id = '${CAM_ID}' OR "mediaMtxPath" = '${STREAM_KEY}';
INSERT INTO cameras (id, "parkingLotId", name, "rtspUrl", "mediaMtxPath", "sourceMode",
                     "ingestTokenHash", "isActive", status, "createdAt", "updatedAt",
                     "reconnectCount", "hasIR", "hasPTZ", "coverageSlots")
VALUES ('${CAM_ID}', '${LOT}', '${CAM_NAME}', 'rtsp://edge-pushed', '${STREAM_KEY}',
        'EDGE_PUSH', '${HASH}', true, 'OFFLINE', now(), now(), 0, false, false, 10);
SQL

OUT="edge-agent/friend-config.yaml"
cat > "$OUT" <<YAML
# SParking Edge Agent config — generated $(date -Iseconds)
# Give this file (and the matching binary) to the person on-site.
# EDIT camera.rtsp to their actual camera URL before running.

cameraId: ${CAM_ID}

camera:
  name: ${CAM_NAME}
  # >>> REPLACE with the real CCTV RTSP URL on the LOCAL network <<<
  rtsp: ${RTSP_URL}

cloud:
  publish: ${NGROK_URL}/api/edge/ingest/${STREAM_KEY}/index.m3u8
  token: ${TOKEN}

ffmpeg:
  binary: ffmpeg
  transcode: auto

log:
  level: info
YAML

echo "=============================================================="
echo " Edge camera provisioned"
echo "=============================================================="
echo "  Camera ID : ${CAM_ID}"
echo "  Stream key: ${STREAM_KEY}"
echo "  Ingest URL: ${NGROK_URL}/api/edge/ingest/${STREAM_KEY}/index.m3u8"
echo ""
echo "  Config written to: ${OUT}"
echo ""
echo "  SEND TO YOUR FRIEND:"
echo "    1. ${OUT}   (they must edit camera.rtsp)"
echo "    2. the right binary from edge-agent/bin/ for their OS"
echo ""
echo "  NOTE: this config contains a live token — send it privately."
echo "=============================================================="
