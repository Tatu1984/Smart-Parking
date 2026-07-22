# CCTV API Reference

All endpoints require authentication (`getAuthUser`: JWT cookie for web, Bearer
for mobile) and enforce organization isolation via `checkParkingLotAccess`
(SUPER_ADMIN bypasses). Responses use the standard envelope
`{ success, data | error }`.

---

## GET `/api/cameras/[id]/playback`

Returns **credential-free** playback URLs. Ensures the MediaMTX path is
registered first (idempotent), so playback works even if the camera was created
while the media server was down.

- **Auth:** required · org-scoped
- **Request:** no body
- **Response 200:**

```json
{
  "success": true,
  "data": {
    "cameraId": "clx…",
    "path": "clx…",
    "status": "ONLINE",
    "hlsUrl": "http://localhost:8888/clx…/index.m3u8",
    "webrtcUrl": "http://localhost:8889/clx…",
    "primary": "hls"
  }
}
```

- **Errors:** `401` unauthorized · `403` forbidden (other org) · `404` camera not found · `500`
- **Notes:** RTSP credentials are never present in the response. If MediaMTX is
  unreachable, the URLs are still returned (best-effort) and the player retries.

---

## GET `/api/cameras/[id]/logs?limit=50`

Camera connection log (connect/disconnect/register/error), newest first.

- **Auth:** required · org-scoped
- **Query:** `limit` (default 50, max 200)
- **Response 200:** `data: [{ id, cameraId, eventType, message, createdAt }]`
  - `eventType` ∈ `CONNECTED | DISCONNECTED | REGISTERED | UNREGISTERED | NETWORK_ERROR | ERROR`
- **Errors:** `401 · 403 · 404`

---

## POST `/api/cameras/[id]/probe`

Lightweight RTSP reachability + codec probe (FFprobe). Updates status /
resolution / fps and writes a connection-log row.

- **Auth:** required
- **Response 200:** `data: { status, resolution?, fps?, codec?, message }`
- **Errors:** `400` no RTSP URL · `401 · 404 · 500`
- **Notes:** requires `ffprobe` on the server. Complements the health worker
  (on-demand vs. periodic).

---

## Camera CRUD (existing routes, now stream-aware)

These pre-existing endpoints now also orchestrate the media server. Behavior and
auth are unchanged except where noted.

| Endpoint | Streaming side effect |
|----------|-----------------------|
| `POST /api/cameras` | Registers the MediaMTX pull path (best-effort). |
| `PATCH /api/cameras/[id]` | Re-registers when `rtspUrl`/`username`/`password`/`mediaMtxPath` change. |
| `DELETE /api/cameras/[id]` | Unregisters the path before delete (best-effort, never blocks delete). |

"Best-effort" means a media-server outage is logged but does not fail the CRUD
request — the health worker reconciles once the server is reachable.

---

## Removed

- ~~`GET/DELETE /api/cameras/[id]/stream`~~ (MJPEG-over-FFmpeg proxy) — **removed**.
  Replaced by `/playback` (HLS/WebRTC). The client helper `getCameraStreamUrl`
  is replaced by `getCameraPlayback` / `getCameraLogs` / `probeCamera` in
  `src/services/camera.service.ts`.

## Optional WebRTC path

`GET/POST/PATCH/DELETE /api/metro/streams/[id]/webrtc` remains as the optional
low-latency WebRTC/WHEP path on the same MediaMTX path. `LiveCameraView` uses it
only when the viewer toggles WebRTC.
