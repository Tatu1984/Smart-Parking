# CCTV Deployment & Runbook

## Prerequisites

- Docker + Docker Compose (MediaMTX and the simulated camera run as services).
- The app server must be able to reach each camera's RTSP endpoint (same LAN or
  routable IP). Cameras behind NAT/CGNAT are Phase 2 — see future-architecture.md.
- `ffprobe` on the app host if you use the `/probe` endpoint.

## Bring up the stack

```bash
# Media server (control API :9997 is internal-only; HLS :8888, WebRTC :8889, RTSP :8554)
docker compose up -d mediamtx

# App (health worker enabled via env)
docker compose up -d app     # or: CAMERA_HEALTH_WORKER_ENABLED=true npm run dev
```

Set at minimum in production:

```
MEDIAMTX_PUBLISH_USER=…            # matches docker/mediamtx/mediamtx.yml
MEDIAMTX_PUBLISH_PASS=…            # openssl rand -base64 24
MEDIAMTX_HLS_BASE=https://media.example.com/hls
MEDIAMTX_ENDPOINT=https://media.example.com/webrtc
ENCRYPTION_KEY=…                   # for camera credential encryption
```

## MediaMTX config

`docker/mediamtx/mediamtx.yml` is mounted read-only into the container. It
defines three auth roles:

- **publisher** — pushes streams IN (backend/edge). Credentialed.
- **reader** — pulls HLS/WebRTC OUT. No password (credential-free URLs).
- **admin** — control API, restricted to private IP ranges (internal network).

The control API (`:9997`) is **not** host-published in compose — it is reachable
only on `sparking-network`. Do not add a host port mapping for it.

## Security checklist

- [ ] `MEDIAMTX_PUBLISH_PASS` changed from the default.
- [ ] Control API (`:9997`) not exposed to the host or the internet.
- [ ] Public HLS/WebRTC fronted by a reverse proxy with TLS.
- [ ] `ENCRYPTION_KEY` set (camera credentials encrypted at rest).
- [ ] Playback authorization enforced at the proxy (Phase 2C: short-lived
      per-view tokens — see future-architecture.md).

## The health worker

Bootstrapped in-process by `src/instrumentation.ts` when
`CAMERA_HEALTH_WORKER_ENABLED=true`. It runs `CameraHealthService`, which polls
MediaMTX and reconciles camera status/metrics/logs and emits Socket.IO events.

### Running it as a standalone worker (future)

`CameraHealthService` depends only on interfaces, so it can run as its own
process. The entrypoint `src/workers/camera-health.ts` exports
`startCameraHealthWorker()`. To split "API server" and "worker":

1. Disable the in-process worker on API replicas (`CAMERA_HEALTH_WORKER_ENABLED=false`).
2. Run one worker process that calls `startCameraHealthWorker()` (e.g. a small
   Node entry that imports the compiled module, or a dedicated compose service).

No changes to the service are required — this is the point of the decoupling.

## End-to-end verification (simulated camera)

```bash
docker compose up -d mediamtx
docker compose --profile simulate up -d simulate-camera   # publishes rtsp://…/cam-sim
```

Then create a camera with `mediaMtxPath = cam-sim` (or `rtspUrl` pointing at the
sim path) and open it in the dashboard. Expect: HLS plays, status flips to
ONLINE within one poll interval, a `CONNECTED` connection-log row appears.

## Rollback

The change is additive at the DB level (new nullable columns + one new table)
and replaces the MJPEG route/component. To roll back the app, redeploy the prior
build; the DB additions are harmless if unused. MediaMTX paths are recreated on
demand, so no media-server state needs cleanup.
