SParking Edge Agent — Windows
=============================

WHAT THIS IS
  A small app that connects to your CCTV cameras on your local network and
  securely streams them to your SParking portal account. It runs on a Windows
  PC that is on the SAME network as your cameras.

INSTALL
  1. Double-click  SParkingEdgeAgent-Setup.exe
  2. If Windows shows a blue "Windows protected your PC" box, click
     "More info" -> "Run anyway" (this happens for new apps that aren't yet
     signed; it is safe).
  3. Follow the wizard. It installs the app for your user only (no admin
     password needed) and bundles everything it requires — you do NOT need to
     install FFmpeg or anything else separately.
  4. (Optional) tick "Start automatically when I sign in" so it keeps running
     after a reboot.

FIRST RUN
  1. Open "SParking Edge Agent" from the Start Menu or Desktop.
  2. In the Portal section, paste the Ingest URL and Token you got from the
     portal when you added the camera (portal -> Add camera). Click Save.
  3. Add your camera: use the Camera ID from the portal, and your camera's
     local RTSP address, e.g.
         rtsp://username:password@192.168.1.100:554/Streaming/Channels/101
  4. Click "Start All". Within a few seconds the camera goes live in your
     portal account. Your camera password never leaves this PC.

REQUIREMENTS
  - Windows 10 or 11 (64-bit).
  - This PC must be on the same local network as the cameras.
  - Outbound internet access (the app only makes outgoing connections — no
     router changes, port-forwarding, or public IP needed).

TROUBLESHOOTING
  - "FFmpeg not found": the installer bundles FFmpeg, so this shouldn't happen.
     If it does, close and reopen the app once. If it persists, reinstall.
  - Camera shows OFFLINE: check the RTSP address, username/password, and that
     this PC can reach the camera (same network).
  - To stop streaming: open the app and click "Stop All", or quit the app if
     auto-start is off.

UNINSTALL
  Settings -> Apps -> "SParking Edge Agent" -> Uninstall. Your saved settings
  are kept in case you reinstall.
