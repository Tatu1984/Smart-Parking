# Edge Agent — Runtime Architecture

A concise reference for the multi-camera Edge Agent engine (Phase 1), before the
GUI (Phase 2) begins depending on it. See also
[edge-agent.md](edge-agent.md) (operations) and
[edge-config-format.md](edge-config-format.md) (config/versioning).

## Runtime component map

```
Edge Agent (one OS process)
│
├── main            load+migrate config, resolve ffmpeg/ffprobe, build supervisor
│
├── Supervisor      owns all publishers; ctx-cancel fan-out; States() snapshot
│   ├── Publisher(cam-001) ── ffmpeg child ──► ingest (HLS-over-HTTP-PUT)
│   ├── Publisher(cam-002) ── ffmpeg child ──► ingest
│   ├── Publisher(cam-003) ── ffmpeg child ──► ingest
│   ├── ...
│   └── Publisher(cam-NNN) ── ffmpeg child ──► ingest
│
├── Per-Publisher (one per camera, fully independent)
│   ├── probe (ffprobe reachability + codec)
│   ├── ffmpeg supervise (start / watch / exit)
│   ├── backoff + reconnect (exponential, per-camera)
│   └── CameraState (status enum + metrics, mutex-guarded)
│
└── Shared services
    ├── config   (versioned; global ffmpeg/log + per-camera list)
    ├── ffmpeg   (path resolution, arg building, copy/transcode decision)
    └── logger   (slog; every camera line tagged cameraId + camera name)

Output ─► SParking ingest (or MediaMTX) ─► HLS ─► dashboard
```

## Concurrency model

- **One goroutine per camera.** Each runs `Publisher.Run(ctx)`: probe → ffmpeg →
  watch → backoff → reconnect, forever, until ctx is cancelled.
- **The heavy work is in OS child processes** (ffmpeg), not the Go heap. Cameras
  are I/O-bound from the agent's view, so goroutines are cheap.
- **No shared mutable state between publishers** → no locks on the hot path. The
  only mutex is inside each camera's own `CameraState` (one writer: its
  publisher; readers: snapshotters).
- **Fault isolation is structural:** a camera's failure, backoff, or ffmpeg crash
  lives entirely within its goroutine and never touches another's.
- **Shutdown:** ctx cancellation propagates to every publisher; the supervisor
  `WaitGroup`-joins them all before returning.

## Per-camera state machine

```
IDLE ─► CONNECTING ─► ONLINE ─┐
          ▲                   │ (ffmpeg exits)
          │                   ▼
       OFFLINE ◄──────── RECONNECTING
   (source unreachable)      │
                             ▼ (ctx cancel)
                          STOPPED
   FAILED = permanent (e.g. invalid config at construction)
```

`CameraState` also tracks: `reconnectCount`, `startedAt`, `lastSeenAt`,
`lastChangeAt`, probed `videoCodec`/`resolution`. Exposed via
`Supervisor.States()` for the GUI/status use in Phase 2.

## Identity & logging

- Every camera has a **stable `cameraId`** (from the portal), immutable and
  separate from the renamable display name.
- Every camera-scoped log line is tagged `cameraId=… camera="…"`. Supervisor-level
  lines (start/stop) are intentionally untagged.

---

## Stress & fault validation (measured 2026-08-06)

Harness: MediaMTX serving N test RTSP streams (ffmpeg `testsrc`, 640×360@15,
H.264) → the agent pulls all N and publishes (copy mode) to a local HTTP sink.
8-core Linux box. Goroutines read via the agent's optional pprof endpoint
(`EDGE_DEBUG_ADDR`); RSS/threads from `/proc`.

### Scaling (all cameras publishing)

| Cameras | Publishing | Agent RSS | OS threads | Goroutines |
|--------:|:----------:|----------:|-----------:|-----------:|
| 10 | 10/10 ✅ | 10 MB | 19 | 36 |
| 20 | 20/20 ✅ | 12 MB | 30 | 66 |
| 30 | 30/30 ✅ | 12 MB | 40 | 96 |

- **Goroutines scale linearly** (~3/camera: publisher + ffmpeg-stderr scanner +
  runtime), no leak, no runaway.
- **Agent RSS is essentially flat (~12 MB at 30)** — the Go supervisor is
  negligible; real memory lives in ffmpeg child processes.
- **Agent CPU is negligible in copy mode**; ffmpeg does the work (~1.7%/stream
  here). **Transcode (H.265→H.264) is the real CPU cost** and is per-camera —
  the binding constraint at scale, not the agent.

### Mixed-failure matrix (6 cameras, distinct modes)

| Camera | Mode | Result |
|--------|------|--------|
| cam-1 | Offline (no such path) | Retries with backoff, isolated |
| cam-2 | Online | **0 disruptions — stayed publishing throughout** |
| cam-3 | Wrong RTSP URL/port | Retries correctly, never gives up |
| cam-4 | Auth failure | Retries, isolated |
| cam-5 | High latency (unroutable) | Retries, isolated |
| cam-6 | Restart (source killed, then restored) | **Auto-recovered ~10s after source returned** |

- **Fault isolation confirmed:** cam-2 never stopped while four neighbours were
  failing.
- **Recovery confirmed:** cam-6 killed at T, source restored at T+6s, ffmpeg
  republishing by ~T+10s (matches backoff).
- **Supervisor never crashed** (no panic/fatal; clean start→stop).
- **Every camera event stayed tagged** with the correct `cameraId`.

### Practical capacity guidance

The agent's own overhead is trivial and linear. Real limits are physical, per
camera:

- **CPU:** H.264 cameras (copy, no re-encode) → dozens per agent. H.265 cameras
  (must transcode) → roughly **4–8 simultaneous 1080p transcodes** on a laptop
  before saturation.
- **Upload bandwidth:** ~2–4 Mbps per 1080p stream. 30 cameras ≈ 60–120 Mbps up
  — usually a *site* limit, not an agent one.
- **RAM:** ~30–50 MB per ffmpeg process (OS-managed), not agent heap.

For deployments beyond one machine's CPU/uplink, run **multiple agents** — each
is fully independent (the architecture already supports it).

## Runtime control (Phase 2a)

The supervisor is **runtime-mutable**: cameras can be started/stopped
individually without disturbing the others.

- Each camera has its **own** `context.CancelFunc` derived from the root
  context. `StopCamera(id)` cancels *only that* context; the publisher's `Run`
  returns cleanly and its ffmpeg child (launched via `exec.CommandContext`) is
  terminated and reaped before `StopCamera` returns. **No orphaned processes.**
- Control API: `StartCamera(id)` · `StopCamera(id)` · `StartAll()` · `StopAll()`
  · `IsRunning(id)` · `States()`. All are mutex-guarded and **idempotent**
  (double start/stop and unknown ids are safe no-ops).
- The supervisor is the **single source of truth for runtime state**; the GUI
  (Phase 2b) only *reads* `States()` snapshots and issues commands — it never
  owns runtime state.

```mermaid
sequenceDiagram
  participant GUI
  participant Sup as Supervisor
  participant Pub as Publisher(cam-3)
  participant FF as ffmpeg(cam-3)
  GUI->>Sup: StopCamera("cam-3")
  Sup->>Sup: lock; take cam-3 cancel/done; unlock
  Sup->>Pub: cancel(cam-3 ctx)   %% only cam-3
  Pub->>FF: ctx cancel → SIGKILL
  FF-->>Pub: exits
  Pub-->>Sup: done channel closed (process reaped)
  Sup-->>GUI: returns (cam-1, cam-2 untouched)
```

### Restart behavior (state persistence policy)

**Configuration is the only persisted state. Runtime state is reconstructed on
startup and never persisted.**

- On start, the supervisor starts every camera with `enabled: true` (→
  CONNECTING); disabled cameras stay stopped.
- To make a camera stay stopped across restarts, **disable it** (set
  `enabled: false`). A camera merely *stopped* at runtime (still `enabled: true`)
  will start again on the next launch — a single, unambiguous source of intent
  (`enabled`), with no hidden/stale runtime state to recover after a crash.

### Audit log

Operator/lifecycle actions are recorded to an append-only **`audit.log`**
(separate from the operational log), one structured line each:
`camera.added/edited/deleted`, `camera.started/stopped`, `cameras.started_all/
stopped_all`, `config.imported/exported/saved/restored`, `template.changed` —
tagged with `cameraId` where applicable. For troubleshooting and operational
review.

## Diagnostics

Set `EDGE_DEBUG_ADDR=127.0.0.1:6060` to expose `net/http/pprof`
(`/debug/pprof/goroutine`, `/heap`, …) for live inspection of a busy agent. Off
by default; zero cost otherwise.
