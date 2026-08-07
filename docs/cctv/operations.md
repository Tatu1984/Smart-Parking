# Edge Agent — Operations Runbook (Phase 2.5)

Operational hardening reference for running the Edge Agent at a site: what
self-heals automatically, how to read health, how to collect diagnostics, and
how the agent survives restarts and power loss.

For the cloud/MediaMTX side, see [recovery.md](recovery.md). For install and
config, see [edge-agent.md](edge-agent.md). For the exact endpoint shapes, see
[runtime-api.md](runtime-api.md).

---

## What heals itself (no operator action)

| Condition | Detection | Automatic recovery |
|-----------|-----------|--------------------|
| Camera/source drops | ffmpeg exits or probe fails | Per-camera reconnect with exponential backoff (cap `backoffMaxSeconds`, default 30s). Only that camera is affected — others keep streaming. |
| ffmpeg alive but **frozen** (no output) | **Stall watchdog**: no ffmpeg progress within `watchdog.stallSeconds` (default 30, clamp 15–120) | Watchdog kills the wedged ffmpeg → normal reconnect loop restarts **only that camera**. The signal is process progress, not video content, so a low-motion but healthy stream is never falsely restarted. |
| Ingest endpoint blip | ffmpeg PUT fails | Reconnect/backoff; classified as `ingest-unreachable`. |
| Log files growing | Size threshold | **Log rotation**: `agent.log`/`audit.log` rotate at `log.maxSizeMB` (default 5 MB), keeping `log.maxBackups` (default 3) — disk never fills. |
| Bad config edit | Dry-run validation before save | The invalid config is **rejected** and the live config is left untouched. A timestamped backup is kept (last 5). |

Fault isolation is the core guarantee: **one camera's failure never stops
another.** Each camera is an independent goroutine + ffmpeg child with its own
context and backoff.

---

## Reading health

The worker exposes a localhost-only control API (127.0.0.1 + per-run Bearer
token in `control.json`, 0600). The GUI uses it; you can also curl it.

```bash
# resolve address + token
ADDR=$(python3 -c "import json;print(json.load(open('$CONFIG_DIR/control.json'))['addr'])")
TOK=$(python3  -c "import json;print(json.load(open('$CONFIG_DIR/control.json'))['token'])")

curl -s -H "Authorization: Bearer $TOK" http://$ADDR/health   | jq   # status + per-status counts
curl -s -H "Authorization: Bearer $TOK" http://$ADDR/version  | jq   # agent/schema/ffmpeg
```

`/health` `status` is `degraded` when any camera is `FAILED`, `OFFLINE`, or
`STALLED`; otherwise `ok`.

`$CONFIG_DIR` is `%APPDATA%\SParking` (Windows), `~/Library/Application
Support/SParking` (macOS), or `~/.config/sparking` (Linux, honouring
`XDG_CONFIG_HOME`).

---

## Triage: a camera is not streaming

Read the camera's `ErrorClass`/`ErrorHint` first — it names the likely cause:

```bash
curl -s -H "Authorization: Bearer $TOK" http://$ADDR/diagnostics | \
  jq '.cameras[] | {id:.CameraID, status:.Status, class:.ErrorClass, hint:.ErrorHint}'
```

| `ErrorClass` | Meaning | Fix |
|--------------|---------|-----|
| `source-unreachable` | Camera off / wrong IP / different subnet | Confirm the camera is powered and on this agent's network. |
| `bad-rtsp` | RTSP path/channel wrong, stream doesn't exist | Check the RTSP URL / channel / subtype. |
| `auth` | Camera rejected credentials | Fix the username/password in the RTSP URL. |
| `ingest-unreachable` | Cloud ingest not reachable | Check this machine's outbound HTTPS / firewall. |
| `ingest-auth` | Ingest token rejected | Re-copy the camera's ingest token from the portal. |
| `ffmpeg-missing` | ffmpeg not runnable | Reinstall the agent / install ffmpeg. |
| `codec` | Video format couldn't be published | Set this camera's `transcode: h264`. |

---

## Collecting a diagnostics bundle (for support)

Produces a single `.zip` that is safe to share — **it contains no secrets**
(config is redacted; tokens, stream keys, and URL credentials are stripped).

```bash
curl -s -H "Authorization: Bearer $TOK" \
  http://$ADDR/diagnostics/bundle -o sparking-diagnostics.zip
```

Contents: `config.redacted.yaml`, `diagnostics.json`, `system-info.txt`,
`agent.log` + `audit.log` (last 256 KB each), and `manifest.json`
(`bundleFormatVersion`, agent/schema versions, timestamp, os/arch/hostname,
`contents[]`). Attach the whole zip to a support ticket.

The "no secrets" invariant is enforced by security-critical unit tests
(`config.Redacted`, `internal/diagbundle`) and re-verified in
`scripts/acceptance.sh`.

---

## Surviving restarts and power loss

| Event | Behavior |
|-------|----------|
| Agent process crash | Supervised restart (`Restart=always` systemd / LaunchAgent / Windows service — see [edge-agent.md](edge-agent.md)). On restart, **only enabled cameras auto-start** — runtime state is reconstructed from config, the single source of truth. |
| OS reboot | The service unit is enabled at boot (`WantedBy=multi-user.target`, `After=network-online.target`). The agent comes back automatically and re-establishes every enabled camera. |
| Power loss mid-write | Config saves are **atomic** (write temp + `rename`), so a yanked cord never leaves a half-written `config.yaml`. If the live file were ever unreadable, a timestamped backup (last 5) can be restored from the GUI. Runtime state is not persisted, so there is nothing else to corrupt. |
| Two writers at once (GUI + CLI) | An advisory lockfile (`config.lock`, 10s timeout) serialises config writes; the second caller gets a clear "another configuration operation is already in progress" rather than a corrupted file. A crashed writer's stale lock (>30s) is reclaimed automatically. |

**Verify autostart-at-boot** once per site after install:

```bash
sudo systemctl enable sparking-edge-agent    # Linux
sudo reboot
# after reboot:
systemctl is-active sparking-edge-agent       # → active
curl -s -H "Authorization: Bearer $TOK" http://$ADDR/health | jq .status
```

---

## Config knobs (Phase 2.5)

```yaml
log:
  level: info
  maxSizeMB: 5      # rotate each log at this size (default 5)
  maxBackups: 3     # rotated files kept (default 3)
watchdog:
  stallSeconds: 30  # restart a frozen ffmpeg after this (default 30, clamp 15–120)
backoffMaxSeconds: 30  # per-camera reconnect backoff cap (default 30)
```

All are optional; defaults apply when omitted.

---

## Resilience verification

Before a site goes live, the agent's behavior under adverse conditions is
verified — disk-full, concurrent operator actions, scale, long-duration soak, and
network chaos. See [resilience.md](resilience.md) for what is proven, the measured
scaling numbers, and the two long-running harnesses you run on real hardware:

- **Soak:** `scripts/soak.sh --hours 72 --cameras 30` → CSV + PASS/FAIL trend
  (RSS/FD/goroutines flat, zero zombie ffmpeg).
- **Network chaos:** `sudo scripts/chaos.sh loss|latency|dnsfail|ingestdown|rtspreboot`
  → watches `/health` recover from each injected fault.
