#!/usr/bin/env bash
# Build the Windows Edge Agent package (worker + GUI) from Linux via mingw-w64.
#
# Produces build/windows/dist/ containing:
#   edge-agent.exe        the background worker
#   edge-agent-gui.exe    the control panel (what the user opens)
#   install.bat           copies both to %LOCALAPPDATA%\SParking and adds a shortcut
#   README.txt            end-user instructions
#
# Requires: go, mingw-w64 (x86_64-w64-mingw32-gcc)
set -euo pipefail
cd "$(dirname "$0")/../.."   # edge-agent/

VERSION="${VERSION:-$(git describe --tags --always 2>/dev/null || echo dev)}"
OUT="build/windows/dist"
mkdir -p "$OUT"

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

cp build/windows/install.bat "$OUT/install.bat"
cp build/windows/README.txt "$OUT/README.txt"

echo ""
echo "==> Done. Package contents:"
ls -lh "$OUT"
echo ""
echo "Zip it for distribution:"
echo "  (cd $OUT && zip -r ../SParkingEdgeAgent-windows.zip .)"
