# CCTV Environment Variables

All optional in development (sensible defaults). In production, set the publish
credentials and the browser-facing bases explicitly.

| Variable | Default | Scope | Purpose |
|----------|---------|-------|---------|
| `MEDIAMTX_CONTROL_URL` | `http://mediamtx:9997` | server | MediaMTX control API. **Internal network only — never expose publicly.** |
| `MEDIAMTX_HLS_BASE` | `http://localhost:8888` | browser | Base for HLS playback URLs. In prod, a **public** hostname behind the reverse proxy. |
| `MEDIAMTX_ENDPOINT` | `http://localhost:8889` | browser | Base for WebRTC playback URLs. In prod, a **public** hostname. |
| `MEDIAMTX_PUBLISH_USER` | `sparking_pub` | server | Publisher username. Must match `MTX_PUBLISH_USER` in the MediaMTX config. |
| `MEDIAMTX_PUBLISH_PASS` | `change_me_publisher_secret` | server | Publisher password. **Change in production** (`openssl rand -base64 24`). |
| `MEDIAMTX_TIMEOUT_MS` | `5000` | server | Control-API request timeout. |
| `CAMERA_HEALTH_WORKER_ENABLED` | `false` (compose sets `true`) | server | Bootstrap the health worker in this process. Enable on exactly ONE instance. |
| `CAMERA_HEALTH_POLL_INTERVAL_MS` | `15000` | server | Health poll interval. |
| `WEBRTC_ICE_SERVERS` | `turn:localhost:3478` | server | ICE/TURN for WebRTC NAT traversal (optional path). |
| `TURN_USERNAME` / `TURN_PASSWORD` | `sparking` / `sparking_secret` | server | TURN credentials. Change in production. |

## Notes

- **`server` vs `browser` scope:** server vars are used only in Node (control
  API, credentials). Browser vars end up inside credential-free playback URLs
  returned to clients, so they must be resolvable from the user's browser — use
  public hostnames in production, not Docker service names.
- **Single health worker:** if you run multiple app replicas, set
  `CAMERA_HEALTH_WORKER_ENABLED=true` on only one, or run the worker as a
  dedicated process (see deployment.md §Workers), to avoid duplicate polling.
- **Encryption:** camera RTSP credentials are stored encrypted with
  `ENCRYPTION_KEY` (see the main `.env.example`). Required in production.
