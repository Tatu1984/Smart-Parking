; ============================================================================
;  SParking Edge Agent — Windows installer (Inno Setup script)
;
;  Produces a single SParkingEdgeAgent-Setup.exe that:
;    - installs the worker + GUI to %LOCALAPPDATA%\SParking  (no admin needed)
;    - BUNDLES ffmpeg.exe + ffprobe.exe next to the agent (no winget/internet)
;    - creates Start Menu + Desktop shortcuts
;    - optionally launches the app at the end
;
;  Build it on Windows with Inno Setup 6 (https://jrsoftware.org/isdl.php):
;      iscc installer.iss
;  or via the Inno Setup Compiler GUI (File > Open > Compile).
;
;  Before compiling, place these files in build\windows\dist\ :
;      edge-agent.exe        (built by build-windows.sh / go build)
;      edge-agent-gui.exe    (built by build-windows.sh)
;      ffmpeg\ffmpeg.exe     (from an ffmpeg release — see README)
;      ffmpeg\ffprobe.exe
;  The agent resolves ffmpeg from the ffmpeg\ subfolder automatically.
; ============================================================================

#define AppName "SParking Edge Agent"
#define AppPublisher "SParking"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define GuiExe "edge-agent-gui.exe"

[Setup]
AppId={{7C4E2A1F-9B3D-4E6A-8F12-SPARKINGEDGE01}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
; Per-user install → no administrator rights required.
PrivilegesRequired=lowest
DefaultDirName={localappdata}\SParking
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=SParkingEdgeAgent-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; The app itself needs no restart; keep it clean.
CloseApplications=yes
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"
Name: "autostart";   Description: "Start &automatically when I sign in"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
Source: "dist\edge-agent.exe";     DestDir: "{app}"; Flags: ignoreversion
Source: "dist\edge-agent-gui.exe"; DestDir: "{app}"; Flags: ignoreversion
; Bundled FFmpeg (the agent finds it in the ffmpeg\ subfolder). Marked
; skipifsourcedoesntexist so the installer still builds if you choose to rely on
; a system/winget ffmpeg instead — but bundling is strongly recommended.
Source: "dist\ffmpeg\ffmpeg.exe";  DestDir: "{app}\ffmpeg"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\ffmpeg\ffprobe.exe"; DestDir: "{app}\ffmpeg"; Flags: ignoreversion skipifsourcedoesntexist
Source: "README.txt";              DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\{#AppName}";               Filename: "{app}\{#GuiExe}"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#AppName}";     Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}";         Filename: "{app}\{#GuiExe}"; WorkingDir: "{app}"; Tasks: desktopicon
; Startup-folder shortcut → launches the GUI at login when the task is chosen.
Name: "{userstartup}\{#AppName}";         Filename: "{app}\{#GuiExe}"; WorkingDir: "{app}"; Tasks: autostart

[Run]
; Offer to open the app when the installer finishes.
Filename: "{app}\{#GuiExe}"; Description: "Launch {#AppName} now"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Leave the user's config (%APPDATA%\SParking) intact on uninstall; only remove
; the program files here. (Config lives elsewhere and is the operator's data.)
Type: filesandordirs; Name: "{app}\ffmpeg"
