# Edge Agent — Integration Contract

How any portal, dashboard, or backend integrates with the SParking Edge Agent.
The agent is **portal-agnostic**: it publishes video over a standard outbound
HTTP transport and exposes a small local API for discovery and control. Nothing
here is specific to any one portal.

There are two integration surfaces:

1. **Video (data plane)** — how live video leaves the agent and reaches a viewer.
2. **Local control/discovery (control plane)** — how software on the *same host*
   reads state and drives the agent.

---

## 1. Video delivery — HLS over HTTP PUT (outbound)

The agent's `ffmpeg` pulls each camera's RTSP stream and **uploads HLS** to a
cloud ingest endpoint using HTTP `PUT` (and `DELETE` for expiring segments).

- **Direction:** outbound only. The agent never listens for inbound video.
- **Target:** a per-camera publish URL of the shape
  `<base>/api/edge/ingest/<streamKey>/index.m3u8` (the base and route are whatever
  the ingest deployment uses; the agent only needs the full URL).
- **Auth:** a per-camera Bearer token, sent as `Authorization: Bearer <token>` on
  every upload.
- **Media:** 2-second HLS segments, 6-segment sliding window. Video is `copy`
  (H.264 source) or transcoded to H.264 (H.265 source); audio is AAC.
- **Playback:** whatever serves those uploaded HLS files back to viewers does so
  as ordinary `GET` of `index.m3u8` + `.ts` segments. Playback is **credential-
  free** — the RTSP credentials never reach the viewer.

**What a portal must provide to integrate video:** an HTTP(S) endpoint that
accepts the `PUT`/`DELETE` uploads for a stream key and serves the same files
back over `GET`. Any static file server, object store with an HTTP front, or app
route that does this works. The agent does not care how segments are stored.

```
Camera --RTSP/TCP--> Edge Agent --HTTP PUT (Bearer)--> your ingest --HTTP GET--> viewer
```

---

## 2. Local control & discovery API

The worker exposes a small HTTP API **bound to `127.0.0.1` only**, protected by a
**per-run Bearer token**. It is for software running on the same machine (the
bundled GUI, or a site-local integration/agent). It is **not** an
Internet-facing API and must not be exposed publicly.

**Connecting:** on start, the worker writes `control.json` (mode `0600`) into its
app directory containing `{ "addr": "127.0.0.1:PORT", "token": "ctl_..." }`. A
local integrator reads that file and sends `Authorization: Bearer <token>` on
every request.

App directory:
- Windows `%APPDATA%\SParking`
- macOS `~/Library/Application Support/SParking`
- Linux `~/.config/sparking` (honours `XDG_CONFIG_HOME`)

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/streams` | **Portal-facing discovery list** — safe, credential-free camera/feed inventory (see below) |
| GET | `/states` | Full per-camera runtime snapshot (richer; also credential-free) |
| GET | `/health` | Structured health with per-status camera counts (`ok`/`degraded`) |
| GET | `/version` | Agent, schema, and ffmpeg versions |
| GET | `/diagnostics` | Current states + version (`?history=true` adds bounded history) |
| GET | `/diagnostics/bundle` | Support ZIP (redacted config + log tails + manifest) |
| GET | `/events` | Server-Sent Events stream of runtime events |
| POST | `/camera/{id}/start` | Start one camera |
| POST | `/camera/{id}/stop` | Stop one camera |
| POST | `/start-all` | Start all enabled cameras |
| POST | `/stop-all` | Stop all cameras |

### `GET /streams` — the recommended portal entry point

Returns the minimal, stable, **credential-free** descriptor a dashboard needs to
list and render feeds. It deliberately contains **no** RTSP URL, camera
credentials, ingest token, or stream key.

```json
{
  "generatedAt": "2026-09-08T12:00:00Z",
  "agent": "1.4.0",
  "hostname": "site-01",
  "streams": [
    {
      "cameraId": "cam-01",
      "name": "Front Entrance",
      "group": "Entrance",
      "status": "ONLINE",
      "available": true,
      "healthScore": 100,
      "videoCodec": "h264",
      "resolution": "1920x1080",
      "reconnectCount": 0,
      "lastSeen": "2026-09-08T11:59:58Z"
    }
  ]
}
```

- `status` is the agent's fine-grained state (`IDLE`, `CONNECTING`, `ONLINE`,
  `OFFLINE`, `RECONNECTING`, `STALLED`, `STOPPED`, `FAILED`).
- `available` is `true` only when `status == ONLINE` (the feed is live now).
- To locate the actual playable HLS for a camera, a portal maps the camera to its
  ingest playback URL on its own side (the agent does not expose the stream key,
  which is a publish credential). The camera identity (`cameraId`) is the join
  key between the agent's discovery list and the portal's own camera records.

### Security rules for integrators

- **Never** relay the control token or `control.json` off the host.
- The browser must receive only credential-free HLS URLs — never RTSP URLs,
  camera passwords, ingest tokens, or the control token.
- Keep the control API local. If remote control is needed, put an authenticated
  server in front of it on the host — do not bind the agent's API to a public
  interface.

---

## 3. Scaling model (how a portal should think about many cameras)

- **One agent process** runs many cameras, each as an independent goroutine +
  ffmpeg child, with isolated failure/reconnect. Orchestration overhead is small
  and scales roughly linearly (validated to 10,000 cameras in a synthetic
  orchestration test — *not* 10,000 live encoders; see `resilience.md`).
- **Real live capacity per host is bounded by physical limits** — ffmpeg CPU
  (especially H.265→H.264 transcode), upload bandwidth (~2–4 Mbps per 1080p
  stream), and cloud ingest capacity — not by the agent's orchestration.
- **Horizontal scaling:** for camera counts or bandwidth beyond one host, run
  **multiple agents** (per site, or sharded by camera group). Each agent is fully
  independent and needs no coordination. A portal aggregates their `/streams`
  lists by `cameraId`.
- **Startup ramp** is bounded by `maxConcurrentStarts`; **reconnect storms** are
  spread by `backoffJitterPct` — so a fleet recovering together does not stampede
  the ingest. Both are configurable (see `edge-config-format.md`).

### Portal-side load guidance

- `/states` grows ~1 KB per camera (≈5 MB at 10k). Prefer `/streams` (smaller)
  for listing, poll at a sane interval, and do not hold the full snapshot in a
  hot loop. For very large fleets, page/filter on the portal side.
- Don't auto-play every feed. Lazy-load video on selection/visibility, and tear
  down players for hidden/offline cameras.
