#!/usr/bin/env bash
# SParking Edge Agent — macOS installer. Copies the app to /Applications.
set -euo pipefail
cd "$(dirname "$0")"

APP="SParking Edge Agent.app"
DEST="/Applications/$APP"

[ -d "$APP" ] || { echo "ERROR: $APP not found next to this script." >&2; exit 1; }

echo "Installing $APP to /Applications ..."
rm -rf "$DEST"
cp -R "$APP" "$DEST"

# Clear the quarantine flag so Gatekeeper doesn't block an unsigned build.
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

echo ""
echo "Installed: $DEST"
echo ""

# --- FFmpeg: required to read the camera and publish video -----------------
if command -v ffmpeg >/dev/null 2>&1; then
  echo "FFmpeg is already installed."
else
  echo "FFmpeg was not found. It is required for streaming."
  if command -v brew >/dev/null 2>&1; then
    printf "Install FFmpeg now with Homebrew? [Y/n] "
    read -r reply
    case "${reply:-Y}" in
      [Yy]*|"")
        echo "Installing FFmpeg (this may take a few minutes)..."
        brew install ffmpeg || echo "Install did not complete. Retry later: brew install ffmpeg"
        ;;
      *) echo "Skipped. Install it later with: brew install ffmpeg" ;;
    esac
  else
    echo "Homebrew is not installed, so FFmpeg cannot be installed automatically."
    echo "  Install Homebrew from https://brew.sh then run:  brew install ffmpeg"
    echo "  (or download a static build from https://ffmpeg.org/download.html)"
  fi
fi

echo ""
echo "============================================================"
echo " NEXT STEPS"
echo "   1. Open 'SParking Edge Agent' from Applications."
echo "      (If macOS blocks it: right-click the app > Open > Open.)"
echo "   2. Paste the settings you were given, click Save, then Start."
echo "   3. Tick 'Start automatically' to keep it running after reboots."
echo "============================================================"
