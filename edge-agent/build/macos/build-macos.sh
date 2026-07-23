#!/usr/bin/env bash
# Build the macOS Edge Agent package.
#
# *** RUN THIS ON A MAC. ***
# Fyne uses cgo against native macOS frameworks, so a macOS build requires the
# Apple SDK — it cannot be cross-compiled from Linux/Windows.
#
# Produces build/macos/dist/ containing:
#   SParking Edge Agent.app   the control panel (double-clickable)
#     └─ Contents/MacOS/edge-agent        the background worker (bundled)
#   install.sh                copies the .app to /Applications
#   README.txt                end-user instructions
#
# Requires: Xcode command line tools (xcode-select --install), Go 1.22+.
set -euo pipefail
cd "$(dirname "$0")/../.."   # edge-agent/

VERSION="${VERSION:-$(git describe --tags --always 2>/dev/null || echo dev)}"
OUT="build/macos/dist"
APP="$OUT/SParking Edge Agent.app"
ARCH="${ARCH:-$(uname -m)}"   # arm64 (Apple Silicon) or x86_64 (Intel)
GOARCH="arm64"; [ "$ARCH" = "x86_64" ] && GOARCH="amd64"

[ "$(uname -s)" = "Darwin" ] || { echo "ERROR: run this on macOS." >&2; exit 1; }

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "==> Building worker (edge-agent) for darwin/$GOARCH"
CGO_ENABLED=0 GOOS=darwin GOARCH=$GOARCH \
  go build -ldflags "-s -w -X main.version=$VERSION" \
  -o "$APP/Contents/MacOS/edge-agent" ./cmd/edge-agent

echo "==> Building GUI (control panel) for darwin/$GOARCH"
CGO_ENABLED=1 GOOS=darwin GOARCH=$GOARCH \
  go build -ldflags "-s -w -X main.version=$VERSION" \
  -o "$APP/Contents/MacOS/edge-agent-gui" ./cmd/edge-agent-gui

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>SParking Edge Agent</string>
  <key>CFBundleDisplayName</key><string>SParking Edge Agent</string>
  <key>CFBundleIdentifier</key><string>io.sparking.edgeagent</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>edge-agent-gui</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

cp build/macos/install.sh "$OUT/install.sh"
cp build/macos/README.txt "$OUT/README.txt"
chmod +x "$OUT/install.sh"

echo ""
echo "==> Built: $APP"
echo ""
echo "OPTIONAL (recommended for distribution) — sign and notarize so Gatekeeper"
echo "does not block it on your friend's Mac:"
echo "  codesign --deep --force --options runtime -s \"Developer ID Application: <you>\" \"$APP\""
echo "  ditto -c -k --keepParent \"$APP\" SParkingEdgeAgent.zip"
echo "  xcrun notarytool submit SParkingEdgeAgent.zip --apple-id <id> --team-id <team> --wait"
echo "  xcrun stapler staple \"$APP\""
echo ""
echo "Without signing, the user must right-click the app > Open, and approve"
echo "it once in System Settings > Privacy & Security."
