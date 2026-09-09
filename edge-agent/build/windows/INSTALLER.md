# Building the Windows installer (for the maintainer)

The end result is a single **`SParkingEdgeAgent-Setup.exe`** you share. The person
who receives it double-clicks it; it installs the app + a bundled FFmpeg and
creates shortcuts. They need nothing else (no Go, no manual FFmpeg, no admin).

There are two stages: **build the binaries** (done on Linux/macOS or Windows) and
**compile the installer** (must be on Windows — Inno Setup is Windows-only).

---

## Stage 1 — build + stage the files

On this repo's build machine (Linux with `go` + `mingw-w64` + `curl`/`unzip`):

```bash
cd edge-agent
./build/windows/build-windows.sh
```

This produces `build/windows/dist/`:
```
edge-agent.exe          worker (fresh build)
edge-agent-gui.exe      GUI control panel (fresh build)
ffmpeg/ffmpeg.exe       bundled FFmpeg (auto-downloaded)
ffmpeg/ffprobe.exe
README.txt              end-user instructions
```

If the FFmpeg auto-download is blocked, download a static Windows build yourself
(e.g. https://www.gyan.dev/ffmpeg/builds/ — "release essentials") and copy
`ffmpeg.exe` + `ffprobe.exe` into `build/windows/dist/ffmpeg/`.

> The two `.exe`s are cross-built here. If you'd rather build them natively on
> Windows: `go build -o dist\edge-agent.exe .\cmd\edge-agent` and
> `go build -ldflags "-H windowsgui" -o dist\edge-agent-gui.exe .\cmd\edge-agent-gui`
> (needs Go + a C toolchain for the GUI, e.g. MSYS2/TDM-GCC).

---

## Stage 2 — compile the installer (on Windows)

1. Install **Inno Setup 6**: https://jrsoftware.org/isdl.php
2. Copy the whole `edge-agent\build\windows\` folder (with the populated `dist\`)
   to the Windows machine.
3. Compile:
   ```
   iscc build\windows\installer.iss
   ```
   or open `installer.iss` in the Inno Setup Compiler and press **Compile**.
4. Output: **`build\windows\SParkingEdgeAgent-Setup.exe`** — share this one file.

To stamp a version: `iscc /DAppVersion=1.2.0 build\windows\installer.iss`.

---

## About the SmartScreen warning

The installer is **unsigned**, so on first run Windows SmartScreen shows
"Windows protected your PC" → the user clicks **More info → Run anyway**. This is
normal for new apps. To remove it, sign `SParkingEdgeAgent-Setup.exe` (and the two
`.exe`s) with an **Authenticode code-signing certificate** (paid, from a CA like
DigiCert/Sectigo), then reputation builds over time. Signing is optional and not
required for the app to work.

---

## No-installer fallback

`install.bat` (in this folder) is a minimal alternative that copies the exes and
uses `winget` to fetch FFmpeg — for environments where running the installer
`.exe` isn't possible. The Inno installer is the recommended path.
