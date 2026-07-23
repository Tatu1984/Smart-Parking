===========================================================================
 SParking Edge Agent - Windows
===========================================================================

WHAT THIS DOES
  Streams a CCTV camera on your local network to the SParking portal.
  It runs quietly in the background and keeps running after you close the
  control panel window. Video never passes through any third party - the
  camera password stays on this computer.


BEFORE YOU START - install FFmpeg (one time)
  Open PowerShell and run:

      winget install Gyan.FFmpeg

  Then CLOSE and REOPEN PowerShell (so Windows picks up the new PATH) and
  check it worked:

      ffmpeg -version


INSTALL
  1. Right-click install.bat  ->  "Run as administrator" is NOT needed;
     a normal double-click is fine.
  2. It installs to  %LOCALAPPDATA%\SParking  and adds Start Menu and
     Desktop shortcuts.


FIRST RUN
  1. Open "SParking Edge Agent" (Start Menu or Desktop).
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
  The agent will then begin streaming on every login, with no window shown.

  You can close the control panel window at any time - streaming continues.
  Only the "Stop" button stops it.


TROUBLESHOOTING
  "cannot run ffmpeg"
      FFmpeg is not installed or not on PATH. See "BEFORE YOU START".

  "source not reachable"
      The camera address, username or password is wrong, or the camera is
      not reachable from this computer. Test the RTSP URL first, e.g. with
      VLC:  Media > Open Network Stream > paste the rtsp:// URL.

  Status stays "Stopped" after clicking Start
      Check the activity log at the bottom of the window for the reason.

  Uploads failing / 401 errors in the log
      The ingest token is wrong or has been rotated. Ask the SParking
      administrator for a fresh token and update the settings.


FILES
  Settings and logs are stored in:
      %APPDATA%\SParking\config.yaml
      %APPDATA%\SParking\agent.log

  The settings file contains your access token - do not share it.


UNINSTALL
  1. Open the control panel, click Stop, untick "Start automatically".
  2. Delete the folder  %LOCALAPPDATA%\SParking
  3. Delete the Start Menu and Desktop shortcuts.
===========================================================================
