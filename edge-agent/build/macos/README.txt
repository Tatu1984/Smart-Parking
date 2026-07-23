===========================================================================
 SParking Edge Agent - macOS
===========================================================================

WHAT THIS DOES
  Streams a CCTV camera on your local network to the SParking portal.
  It runs quietly in the background and keeps running after you close the
  control panel window. The camera password never leaves this Mac.


BEFORE YOU START - install FFmpeg (one time)
  Open Terminal and run:

      brew install ffmpeg

  (If you don't have Homebrew: https://brew.sh)
  Check it worked:   ffmpeg -version


INSTALL
  1. Double-click install.sh, or run it from Terminal:
         ./install.sh
  2. It copies "SParking Edge Agent.app" into /Applications.

  If macOS says the app "cannot be opened because the developer cannot be
  verified":  right-click the app  ->  Open  ->  Open.
  (You only need to do this once. This happens because the build is not
  signed with an Apple Developer ID.)


FIRST RUN
  1. Open "SParking Edge Agent" from Applications.
  2. Fill in the settings you were sent:
       - Camera RTSP URL   (your camera's address on the local network)
       - Portal ingest URL (provided by the SParking administrator)
       - Ingest token      (provided by the SParking administrator)
  3. Click "Save settings".
  4. Click "Start".

  The status line should change to "Running (streaming)" and the activity
  log will show "source reachable" then "ffmpeg started".


KEEP IT RUNNING AUTOMATICALLY
  Tick "Start automatically when this computer starts".
  This installs a LaunchAgent so streaming resumes at every login.

  You can close the control panel window at any time - streaming continues.
  Only the "Stop" button stops it.


TROUBLESHOOTING
  "cannot run ffmpeg"
      FFmpeg is not installed or not on PATH:  brew install ffmpeg

  "source not reachable"
      Camera address, username or password is wrong, or the camera is not
      reachable from this Mac. Test the RTSP URL in VLC first:
      File > Open Network... > paste the rtsp:// URL.

  Uploads failing / 401 errors in the log
      The ingest token is wrong or was rotated. Ask the SParking
      administrator for a fresh token and update the settings.


FILES
  Settings and logs are stored in:
      ~/Library/Application Support/SParking/config.yaml
      ~/Library/Application Support/SParking/agent.log

  The settings file contains your access token - do not share it.


UNINSTALL
  1. Open the control panel, click Stop, untick "Start automatically".
  2. Delete /Applications/SParking Edge Agent.app
  3. Delete ~/Library/Application Support/SParking
===========================================================================
