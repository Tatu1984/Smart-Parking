# Edge Agent — Multi-Camera Control Panel (GUI)

The desktop control panel manages many cameras from one on-site machine. It is a
**client of the streaming worker**, not the streaming engine itself:

- The **worker** (background process) does the streaming and owns runtime state.
- The **GUI** edits configuration, shows live status, and issues commands
  (start/stop) to the worker over a local control API.
- **Closing the GUI window keeps streaming** — only stopping the worker (or a
  camera) stops video.

See also: [runtime-api.md](runtime-api.md) (the engine contract),
[edge-config-format.md](edge-config-format.md) (config + import/export).

## Architecture

```
┌───────────── GUI (control panel) ─────────────┐
│  ConfigModel  (desired state you edit)         │  → config.yaml (persisted)
│  RuntimeView  (live state, read-only)          │  ← worker control API
└───────────────┬───────────────┬────────────────┘
      commands   │               │  states / events
      (start/stop)▼               ▼
        Worker  (Supervisor: one goroutine per camera → ffmpeg → portal)
```

Two models are kept strictly separate: **configuration** (what should run) and
**runtime** (what is running). The worker is the single source of runtime truth.

## The window

- **Camera table** — one row per camera: select · status dot · name · group ·
  status · health · reconnects · last-seen · per-row Start/Stop.
- **Toolbar** — Add camera · search (name/id/group) · status filter · group
  filter · sort (name/status/health/reconnects/last-seen/group) + direction.
- **Bulk actions** (on checked rows) — Start · Stop · Enable · Disable · Delete.
- **Global** — Start All · Stop All · Import… · Export… · Backups…
- **Worker controls** — Start/Stop worker · "Start automatically at login".
- **Details drawer** (click a row) — Camera Information · Connection · Runtime
  Metrics · Health · Recent Events, plus Recording / AI / PTZ sections reserved
  for future capabilities.

## Common tasks

### Add / edit a camera
**Add camera** (or **Edit** in the details drawer) opens a form. Choose the
source mode:
- **Full RTSP URL** — paste the camera's complete `rtsp://…` URL.
- **Template + channel/subtype** — set the global RTSP template once (with
  `{channel}`/`{subtype}` placeholders), then just enter channel/subtype per
  camera. A **live preview** (credentials masked) shows the resolved URL before
  you save.

Fill in the portal **publish URL** (or **stream key**) and the **ingest token**
from the SParking dashboard. Save persists to `config.yaml` (and reloads the
worker if it's running).

### Start / stop
- **Per camera** — the row's Start/Stop button (or the details drawer).
- **Selected** — check rows, use the bulk Start/Stop.
- **All** — Start All / Stop All.

Individual start/stop never disturbs other cameras (each has its own lifecycle).

### Enable / disable
Disabling a camera keeps it in the config but stops it from running — and, per
the persistence policy, it will **not** auto-start when the worker restarts.
Enabling is the single source of "should this run".

### Import / Export
- **Export…** writes a versioned JSON (see the format doc) with metadata:
  format version, timestamp, agent version, hostname, platform, camera count,
  and a config checksum.
- **Import…** reads such a file and asks **Merge** (add new, keep existing) or
  **Replace** (swap the whole list). Conflicts are handled deterministically and
  reported (see below).

### Backups / Restore
Every save first rotates the current `config.yaml` into a timestamped `.bak`
(last 5 kept). **Backups…** lets you restore a previous one (the current config
is itself backed up first).

## Import conflict rules (deterministic)

Imports never leave the config partially applied. Rules:

| Situation | Result |
|-----------|--------|
| Duplicate `cameraId` **within the file** | whole import rejected (error) |
| Duplicate ingest target **within the file** | whole import rejected (error) |
| Missing required field (id/token/source/target) | that row skipped + reported |
| (Merge) `cameraId` already present | that row skipped + reported |
| Duplicate RTSP across cameras | allowed, warned (shared NVR is legitimate) |
| Export `version` newer (major) than the agent | refused — update the agent |

After an import, a summary shows added/replaced counts, skipped rows (with
reasons), and warnings.

## Persistence & restart behavior

- Only **configuration** is persisted. Runtime state is reconstructed on
  startup: enabled cameras start; disabled ones stay stopped.
- A camera *stopped at runtime* but still enabled will start again next launch.
  To keep it stopped, **disable** it.

## Scalability

The table uses **row-diff rendering** on the 2-second poll — only cameras whose
visible state changed are repainted (a full rebuild happens only when the set of
cameras changes or on a user action). This keeps the panel responsive at
100–200 cameras. Sorting is stable; filtering is single-pass.

## Audit log

Operator actions are appended to `audit.log` (in the app dir), one structured
line each: add/edit/delete, start/stop, start-all/stop-all, import/export,
restore. For troubleshooting and operational review.

## Where files live

| File | Purpose |
|------|---------|
| `config.yaml` | the camera configuration (0600 — holds tokens) |
| `config.yaml.<stamp>.bak` | rotated backups (last 5) |
| `agent.log` | worker operational log |
| `audit.log` | operator/lifecycle audit trail |
| `control.json` | worker's local control-API address + token (0600) |

Locations: `%APPDATA%\SParking` (Windows) · `~/Library/Application Support/SParking`
(macOS) · `~/.config/sparking` (Linux).

## Troubleshooting

- **"Worker not running" when clicking a camera control** — start the worker
  first; per-camera control needs the running engine.
- **FFmpeg banner** — install ffmpeg (`brew install ffmpeg` / `winget install
  Gyan.FFmpeg`), then Recheck.
- **A camera won't start** — open its details drawer → Connection / Recent
  Events for the reason (unreachable source, bad credentials, etc.).
