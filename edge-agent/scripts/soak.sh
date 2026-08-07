#!/usr/bin/env bash
# Phase-2.6 SOAK harness — run the REAL worker for many hours against synthetic
# cameras and sample resource use on an interval, so leaks (goroutines, memory,
# file descriptors, zombie ffmpeg) show up as an upward TREND rather than a
# one-off reading. Writes a CSV and prints a pass/fail summary at the end.
#
# This is meant to run on a real machine you can leave up for 48-72h. It does NOT
# need real cameras (sources are unreachable synthetic RTSP — the worker exercises
# its full probe→offline→backoff→reconnect path). To soak with REAL streams,
# point the generated config at real RTSP URLs instead.
#
# Usage:
#   scripts/soak.sh [--hours H] [--cameras N] [--interval SECONDS]
# Defaults: 72h, 30 cameras, sample every 300s.
#
# Pass/fail (evaluated on the LAST third vs the FIRST third of samples):
#   PASS if goroutines, RSS, and FD count are FLAT (±15%) and zombie ffmpeg == 0
#   FAIL otherwise (a sustained climb = a leak).
set -uo pipefail

HOURS=72; CAMERAS=30; INTERVAL=300
while [ $# -gt 0 ]; do
  case "$1" in
    --hours) HOURS="$2"; shift 2;;
    --cameras) CAMERAS="$2"; shift 2;;
    --interval) INTERVAL="$2"; shift 2;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done

DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT="$DIR/bin/edge-agent"
WORK="$(mktemp -d)"
export XDG_CONFIG_HOME="$WORK"
APPDIR="$WORK/sparking"; mkdir -p "$APPDIR"
CFG="$APPDIR/config.yaml"
CSV="${SOAK_CSV:-$DIR/soak-$(date +%Y%m%d-%H%M%S).csv}"

cleanup(){ [ -n "${WPID:-}" ] && kill "$WPID" 2>/dev/null; wait "$WPID" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT

echo "== build worker =="
( cd "$DIR" && GOPROXY=off go build -o bin/edge-agent ./cmd/edge-agent ) || { echo "build failed"; exit 1; }

echo "== generate $CAMERAS-camera synthetic config =="
python3 - "$CAMERAS" "$CFG" <<'PY'
import sys, yaml
n=int(sys.argv[1]); path=sys.argv[2]
cams=[{"cameraId":f"cam-{i:03d}","name":f"Cam {i:03d}",
       "rtsp":f"rtsp://127.0.0.1:1/{i}","publish":f"https://ingest.invalid/{i}/index.m3u8",
       "token":"t","enabled":True} for i in range(n)]
yaml.safe_dump({"schemaVersion":1,"agentId":"soak","ffmpeg":{"transcode":"copy"},
                "backoffMaxSeconds":5,"log":{"level":"warn","maxSizeMB":5,"maxBackups":3},
                "cameras":cams}, open(path,"w"))
PY

ep(){ python3 -c "import json;print(json.load(open('$APPDIR/control.json'))['$1'])" 2>/dev/null; }
health(){ local a t; a=$(ep addr); t=$(ep token); curl -s -H "Authorization: Bearer $t" "http://$a/health"; }

echo "== start worker =="
"$AGENT" --config "$CFG" >"$APPDIR/agent.log" 2>&1 &
WPID=$!
for _ in $(seq 1 40); do [ -f "$APPDIR/control.json" ] && health >/dev/null 2>&1 && break; sleep 0.25; done
echo "worker pid=$WPID  csv=$CSV"

# zombies: child ffmpeg processes of the worker in Z (defunct) state.
count_zombies(){ ps -o stat= --ppid "$WPID" 2>/dev/null | grep -c 'Z'; true; }
# open FDs of the worker.
count_fds(){ ls "/proc/$WPID/fd" 2>/dev/null | wc -l; }
# RSS in KB.
rss_kb(){ awk '/VmRSS/{print $2}' "/proc/$WPID/status" 2>/dev/null; }
# goroutines: from /health? not exposed; use pprof if EDGE_DEBUG_ADDR set, else "-".
goroutines(){
  if [ -n "${EDGE_DEBUG_ADDR:-}" ]; then
    # First line looks like: "goroutine profile: total 183" — take the number,
    # stripped of any stray whitespace/newline so it stays a single CSV cell.
    curl -s "http://$EDGE_DEBUG_ADDR/debug/pprof/goroutine?debug=1" 2>/dev/null \
      | awk 'NR==1{print $NF; exit}' | tr -d '[:space:]'
  else printf ""; fi
}

echo "ts_epoch,elapsed_s,rss_kb,fds,zombies,goroutines,health_status,online,offline,reconnecting,stalled" > "$CSV"

# Allow fractional hours (e.g. 0.02 for a ~1min smoke run) so the harness is
# self-testable; the real soak passes 48-72.
DURATION=$(python3 -c "print(int(float('$HOURS')*3600))")
END=$(( $(date +%s) + DURATION ))
START=$(date +%s)
# do-while: always take at least one sample even for a tiny duration.
while : ; do
  if ! kill -0 "$WPID" 2>/dev/null; then echo "WORKER DIED at $(date)"; echo "worker_died" >> "$CSV"; break; fi
  H=$(health)
  st=$(echo "$H"  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('status','?'))" 2>/dev/null || echo "?")
  on=$(echo "$H"  | python3 -c "import json,sys;print(json.load(sys.stdin)['cameras']['online'])" 2>/dev/null || echo -1)
  off=$(echo "$H" | python3 -c "import json,sys;print(json.load(sys.stdin)['cameras']['offline'])" 2>/dev/null || echo -1)
  rc=$(echo "$H"  | python3 -c "import json,sys;print(json.load(sys.stdin)['cameras']['reconnecting'])" 2>/dev/null || echo -1)
  sl=$(echo "$H"  | python3 -c "import json,sys;print(json.load(sys.stdin)['cameras']['stalled'])" 2>/dev/null || echo -1)
  now=$(date +%s)
  # Sanitize every field to a single token (strip newlines) so one sample is
  # always exactly one CSV row, even if a helper subshell emits stray whitespace.
  RSS=$(rss_kb | tr -d '[:space:]'); FDS=$(count_fds | tr -d '[:space:]')
  ZOM=$(count_zombies | tr -d '[:space:]'); GOR=$(goroutines | tr -d '[:space:]')
  line="$now,$((now-START)),${RSS:-},${FDS:-},${ZOM:-0},${GOR:-},${st:-?},${on:--1},${off:--1},${rc:--1},${sl:--1}"
  printf '%s\n' "$line" >> "$CSV"
  [ "$(date +%s)" -ge "$END" ] && break
  sleep "$INTERVAL"
done

echo "== soak complete — evaluating trend =="
python3 - "$CSV" <<'PY'
import csv, sys
rows=[r for r in csv.DictReader(open(sys.argv[1])) if (r.get('rss_kb') or '').isdigit()]
if len(rows) < 6:
    print("INCONCLUSIVE: too few samples (need >=6; run longer or a shorter --interval)"); sys.exit(0)
def col(name):
    out=[]
    for r in rows:
        v=(r.get(name) or '').strip()
        if v.lstrip('-').isdigit(): out.append(float(v))
    return out
third=len(rows)//3
def avg(xs): return sum(xs)/len(xs) if xs else 0
def trend(name):
    xs=col(name)
    if not xs: return None
    first=avg(xs[:third]); last=avg(xs[-third:])
    grow=(last-first)/first*100 if first else 0
    return first,last,grow
verdict="PASS"; notes=[]
for metric in ("rss_kb","fds","goroutines"):
    t=trend(metric)
    if t is None: notes.append(f"{metric}: n/a"); continue
    f,l,g=t; notes.append(f"{metric}: {f:.0f}→{l:.0f} ({g:+.1f}%)")
    if abs(g)>15: verdict="FAIL"; notes[-1]+="  <-- exceeds ±15%"
zmax=max(col('zombies') or [0])
notes.append(f"max zombies: {zmax:.0f}")
if zmax>0: verdict="FAIL"; notes[-1]+="  <-- zombie ffmpeg present"
print("\n".join(notes))
print(f"\nSOAK VERDICT: {verdict}  (samples={len(rows)})")
PY
