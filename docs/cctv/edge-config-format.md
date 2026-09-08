# Edge Agent — Configuration & Interchange Formats

The Edge Agent uses two related, **versioned** formats:

1. **Agent config** (`config.yaml`) — the agent's own on-disk state (what it
   reads to know which cameras to publish).
2. **Interchange JSON** — what the SParking dashboard *exports* and the agent
   *imports* to bulk-provision cameras (Phase 3).

Both carry a version so the format can evolve without breaking older files.

---

## 1. Agent config (`config.yaml`)

Schema version: **`schemaVersion: 1`**.

```yaml
schemaVersion: 1
agentId: parking-lot-01           # human label for this agent (not authenticated)

# Optional globals used to BUILD per-camera values:
portalBaseUrl: https://portal.example.com          # + streamKey → ingest URL
rtspTemplate: "rtsp://user:pass@10.0.0.5:554/cam/realmonitor?channel={channel}&subtype={subtype}"

cameras:
  - cameraId: cam-001              # STABLE id (from the portal). Never changes.
    name: Entrance Gate           # display label; renamable
    # Source — provide EITHER a full rtsp URL...
    rtsp: rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101
    # ...OR channel/subtype (used with the global rtspTemplate):
    # channel: 1
    # subtype: 0
    # Ingest target — provide EITHER a full publish URL...
    publish: https://portal.example.com/api/edge/ingest/<streamKey>/index.m3u8
    # ...OR a streamKey (used with the global portalBaseUrl):
    # streamKey: cms00tvbm...
    token: edge_...                # per-camera Bearer token from the portal
    transcode: auto                # optional per-camera override (auto|copy|h264)
    enabled: true                  # false = keep in config but don't publish

ffmpeg:
  binary: ffmpeg                   # resolved to an absolute path at runtime
  transcode: auto                  # global default when a camera omits its own

log:
  level: info                      # debug | info | warn | error
  maxSizeMB: 5                     # rotate a log past this size (default 5)
  maxBackups: 3                    # rotated files kept (default 3)

watchdog:
  stallSeconds: 30                 # restart a frozen ffmpeg after this (default 30, clamp 15–120)

backoffMaxSeconds: 30              # cap on per-camera reconnect backoff (default 30)
backoffJitterPct: 20               # ± jitter on reconnect delay, 0–100 (default 20; 0 disables)
                                   #   spreads a fleet's retries so a mass outage
                                   #   recovery does not stampede the ingest
maxConcurrentStarts: 64            # max cameras doing their FIRST probe/launch at once
                                   #   (startup ramp control; default 8×CPU min 16; negative = unbounded)
```

### Field resolution rules
- **RTSP:** `rtsp` wins; otherwise `channel`/`subtype` are substituted into
  `rtspTemplate` (`{channel}`, `{subtype}`).
- **Ingest URL:** `publish` wins; otherwise built as
  `<portalBaseUrl>/api/edge/ingest/<streamKey>/index.m3u8`.
- **Transcode:** camera's `transcode` wins; otherwise `ffmpeg.transcode`.
- **Duplicate ingest targets are rejected** (two cameras must not publish to the
  same path).

### File permissions
The file holds live ingest **tokens** → written `0600`. Treat it like a secret.

---

## 2. Interchange JSON (dashboard → agent, Phase 3)

The dashboard bulk-creates edge cameras + tokens and exports one file the agent
imports. Versioned independently of the agent config.

```json
{
  "version": "2.0",
  "generatedAt": "2026-08-07T16:30:00Z",
  "agentVersion": "1.4.0",
  "hostname": "site-pc-01",
  "platform": "windows/amd64",
  "cameraCount": 30,
  "configChecksum": "a1b2c3d4e5f60718",
  "portalBaseUrl": "https://portal.example.com",
  "rtspTemplate": "rtsp://u:p@10.0.0.5:554/cam?channel={channel}&subtype={subtype}",
  "groups": ["Entrance", "Basement"],
  "cameras": [
    {
      "cameraId": "cam-001",
      "name": "Entrance Gate",
      "group": "Entrance",
      "streamKey": "cms00tvbm...",
      "token": "edge_...",
      "rtsp": "rtsp://user:pass@host:554/...",
      "channel": 1,
      "subtype": 0,
      "enabled": true,
      "capabilities": { "supportsPtz": true }
    }
  ]
}
```

**Metadata** (added in v2.0) aids support/debugging: `agentVersion`, `hostname`,
`platform`, `cameraCount`, and a `configChecksum` (stable hash of the camera set).

- `streamKey` is **authoritative** — the portal owns it (it's the camera's
  `mediaMtxPath`), so the agent never guesses the ingest path.
- Each entry may carry a full `rtsp` **or** `channel`/`subtype` (used with the
  agent's `rtspTemplate`).
- The file contains live **tokens** — distribute it privately.

### Import conflict rules (deterministic)

Import is **all-or-nothing per validation, never partially applied**:

| Situation | Result |
|-----------|--------|
| Duplicate `cameraId` within the file | whole import rejected |
| Duplicate ingest target within the file | whole import rejected |
| Missing required field (id/token/source/target) | that row skipped + reported |
| (Merge mode) `cameraId` already present | that row skipped + reported |
| Duplicate RTSP across cameras | allowed + warned (shared NVR is valid) |
| `version` newer major than the agent | refused with an update message |

Import offers **Merge** (add new by `cameraId`) or **Replace** (swap the whole
list).

---

## 3. Versioning & migration contract

This is the whole point of the version fields: **evolve the format without
breaking older files.**

| Situation | Behavior |
|-----------|----------|
| Config `schemaVersion` **absent/0** (legacy single-camera layout) | Migrated in memory: the old `camera:`/`cloud:` block folds into a one-element `cameras` list. Existing installs keep working. |
| Config `schemaVersion` **equals** the build's | Loaded directly. |
| Config `schemaVersion` **newer** than the build understands | **Refused** with a clear message ("please update the Edge Agent") — never silently mis-parsed. |
| Interchange JSON `version` older | Import migrates/upfills defaults. |
| Interchange JSON `version` newer major | Import refused with a clear message. |

**Adding a field later** (e.g. AI settings, recording options): add it as
optional, keep `CurrentSchemaVersion` if old files still load correctly, or bump
it and add a migration step. Never remove/rename a field without a version bump
plus migration.

The current build's constant lives in `edge-agent/internal/config/config.go`
(`CurrentSchemaVersion`).

---

## 4. Backward compatibility (what won't break)

- A pre-multi-camera `config.yaml` (single `camera:`/`cloud:` block, no
  `schemaVersion`) **still loads** — migrated to one camera automatically.
- The agent GUI (Phase 1) still edits a single camera (`cameras[0]`); Phase 2
  replaces it with a multi-camera list UI but reads/writes the same versioned
  file.
