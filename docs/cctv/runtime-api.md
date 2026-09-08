# Edge Agent — Supervisor Runtime API

The `Supervisor` is the central runtime service of the Edge Agent. It owns all
cameras' publishers and is the **single source of truth for runtime state**.
Future components — the GUI, a CLI, remote fleet management, AI services — build
against the **stable API** below and must not depend on anything outside it.

Package: `edge-agent/internal/publisher`.

---

## Stable API

These methods are the supported contract. Their signatures and guarantees will
not change without a version bump + migration notes.

| Method | Purpose | Guarantee |
|--------|---------|-----------|
| `StartCamera(id string)` | Start one camera | Idempotent (no-op if running/unknown); starts a fresh per-camera context |
| `StopCamera(id string)` | Stop one camera | Idempotent; **blocks until the ffmpeg child is terminated + reaped** (no orphan); leaves other cameras untouched |
| `StartAll()` | Start all **enabled** cameras | Skips disabled; idempotent per camera |
| `StopAll()` | Stop all running cameras | Idempotent; each stop is isolated |
| `States() []StateSnapshot` | Snapshot of every camera's runtime state | Consistent, lock-guarded copy; safe under concurrency |
| `Events(bufSize int) (<-chan Event, func())` | Subscribe to runtime events | Buffered; **never blocks the engine** — drops oldest on a full/slow subscriber; returns an unsubscribe func |
| `IsRunning(id string) bool` | Whether a camera's publisher goroutine is active | Lock-guarded |

Everything else in the package (`managed`, `eventBus`, `startLocked`,
`recordTransition`, ring buffers, etc.) is **internal implementation detail** —
do not call it from other components.

### Lifecycle & threading rules

- `NewSupervisor(cfg, log, audit)` builds the managed publishers (does not start them).
- `Run(ctx)` sets the root context, starts every **enabled** camera (runtime is
  reconstructed from config — see below), and blocks until `ctx` is cancelled,
  then stops everything.
- All control methods are safe to call concurrently with `Run` and with each
  other.
- **Do not call Fyne/UI code from an `Events()` consumer goroutine** — marshal to
  the UI thread (the GUI polls `States()` on the main thread; Events is for
  non-UI consumers or must hop threads).

---

## Runtime state reconstruction (persistence policy)

**Configuration is the only persisted state. Transient runtime state is never
persisted; it is reconstructed on startup.**

- On `Run`, every camera with `enabled: true` starts (→ `CONNECTING`). Disabled
  cameras stay stopped.
- To keep a camera stopped across restarts, **disable it** (`enabled: false`).
  A camera merely *stopped* at runtime while still enabled will start again next
  launch. `enabled` is the single, unambiguous source of intent — nothing to
  recover after a crash.

---

## Status state machine

```
IDLE ─► CONNECTING ─► ONLINE ─┐
          ▲                   │ (ffmpeg exits)
          │                   ▼
       OFFLINE ◄──────── RECONNECTING
                             │
                             ▼ (ctx cancel)
                          STOPPED
   FAILED = permanent (invalid config at construction)
```

---

## Events

`Event{Type, CameraID, Name, At, Detail}`. Types:

| Type | When |
|------|------|
| `camera.started` | operator/startup started the camera |
| `camera.stopped` | operator stopped the camera |
| `camera.online` | ffmpeg began publishing |
| `camera.offline` | source became unreachable |
| `camera.reconnect` | ffmpeg exited; retrying |
| `camera.failed` | permanent failure (bad config) |

**Delivery guarantee:** each subscriber has its own buffered channel. If a
subscriber falls behind and its buffer fills, the **oldest** event is dropped
(newest-wins) — publishing an event **never blocks** a publisher goroutine, so
event delivery can never stall streaming. If you need every event, drain
promptly and size the buffer for your peak.

---

## Runtime state (`StateSnapshot`)

Returned by `States()`. Stable fields:

`CameraID`, `Name`, `Group`, `Capabilities`, `Status`, `Detail`, `LastError`,
`HealthScore`, `ReconnectCount`, `StartedAt`, `LastSeenAt`, `LastChangeAt`,
`VideoCodec`, `Resolution`.

Reserved (zero until later phases populate): `FPS`, `BitrateKbps`,
`RecordingStatus`, `AIStatus`, `EdgeLatencyMs`.

### Capabilities

`Capabilities{SupportsPTZ, SupportsAudio, SupportsRecording, SupportsAI}` —
optional feature **hints** (config/portal-provided, not auto-detected in v1) so
future features can be gated without changing the data model. All default false.

### Health score (v1 heuristic)

`HealthScore` is 0–100. **This is a deliberately simple v1 formula, meant to be
refined later (e.g. by AI/ops):**

- `FAILED` → 0 · `OFFLINE` → 20 · `RECONNECTING` → 40 · `IDLE`/`STOPPED` → 100
  (not running is not "unhealthy").
- `ONLINE`/`CONNECTING`: start at 100, subtract 8 per reconnect in the last 10
  minutes, floored at 30.

Treat it as a relative indicator, not a calibrated SLA metric.

### History (diagnostics)

`CameraState.History()` returns bounded, in-memory (not persisted) recent
history: last 10 reconnect times, last 20 status transitions, last 20 bitrate
samples. For a details/diagnostics view.

---

## Local control API (GUI ↔ worker IPC)

The GUI is a **separate process** from the streaming worker (so closing the GUI
keeps streaming). It reaches the worker's Supervisor through a small HTTP API the
worker exposes, mapping 1:1 onto the stable API:

```
GET  /states                     → []StateSnapshot
GET  /streams                    → credential-free portal discovery list (see integration contract)
GET  /events (SSE)               → runtime events
GET  /health                     → structured operational summary (see below)
GET  /version                    → agent/schema/ffmpeg versions
GET  /diagnostics                → current camera states + version
GET  /diagnostics?history=true   → + per-camera bounded history (opt-in)
GET  /diagnostics/bundle         → support zip (redacted config, log tails, manifest)
POST /camera/{id}/start
POST /camera/{id}/stop
POST /start-all
POST /stop-all
```

### `GET /health` (Phase 2.5)

At-a-glance operational summary with a per-status camera breakdown. `status` is
`"degraded"` if any camera is `FAILED`, `OFFLINE`, or `STALLED`, else `"ok"`.

```json
{
  "status": "degraded",
  "agent": "1.4.0",
  "schemaVersion": 1,
  "uptimeSeconds": 3600,
  "ffmpeg": "6.0",
  "ffmpegPath": "/usr/bin/ffmpeg",
  "hostname": "site-01",
  "cameras": { "total": 30, "online": 27, "reconnecting": 1,
               "stalled": 0, "offline": 2, "failed": 0, "idle": 0 }
}
```

### `GET /version` (Phase 2.5)

```json
{ "agent": "1.4.0", "schemaVersion": 1, "ffmpeg": "6.0", "os": "linux", "arch": "amd64" }
```

### `GET /diagnostics` (Phase 2.5)

Returns `{generatedAt, version, cameras: []StateSnapshot}`. Add `?history=true`
to include `history: {cameraId → {reconnects, transitions, bitrate}}`. History is
**opt-in** because it is larger and only needed when investigating an incident.

### `GET /diagnostics/bundle` (Phase 2.5)

Streams a `.zip` support bundle. **Never contains secrets** — the config is
redacted (tokens, stream keys, and URL credentials stripped). Contents:

- `config.redacted.yaml` — config with all secrets masked as `***REDACTED***`
- `diagnostics.json` — current camera states
- `system-info.txt` — os/arch/uptime/ffmpeg/goroutines
- `agent.log`, `audit.log` — last 256 KB of each (if present)
- `manifest.json` — `{bundleFormatVersion, agentVersion, schemaVersion,
  generatedAt, os, arch, hostname, contents[]}`

Redaction and the "no secrets" invariant are covered by security-critical unit
tests (`config.Redacted`, `diagbundle`) and the acceptance script.

### Error classification (Phase 2.5)

Every `StateSnapshot` carries an operator-facing failure category and remediation:

| Field | Meaning |
|-------|---------|
| `ErrorClass` | `bad-rtsp`, `auth`, `source-unreachable`, `ingest-unreachable`, `ingest-auth`, `ffmpeg-missing`, `codec`, or `unknown` (empty when healthy) |
| `ErrorHint` | Plain-language fix for that class (empty when healthy) |

Classification is derived from ffprobe/ffmpeg output; it is a hint for operators,
cleared automatically on the next successful publish.

**Security:** the server binds **strictly to 127.0.0.1** and requires a per-run
Bearer **token**. The worker writes its address + token to `control.json` (0600)
in the app dir; the GUI reads that to connect. This defends against other local
processes/users on a shared machine, not just remote access.

The worker publishes the endpoint on start and removes it on exit. If the file is
absent/stale, the GUI treats the worker as not running (falls back to
config-only editing).

## Group control (future)

`group` is on each camera and `groups` at the top level (see
[edge-config-format.md](edge-config-format.md)). Group-scoped control
(`StartGroup`/`StopGroup`) is a straightforward future addition over the existing
per-camera API and is **not yet part of the stable contract**.
