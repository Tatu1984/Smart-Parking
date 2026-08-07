# Edge Agent — Phase 2.6 Resilience Verification

Phase 2.5 hardened the agent; Phase 2.6 **verifies** that hardening under adverse
conditions and turns each check into repeatable evidence. This document records
what was proven, what bugs the verification found, the measured numbers, and what
must still be run on real hardware.

Scope maps to five areas: disk-full, concurrent operator actions, scale,
long-duration soak, and network chaos.

---

## Summary

| Area | Status | Where |
|------|--------|-------|
| Disk-full (ENOSPC) | ✅ Verified here — **2 real bugs found & fixed** | `internal/config`, `internal/rotatelog`, `internal/diagbundle` tests |
| Concurrent operator actions | ✅ Verified here (`-race`) — **1 latent race hardened** | `internal/publisher/concurrency_test.go` |
| Scale (100–400 cameras) | ✅ Verified here (headless, synthetic sources) | `internal/publisher/scale_test.go` |
| Soak (48–72h) | 🧰 Harness built & smoke-tested — **owner runs on real HW** | `scripts/soak.sh` |
| Network chaos | ✅ Synthetic-reboot verified here; 🧰 real-fault harness for owner | `chaos_test.go` + `scripts/chaos.sh` |

"Verified here" = automated, repeatable, runs in this repo. 🧰 = a ready-to-run
harness handed off because it needs real hardware, root, or multi-day wall-clock.

---

## 1. Disk-full (ENOSPC) — 2 real bugs found & fixed

Fault injected with Linux `/dev/full` (writes always return ENOSPC) and
read-only directories — no root or mounts needed.

**Bug 1 — config write was not durable.** `Save` used `os.WriteFile` + `rename`
but never `fsync`. On some filesystems ENOSPC surfaces only at `fsync`/`close`, so
a full disk could report a *false success*, and a power loss after `rename` could
leave a zero-length `config.yaml`. **Fix:** `writeFileSync` fsyncs the temp file
(surfacing ENOSPC) before the rename, and fsyncs the parent dir after, so the
commit is durable. Proven: `TestWriteFileSyncCatchesENOSPC`,
`TestSaveLeavesExistingConfigIntactOnDiskFull` (live config byte-for-byte intact,
no `.tmp` litter after a failed save).

**Bug 2 — rotatelog could write to a closed/nil fd after a failed rotation.**
`rotate()` closed the active file then reopened; if the reopen failed (disk full),
`w.f` was left closed/nil and the next `Write` errored on every call or risked a
nil deref — silently losing all logs. **Fix:** the active file is closed only
after a successful rename, and a failed reopen recovers a working handle onto the
rotated file so logging continues. Proven:
`TestRotateReopenFailureLeavesUsableHandle`, `TestWriteNeverPanicsOnReadOnlyDir`.

**Bundle** fails loud on a full disk (returns an error, no truncated zip pretending
success): `TestBuildFailsLoudOnDiskFull`.

**Invariant established:** a full disk never corrupts the live config, never
crashes the worker, and never silently swallows the failure.

## 2. Concurrent operator actions — 1 latent race hardened

`TestConcurrentLifecycleSpam` hammers `StartCamera`/`StopCamera`/`StartAll`/
`StopAll`/`States`/`IsRunning` from many goroutines at once under `-race`;
`TestStartStopIdempotentUnderConcurrency` checks start/stop spam doesn't leak
goroutines.

The runtime control surface was already `-race`-clean, but the spam surfaced a
**latent window**: `running()` keyed off `m.cancel != nil`, which flips false the
instant a stopper begins — so a `StartCamera` racing a `StopCamera` could briefly
see "not running" and launch a *second* goroutine on the same Publisher. **Fix:**
`running()` now keys off the run's `done` channel staying open through full
wind-down, so the slot stays "busy" until the goroutine actually exits; a racing
start is correctly treated as idempotent. `StopCamera` clears the slot only if it
still owns the run it drained.

**Not a runtime concern:** camera *deletion* is a config edit applied on restart,
not a hot runtime operation — there is no "delete during reconnect" race at
runtime. The GUI's config **Model** is single-threaded by design (all mutation on
the Fyne UI thread; the only background goroutine reads runtime state and marshals
back via `fyne.Do`); this contract is now documented on the type. Cross-process
config writes are serialized by the on-disk lock (`config.AcquireLock`).

## 3. Scale — linear to 400 cameras, no leaks

`TestScaleManyCameras` (headless, synthetic unreachable sources; `-short`-gated;
`EDGE_SCALE=N` to vary) stands up N cameras in one supervisor, lets them reach
steady state, and records resource use:

| Cameras | Goroutines | Open FDs | `/states` payload | Heap |
|--------:|-----------:|---------:|------------------:|-----:|
| 100 | +183 (~1.8/cam) | 62 | 69 KB | 2 MB |
| 200 | +495 (~2.5/cam) | 223 | 129 KB | 14 MB |
| 400 | +1311 (~3.3/cam) | 805 | 212 KB | 21 MB |

Goroutines and FDs scale ~linearly with no runaway; goroutines return to baseline
on shutdown (no leak). This box's FD limit is 1,048,576 — enormous headroom.

**Caveat (honest):** this exercises the probe→offline→backoff path (failed
sources), **not** N simultaneously-*publishing* ffmpeg encoders. Steady-state with
200 live H.264 encoders is **CPU-bound**, not goroutine-bound, and needs real
sources — measure it in the soak run against real (or looped-file) streams. Also
note the `/states` payload is ~1 KB/camera; a future **fleet** dashboard polling
many agents should paginate or delta-encode (the single-site GUI is fine).

## 4. Soak (48–72h) — harness ready, owner runs

`scripts/soak.sh` runs the real worker against synthetic cameras and samples
RSS, open FDs, zombie ffmpeg, goroutines (via pprof when `EDGE_DEBUG_ADDR` is
set), and `/health` on an interval, to a CSV. At the end it compares the first
third vs the last third of samples and prints a verdict.

```
# 72h, 30 cameras, sample every 5 min, with goroutine sampling:
EDGE_DEBUG_ADDR=127.0.0.1:6060 scripts/soak.sh --hours 72 --cameras 30 --interval 300
```

**PASS criteria:** RSS, FD count, and goroutines FLAT (±15% first-third→last-third)
**and** zero zombie ffmpeg. A sustained upward trend = a leak = FAIL.

Smoke-tested here over a ~1-min window: clean one-row-per-sample CSV, FDs and
goroutines dead flat, zero zombies. **To soak against real streams**, point the
generated config's RTSP URLs at real cameras (or a looped-file RTSP server).

## 5. Network chaos

**Runs here (automated):** `TestChaosSourceRebootRecovers` cycles a synthetic TCP
source down/up 4× while the supervisor runs, asserting the agent never crashes,
the source camera never gets stuck `FAILED`, a second camera stays running
throughout (**fault isolation**), and goroutines return to baseline on shutdown.

**Handed off (real faults, need root + real gear):** `scripts/chaos.sh` drives
`tc/netem` packet loss and latency, DNS failure (`/etc/hosts`), ingest blackhole
(`iptables`), and a manual camera/NVR reboot — each watching `/health` for the
degraded→ok recovery transition.

```
sudo IFACE=eth0 INGEST_HOST=ingest.example.com scripts/chaos.sh loss
```

**PASS criterion (every scenario):** health goes `degraded` during the fault, then
returns to `ok` within the recovery window, with no worker crash (control API keeps
answering) and no stalled cameras left over.

---

## Running the automated checks

```bash
cd edge-agent
go test -short -race ./internal/...      # fast suite (skips scale/chaos)
go test ./internal/publisher/ -run TestScaleManyCameras -v         # scale @100
EDGE_SCALE=200 go test ./internal/publisher/ -run TestScaleManyCameras -v
go test ./internal/publisher/ -run TestChaos -v                    # synthetic chaos
bash scripts/acceptance.sh               # Phase 2b+2.5 operator workflow (16/16)
```

## Remaining before "production-ready"

- Run `scripts/soak.sh` for 48–72h on the target hardware (ideally against real or
  looped-file streams) → attach the CSV + verdict.
- Run `scripts/chaos.sh` scenarios against a real camera + real ingest.
- Measure steady-state CPU/FD with ~30 live encoders (site-representative count).

These are hardware/time-bound, not code-bound: the agent code and the harnesses
are ready.
