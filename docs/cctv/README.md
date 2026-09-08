# CCTV Streaming Module

Live CCTV streaming for SParking: RTSP cameras → MediaMTX → **credential-free**
HLS (primary) / WebRTC (optional) → browser. The backend registers each camera
as a *pull path* on MediaMTX; the browser only ever receives credential-free
playback URLs. A decoupled health worker tracks liveness and writes a connection
log.

## The security invariant

> RTSP usernames/passwords live ONLY in the database (encrypted) and are used
> ONLY server-side to configure MediaMTX. The browser receives an HLS/WebRTC
> playback URL, **never** RTSP credentials.

## Document index

| Doc | What it covers |
|-----|----------------|
| [architecture.md](architecture.md) | Components, data flow, sequence diagrams, design decisions |
| [api.md](api.md) | Every endpoint: method, auth, request, response, errors |
| [env.md](env.md) | Environment variables reference |
| [deployment.md](deployment.md) | Running the stack, MediaMTX config, the health worker, security |
| [edge-agent.md](edge-agent.md) | Phase 2 on-site Edge Agent (cameras behind NAT/CGNAT) |
| [operations.md](operations.md) | Edge Agent operations runbook: self-heal, health/diagnostics, support bundle, restart/power-loss recovery |
| [resilience.md](resilience.md) | Phase 2.6 resilience verification: disk-full, concurrency, scale, soak + chaos harnesses, and the 2 bugs found |
| [runtime-api.md](runtime-api.md) | Supervisor stable API + local control API (health/version/diagnostics/bundle) |
| [edge-agent-integration-contract.md](edge-agent-integration-contract.md) | How ANY portal/dashboard integrates: video (HLS-over-HTTP-PUT) + local discovery/control API (`/streams`) + scaling model |
| [recovery.md](recovery.md) | Failure modes and how the system recovers; runbook |
| [future-architecture.md](future-architecture.md) | Phase 1–4 roadmap; provider seams for recording/AI/edge/cluster |

## Code map

```
src/lib/streaming/
  providers.ts               interfaces: StreamProvider (+ Recording/Detection/Notification seams)
  mediamtx-client.ts         low-level MediaMTX control-API client (:9997)
  mediamtx-provider.ts       StreamProvider impl backed by MediaMTX
  rtsp-url.ts                credential-encoding RTSP URL builder + redaction
  events.ts                  in-process stream-event bus (→ Socket.IO, future AI/recording)
  config.ts                  env + getStreamProvider() factory
  camera-stream.service.ts   register/unregister/playback orchestration for API routes
  camera-health.service.ts   decoupled liveness poller (start/stop lifecycle)
src/workers/camera-health.ts bootstrap entrypoint (Next instrumentation today; standalone later)
src/app/api/cameras/[id]/playback/route.ts   credential-free playback URLs
src/app/api/cameras/[id]/logs/route.ts        connection logs
src/components/camera/HlsPlayer.tsx           hls.js player
src/components/camera/LiveCameraView.tsx      live view (HLS default + WebRTC toggle)
docker/mediamtx/mediamtx.yml                  hardened media-server config

# Phase 2 — Edge push (cameras behind NAT/CGNAT)
src/lib/streaming/edge-provider.ts            StreamProvider for pushed HLS (health by freshness)
src/lib/streaming/ingest-store.ts             path-guarded + atomic HLS segment store
src/lib/streaming/ingest-token.ts             per-camera token gen/hash/verify
src/app/api/edge/ingest/[...path]/route.ts    authed upload + credential-free playback
src/app/api/cameras/[id]/ingest-token/route.ts   issue/revoke a camera's ingest token
edge-agent/                                   Go on-site agent (ffmpeg HLS-over-HTTP-PUT)
scripts/edge-e2e.sh                           local edge validation
```

## Quick start (local, with the simulated camera)

```bash
# 1. Bring up the media server + a simulated H.264 camera
docker compose up -d mediamtx
docker compose --profile simulate up -d simulate-camera

# 2. Start the app (health worker on)
CAMERA_HEALTH_WORKER_ENABLED=true npm run dev

# 3. Register a camera whose path is the simulated stream, e.g. via the
#    dashboard (rtspUrl rtsp://<pub>@mediamtx:8554/cam-sim, mediaMtxPath cam-sim),
#    then open the camera in the dashboard → live HLS plays.
```

See [deployment.md](deployment.md) for the full runbook and production notes.
