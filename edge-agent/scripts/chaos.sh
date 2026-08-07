#!/usr/bin/env bash
# Phase-2.6 NETWORK CHAOS harness — inject real network faults against a running
# Edge Agent and watch it recover via the /health endpoint. Unlike the in-repo Go
# chaos test (which cycles a synthetic TCP source and runs anywhere), this script
# drives REAL faults and therefore needs root (tc/netem) and, for the most
# meaningful runs, a REAL camera + a real ingest endpoint.
#
# Run it on the site machine (or a staging box that mirrors it). Each scenario
# prints the health status transition it caused and whether the agent recovered.
#
# Scenarios (select with the first arg; default: all-runnable):
#   loss       - 20% packet loss on the egress iface for 60s          [needs root]
#   latency    - +300ms latency for 60s                                [needs root]
#   dnsfail    - make the ingest host unresolvable for 60s (/etc/hosts)[needs root]
#   ingestdown - block the ingest port for 60s                         [needs root]
#   rtspreboot - you power-cycle the camera/NVR; script watches recovery [manual]
#
# Usage:
#   sudo IFACE=eth0 INGEST_HOST=ingest.example.com CONTROL_DIR=~/.config/sparking \
#        scripts/chaos.sh loss
set -uo pipefail

SCENARIO="${1:-help}"
IFACE="${IFACE:-eth0}"
INGEST_HOST="${INGEST_HOST:-}"
CONTROL_DIR="${CONTROL_DIR:-$HOME/.config/sparking}"
DURATION="${DURATION:-60}"

OS="$(uname -s)"
ep(){ python3 -c "import json;print(json.load(open('$CONTROL_DIR/control.json'))['$1'])" 2>/dev/null; }
# sed -i differs: GNU wants `-i`, BSD/macOS wants `-i ''`.
sed_inplace(){ if [ "$OS" = "Darwin" ]; then sed -i '' "$@"; else sed -i "$@"; fi; }
health_status(){
  local a t; a=$(ep addr); t=$(ep token)
  curl -s -H "Authorization: Bearer $t" "http://$a/health" \
    | python3 -c "import json,sys;d=json.load(sys.stdin);c=d['cameras'];print(d['status'],'online=%d off=%d recon=%d stalled=%d'%(c['online'],c['offline'],c['reconnecting'],c['stalled']))" 2>/dev/null
}
watch_health(){ # watch_health <seconds> <label>
  local end=$(( $(date +%s) + $1 ))
  while [ "$(date +%s)" -lt "$end" ]; do echo "  [$2] $(date +%T) $(health_status)"; sleep 5; done
}
need_root(){ [ "$(id -u)" = 0 ] || { echo "scenario '$SCENARIO' needs root (tc/iptables/hosts). Re-run with sudo."; exit 2; }; }

case "$SCENARIO" in
  loss|latency)
    need_root
    echo "== baseline =="; watch_health 10 base
    if [ "$OS" = "Linux" ]; then
      RULE=$([ "$SCENARIO" = loss ] && echo "loss 20%" || echo "delay 300ms")
      echo "== applying: netem $RULE on $IFACE for ${DURATION}s =="
      tc qdisc add dev "$IFACE" root netem $RULE || { echo "tc failed"; exit 1; }
      trap 'tc qdisc del dev "$IFACE" root netem 2>/dev/null' EXIT
      watch_health "$DURATION" fault
      tc qdisc del dev "$IFACE" root netem 2>/dev/null; trap - EXIT
    elif [ "$OS" = "Darwin" ]; then
      # macOS dummynet via dnctl + pfctl.
      PARM=$([ "$SCENARIO" = loss ] && echo "plr 0.2" || echo "delay 300")
      echo "== applying: dummynet $PARM (all traffic) for ${DURATION}s =="
      dnctl pipe 1 config $PARM
      echo 'dummynet out all pipe 1' | pfctl -f - -e 2>/dev/null
      trap 'pfctl -d 2>/dev/null; dnctl -q flush 2>/dev/null' EXIT
      watch_health "$DURATION" fault
      pfctl -d 2>/dev/null; dnctl -q flush 2>/dev/null; trap - EXIT
    else
      echo "loss/latency not supported on $OS"; exit 2
    fi
    echo "== recovery window =="; watch_health 30 recover
    ;;
  dnsfail)
    need_root; [ -n "$INGEST_HOST" ] || { echo "set INGEST_HOST"; exit 2; }
    echo "== baseline =="; watch_health 10 base
    echo "== poisoning DNS for $INGEST_HOST (→127.0.0.1) for ${DURATION}s =="
    echo "127.0.0.1 $INGEST_HOST # sparking-chaos" >> /etc/hosts
    # macOS caches DNS aggressively — flush so the change takes effect now.
    [ "$OS" = "Darwin" ] && dscacheutil -flushcache 2>/dev/null; killall -HUP mDNSResponder 2>/dev/null
    trap 'sed_inplace "/# sparking-chaos/d" /etc/hosts' EXIT
    watch_health "$DURATION" fault
    sed_inplace '/# sparking-chaos/d' /etc/hosts; trap - EXIT
    [ "$OS" = "Darwin" ] && dscacheutil -flushcache 2>/dev/null; killall -HUP mDNSResponder 2>/dev/null
    echo "== recovery window =="; watch_health 30 recover
    ;;
  ingestdown)
    need_root; [ -n "$INGEST_HOST" ] || { echo "set INGEST_HOST"; exit 2; }
    echo "== baseline =="; watch_health 10 base
    echo "== blocking outbound 443 to $INGEST_HOST for ${DURATION}s =="
    if [ "$OS" = "Linux" ]; then
      iptables -A OUTPUT -p tcp -d "$INGEST_HOST" --dport 443 -j DROP
      trap 'iptables -D OUTPUT -p tcp -d "$INGEST_HOST" --dport 443 -j DROP 2>/dev/null' EXIT
      watch_health "$DURATION" fault
      iptables -D OUTPUT -p tcp -d "$INGEST_HOST" --dport 443 -j DROP 2>/dev/null; trap - EXIT
    elif [ "$OS" = "Darwin" ]; then
      echo "block drop out proto tcp to $INGEST_HOST port 443" | pfctl -f - -e 2>/dev/null
      trap 'pfctl -d 2>/dev/null' EXIT
      watch_health "$DURATION" fault
      pfctl -d 2>/dev/null; trap - EXIT
    else
      echo "ingestdown not supported on $OS"; exit 2
    fi
    echo "== recovery window =="; watch_health 30 recover
    ;;
  rtspreboot)
    echo "== baseline =="; watch_health 10 base
    echo "== NOW power-cycle the camera/NVR. Watching for OFFLINE→ONLINE recovery (${DURATION}s) =="
    watch_health "$DURATION" reboot
    ;;
  *)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    echo; echo "PASS criterion for every scenario: health goes degraded during the fault,"
    echo "then returns to 'ok' (all cameras online) within the recovery window, with NO"
    echo "worker crash (the control API keeps answering) and NO stalled cameras left over."
    ;;
esac
