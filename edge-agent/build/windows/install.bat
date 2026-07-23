@echo off
REM ===========================================================================
REM  SParking Edge Agent - Windows installer
REM
REM  Installs to %LOCALAPPDATA%\SParking (no admin rights required) and creates
REM  a Start Menu + Desktop shortcut for the control panel.
REM ===========================================================================
setlocal

set "TARGET=%LOCALAPPDATA%\SParking"
set "SRC=%~dp0"

echo.
echo  Installing SParking Edge Agent to %TARGET%
echo.

if not exist "%TARGET%" mkdir "%TARGET%"

copy /Y "%SRC%edge-agent.exe"     "%TARGET%\edge-agent.exe"     >nul
copy /Y "%SRC%edge-agent-gui.exe" "%TARGET%\edge-agent-gui.exe" >nul
if errorlevel 1 (
  echo  ERROR: copy failed. Is the agent currently running? Stop it and retry.
  pause
  exit /b 1
)

REM --- Start Menu shortcut -------------------------------------------------
set "SM=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
powershell -NoProfile -Command ^
  "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SM%\SParking Edge Agent.lnk');" ^
  "$s.TargetPath='%TARGET%\edge-agent-gui.exe'; $s.WorkingDirectory='%TARGET%';" ^
  "$s.Description='SParking Edge Agent control panel'; $s.Save()" >nul 2>&1

REM --- Desktop shortcut ----------------------------------------------------
powershell -NoProfile -Command ^
  "$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\SParking Edge Agent.lnk');" ^
  "$s.TargetPath='%TARGET%\edge-agent-gui.exe'; $s.WorkingDirectory='%TARGET%';" ^
  "$s.Description='SParking Edge Agent control panel'; $s.Save()" >nul 2>&1

echo  Application files installed.
echo.

REM --- FFmpeg: required to read the camera and publish video ---------------
echo  Checking for FFmpeg...
where ffmpeg >nul 2>&1
if %errorlevel%==0 (
  echo  FFmpeg is already installed.
  goto :ffmpeg_done
)

echo  FFmpeg was not found. It is required for streaming.
where winget >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Could not find "winget" to install it automatically.
  echo  Please install FFmpeg manually from https://ffmpeg.org/download.html
  echo  and make sure ffmpeg.exe is on your PATH.
  goto :ffmpeg_done
)

choice /C YN /M "  Install FFmpeg now automatically (requires internet)"
if errorlevel 2 (
  echo  Skipped. Install it later with:  winget install Gyan.FFmpeg
  goto :ffmpeg_done
)

echo  Installing FFmpeg, this may take a few minutes...
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
  echo.
  echo  Automatic install did not complete. You can retry later with:
  echo      winget install Gyan.FFmpeg
) else (
  echo  FFmpeg installed.
)

:ffmpeg_done
echo.
echo  ===============================================================
echo   Installation complete.
echo.
echo   NEXT STEPS:
echo     1. Open "SParking Edge Agent" from the Start Menu or Desktop.
echo        (If FFmpeg was just installed, the app will find it once
echo         you reopen it - PATH changes need a fresh launch.)
echo     2. Paste the settings you were given, click Save, then Start.
echo     3. Tick "Start automatically" to keep it running after reboots.
echo  ===============================================================
echo.
pause
