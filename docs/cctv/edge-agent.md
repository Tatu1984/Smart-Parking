# Edge Agent (Phase 2 — cameras behind NAT/CGNAT)

The Edge Agent runs **on-site** at a parking facility and publishes a camera's
video to SParking's cloud, so cameras on private networks the server can't reach
inbound (NAT, CGNAT) can still be viewed centrally.

## Why this exists

A camera on a remote LAN has a private IP the cloud cannot connect to inbound —
NAT drops it, and CGNAT makes port-forwarding impossible. The rule that always
works: **the site reaches OUT to us.** The agent does exactly that.

## How it works

```mermaid
flowchart LR
  subgraph Site["Remote parking site (NAT/CGNAT)"]
    CAM["Camera (RTSP)"] --> AGENT["Edge Agent\nffmpeg: pull RTSP,\nwrite HLS, PUT segments"]
  end
  AGENT -->|"HTTPS PUT (outbound)"| INGEST["SParking /api/edge/ingest\n(per-camera Bearer token)"]
  INGEST --> STORE["HLS segments on disk"]
  STORE -->|"credential-free GET"| BROWSER["Browser (HlsPlayer)"]
  WORKER["Health worker"] -->|"playlist freshness"| STORE
```

- **Transport: HLS-over-HTTP-PUT.** ffmpeg pulls the local RTSP and uploads HLS
  segments via HTTP PUT to our ingest endpoint. Outbound HTTP only — rides any
  HTTPS reverse proxy/tunnel, traverses NAT/CGNAT, needs no public IP, no
  WebRTC/UDP/TURN. (This is the design the CCTV reference project landed on after
  WHIP failed behind NAT — see [future-architecture.md](future-architecture.md).)
- **Credentials never leave the site**: the RTSP username/password stay in the
  agent's local config; the browser gets a credential-free HLS URL.
- **Per-camera auth**: each edge camera has its own Bearer token; the ingest maps
  token → camera → org.

## Two ways to run it

| | Desktop app (Windows/macOS) | Headless binary (Linux/servers) |
|---|---|---|
| For | A person at the site with a normal PC | An always-on mini-PC / Raspberry Pi |
| UI | GUI control panel: settings, Start/Stop, status, logs | `config.yaml` + terminal/systemd |
| Autostart | Checkbox in the GUI | systemd unit (see below) |
| Build | `make windows` / `make macos` | `make build` / `make cross` |

### Desktop app (recommended for a non-technical site contact)

The package contains **two** binaries that work together:

- **`edge-agent-gui`** — the control panel the user opens. Settings form
  (camera RTSP, portal ingest URL, token), **Start/Stop** buttons, live status,
  activity log, and an "start automatically" checkbox.
- **`edge-agent`** — the background worker that actually streams. It is a
  *separate process*: closing the control panel window does **not** stop
  streaming; only the Stop button does.

Both read the same config file, so there is no IPC to go wrong:

| OS | Config + log location |
|----|------------------------|
| Windows | `%APPDATA%\SParking\config.yaml` · `agent.log` |
| macOS | `~/Library/Application Support/SParking/` |
| Linux | `~/.config/sparking/` |

Autostart uses each platform's native mechanism — Startup-folder entry
(Windows), LaunchAgent (macOS), `systemd --user` unit (Linux).

**Building the packages:**

```bash
cd edge-agent
make windows     # cross-compiles from Linux (needs mingw-w64); output: build/windows/dist/
make macos       # MUST run on a Mac (Apple SDK); output: build/macos/dist/
```

Each `dist/` contains the binaries, an installer, and an end-user README.
Give the site contact that folder (zipped) plus their config values.

> **macOS note:** an unsigned build triggers Gatekeeper — the user must
> right-click → Open once. For wider distribution, sign + notarize (commands are
> printed at the end of `build-macos.sh`).

### Headless (Linux)

Prereqs: `ffmpeg` on the box (`apt install ffmpeg`). A small Linux mini-PC or
Raspberry Pi is plenty.

1. **Issue an ingest token** (in SParking, ADMIN):
   `POST /api/cameras/<id>/ingest-token` → returns `{ token, streamKey, ingestUrl }`
   **once**. This flips the camera to `sourceMode = EDGE_PUSH`.
2. **Build the agent** (or copy a prebuilt binary):
   ```bash
   cd edge-agent && make build        # or: make cross  (amd64 / arm64 / armv7)
   ```
3. **Write `config.yaml`** (copy `config.example.yaml`):
   ```yaml
   cameraId: <camera id>
   camera:
     name: Mall Entrance 2
     rtsp: rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101
   cloud:
     publish: https://app.example.com/api/edge/ingest/<streamKey>/index.m3u8
     token: <token from step 1>
   ffmpeg:
     transcode: auto   # copy H.264, transcode H.265→H.264
   ```
4. **Run it** (supervise it with systemd in production):
   ```bash
   ./bin/edge-agent --config config.yaml
   ```

The agent probes the camera, publishes continuously, and **auto-reconnects with
exponential backoff** if the camera or network drops. Within one health-poll
interval the camera shows **ONLINE** in the dashboard and plays via HLS.

### Run as a systemd service (production)

```ini
# /etc/systemd/system/sparking-edge-agent.service
[Unit]
Description=SParking Edge Agent
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/opt/sparking/edge-agent --config /opt/sparking/config.yaml
Restart=always
RestartSec=5
User=sparking

[Install]
WantedBy=multi-user.target
```

## Configuration reference

| Key | Required | Notes |
|-----|----------|-------|
| `cameraId` | no | Informational (which SParking camera this feeds). |
| `camera.rtsp` | **yes** | Local RTSP URL (may embed credentials). Pulled over TCP. |
| `cloud.publish` | **yes** | Ingest URL ending in `.../index.m3u8`. |
| `cloud.token` | **yes** | Per-camera Bearer token from the ingest-token endpoint. |
| `ffmpeg.binary` | no | Defaults to `ffmpeg`. |
| `ffmpeg.transcode` | no | `auto` (default) \| `copy` \| `h264`. |
| `log.level` | no | `debug` \| `info` (default) \| `warn` \| `error`. |

## Security

- The token is sent as `Authorization: Bearer …` on every upload; the server
  stores only a keyed hash (a DB leak alone can't forge tokens) and compares in
  constant time.
- The ingest endpoint blocks path traversal and rejects non-HLS file extensions.
- Playback is credential-free by design; authorization for *who gets the URL*
  stays at the app layer. (Short-lived scoped playback tokens are a later
  hardening — see [future-architecture.md](future-architecture.md) §Phase 2C.)
- Rotate a token by re-issuing (`POST …/ingest-token`); revoke with
  `DELETE …/ingest-token`.

## Local validation (no remote site)

`scripts/edge-e2e.sh` builds the agent and points it at the Phase-1 simulated
camera, publishing to your local ingest. See the script header for prereqs.

## Troubleshooting

- **Desktop app: Start does nothing / "worker binary not found"** → the GUI
  expects `edge-agent(.exe)` next to it in the install directory. Re-run the
  installer rather than copying just the GUI.
- **Desktop app: status stays "Stopped"** → open the activity log at the bottom
  of the window; it shows the worker's own error (usually ffmpeg missing or the
  camera unreachable).
- **Linux GUI build fails to link (`cannot find -lXxf86vm`)** → install the X11
  dev headers: `sudo apt install libgl1-mesa-dev xorg-dev libxxf86vm-dev`.
  (Only affects building the GUI *on Linux*; Windows/macOS builds are unaffected.)
- **Agent logs "source not reachable"** → the box can't reach the camera's RTSP.
  Check IP/port/credentials on the *local* network.
- **Uploads 401** → wrong/expired token, or the camera isn't `EDGE_PUSH`. Re-issue.
- **Camera stays OFFLINE but agent is publishing** → check the health worker is
  running (`CAMERA_HEALTH_WORKER_ENABLED=true`) and `EDGE_FRESHNESS_MS` isn't
  shorter than the segment duration.
- **HLS won't play in the browser** → confirm `EDGE_INGEST_PUBLIC_BASE` is
  reachable from the browser (a public host in prod, not an internal name).
