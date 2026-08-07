# CCTV Failure Modes & Recovery

How the system behaves under each failure, and the operator runbook.

> **Edge Agent operators:** for the site-side runbook — self-heal behaviors,
> `/health` and `/diagnostics`, the support bundle, and restart/power-loss
> recovery — see [operations.md](operations.md).

## Automatic recovery

| Failure | Behavior | Recovery |
|---------|----------|----------|
| Camera drops offline | MediaMTX path not `ready`; health worker flips status → OFFLINE, logs `DISCONNECTED`, emits `camera.offline`. | When the camera returns, MediaMTX re-pulls; next poll flips → ONLINE, logs `CONNECTED`, increments `reconnectCount`. |
| MediaMTX restarts | Paths are re-created on demand: create/update/playback all call `register` (idempotent). | First `/playback` (or next CRUD) re-registers the path. Health worker reconciles status. |
| App server restarts | In-process health worker restarts via instrumentation; paths persist in MediaMTX config or are re-registered on next `/playback`. | Automatic. |
| Media server unreachable during CRUD | Register/unregister are best-effort: the CRUD request still succeeds; a warning is logged. | Health worker + next `/playback` reconcile once MediaMTX is back. |
| Browser network blip | `HlsPlayer` shows buffering; hls.js recovers non-fatal errors; fatal → error state with Retry. | Automatic (hls.js) or user clicks Retry / component refetches `/playback`. |
| **Edge**: camera/network drops at the site | Agent's ffmpeg exits; agent logs `disconnected`. Playlist stops updating → goes stale → health worker flips OFFLINE. | Agent probes + reconnects with exponential backoff; when it republishes, the playlist freshens and the worker flips ONLINE (reconnect counted). |
| **Edge**: agent process killed | No more uploads; playlist goes stale → OFFLINE. | Restart the agent (use systemd `Restart=always` — see edge-agent.md). |
| **Edge**: token revoked/rotated | Uploads start returning 401; stream goes stale → OFFLINE. | Re-issue the token and update the agent's `config.yaml`. |

## Runbook

### A camera shows OFFLINE but the camera is up

1. Check reachability: `POST /api/cameras/{id}/probe` → look at `message`.
   - `probe failed: …` → the **server** cannot reach the camera's RTSP. Check
     network path, IP/port, firewall. (Camera on a different subnet is the
     classic cause — see future-architecture.md §NAT.)
   - `probe ok` but still OFFLINE → MediaMTX/credentials issue (next steps).
2. Check the connection log: `GET /api/cameras/{id}/logs`.
3. Verify credentials: passwords with `@`/`:` must be handled by the encoder —
   the module URL-encodes them (`rtsp-url.ts`); a manually-entered full `rtspUrl`
   is trusted as-is, so a bad manual URL is a common cause.
4. Check MediaMTX: is the control API reachable from the app
   (`MEDIAMTX_CONTROL_URL`)? Is the path present
   (`GET {control}/v3/paths/get/{path}`)?

### HLS won't play in the browser

1. Confirm `/playback` returns an `hlsUrl` and that the URL is reachable **from
   the browser** (not just the server) — a common misconfig is
   `MEDIAMTX_HLS_BASE` pointing at the internal service name.
2. Open the `hlsUrl` directly; a 401/403 means the MediaMTX reader auth or proxy
   is blocking playback.
3. Safari uses native HLS; other browsers use hls.js. Check the console for HLS
   fatal errors.

### Health worker not updating status

1. Confirm `CAMERA_HEALTH_WORKER_ENABLED=true` on the instance and check startup
   logs for `CameraHealthService started`.
2. Ensure only ONE instance runs it (or a dedicated worker) — see deployment.md.
3. Verify the app can reach `MEDIAMTX_CONTROL_URL`.

## Diagnostics quick reference

```bash
# Is the control API reachable from the app container?
curl -s $MEDIAMTX_CONTROL_URL/v3/paths/list | head

# Is a specific path live?
curl -s $MEDIAMTX_CONTROL_URL/v3/paths/get/<path>

# Probe a camera on demand
curl -X POST -b "auth-token=<jwt>" http://localhost:3000/api/cameras/<id>/probe
```
