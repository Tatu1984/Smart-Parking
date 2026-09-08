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

  2. LINK TO YOUR PORTAL (do this once):
     In the "Portal" section at the top, fill in the two values you were sent:
       - Ingest URL   e.g. https://your-portal.example.com
       - Token        the portal ingest token
     Click "Save connection". The line below shows "Linked to: <your URL>".
     To point this agent at a DIFFERENT portal later, just paste that portal's
     URL + token here and save again.

  3. ADD YOUR CAMERA(S):
     Click "Add camera" and fill in:
       - Camera ID    a stable name, e.g. cam-001 (used as the stream key)
       - Name         a friendly label, e.g. Front Gate
       - Camera RTSP URL   your camera's address on the local network,
                           e.g. rtsp://user:pass@192.168.1.100:554/Streaming/Channels/101
     Leave "Portal publish URL" / "Ingest token" blank to use the Portal
     Connection from step 2 (or fill them to override for this one camera).
     Make sure "Enabled" is ticked, then Save.

  4. Click "Start All" (or Start on the camera row).

  The camera's status should go CONNECTING -> ONLINE, and the activity log
  will show "source reachable" then "ffmpeg started". The feed then appears
  in the portal.


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
