#!/usr/bin/env bash
# Build the Windows Edge Agent package (worker + GUI) and stage everything the
# Inno Setup installer needs, INCLUDING a bundled FFmpeg.
#
# Produces build/windows/dist/ :
#   edge-agent.exe            the background worker
#   edge-agent-gui.exe        the control panel (what the user opens)
#   ffmpeg/ffmpeg.exe         bundled FFmpeg (so the user needs no winget/internet)
#   ffmpeg/ffprobe.exe
#   README.txt                end-user instructions
#
# Then compile the installer ON WINDOWS with Inno Setup 6:
#   iscc build\windows\installer.iss     →  build\windows\SParkingEdgeAgent-Setup.exe
#
# Requires (on the build machine): go, mingw-w64 (x86_64-w64-mingw32-gcc),
# and (for auto-fetching ffmpeg) curl + unzip. If ffmpeg can't be fetched here,
# drop ffmpeg.exe + ffprobe.exe into dist/ffmpeg/ manually before compiling.
set -euo pipefail
cd "$(dirname "$0")/../.."   # edge-agent/

VERSION="${VERSION:-$(git describe --tags --always 2>/dev/null || echo 1.0.0)}"
OUT="build/windows/dist"
mkdir -p "$OUT/ffmpeg"

command -v x86_64-w64-mingw32-gcc >/dev/null || {
  echo "ERROR: mingw-w64 not installed (apt install gcc-mingw-w64-x86-64)" >&2; exit 1; }

echo "==> Building Windows worker (edge-agent.exe)"
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 \
  go build -ldflags "-s -w -X main.version=$VERSION" -o "$OUT/edge-agent.exe" ./cmd/edge-agent

echo "==> Building Windows GUI (edge-agent-gui.exe)"
# Fyne needs cgo; -H windowsgui hides the console window behind the app.
CGO_ENABLED=1 GOOS=windows GOARCH=amd64 \
  CC=x86_64-w64-mingw32-gcc CXX=x86_64-w64-mingw32-g++ \
  go build -ldflags "-s -w -H windowsgui -X main.version=$VERSION" \
  -o "$OUT/edge-agent-gui.exe" ./cmd/edge-agent-gui

# --- Bundle FFmpeg (ffmpeg.exe + ffprobe.exe) ------------------------------
if [ -f "$OUT/ffmpeg/ffmpeg.exe" ] && [ -f "$OUT/ffmpeg/ffprobe.exe" ]; then
  echo "==> FFmpeg already staged in $OUT/ffmpeg — skipping download."
else
  echo "==> Fetching a static Windows FFmpeg build (gyan.dev essentials)..."
  FF_URL="${FFMPEG_WIN_URL:-https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip}"
  TMP="$(mktemp -d)"
  if command -v curl >/dev/null && command -v unzip >/dev/null; then
    if curl -fSL "$FF_URL" -o "$TMP/ffmpeg.zip"; then
      unzip -q "$TMP/ffmpeg.zip" -d "$TMP"
      # The zip contains ffmpeg-*-essentials_build/bin/{ffmpeg,ffprobe}.exe
      FFBIN="$(find "$TMP" -type d -name bin | head -1)"
      if [ -n "$FFBIN" ]; then
        cp "$FFBIN/ffmpeg.exe" "$FFBIN/ffprobe.exe" "$OUT/ffmpeg/"
        echo "    bundled ffmpeg + ffprobe."
      else
        echo "    WARN: couldn't locate bin/ in the ffmpeg zip; bundle manually."
      fi
    else
      echo "    WARN: download failed. Drop ffmpeg.exe + ffprobe.exe into $OUT/ffmpeg/ manually."
    fi
  else
    echo "    WARN: need curl + unzip to auto-fetch ffmpeg. Bundle it manually into $OUT/ffmpeg/."
  fi
  rm -rf "$TMP"
fi

cp build/windows/README.txt "$OUT/README.txt"

echo ""
echo "==> Staged package contents:"
ls -lhR "$OUT"
echo ""
echo "NEXT (on a Windows machine with Inno Setup 6 installed):"
echo "  1. Copy the whole build\\windows\\ folder to Windows."
echo "  2. Run:  iscc build\\windows\\installer.iss"
echo "     → produces build\\windows\\SParkingEdgeAgent-Setup.exe"
echo "  3. Share that single Setup.exe. Double-click installs everything."
