package ffmpeg

import (
	"os/exec"
	"runtime"
)

// Availability reports whether the tools the agent needs are runnable.
// The agent requires BOTH ffmpeg (to publish) and ffprobe (to detect the
// source codec), which ship together in every FFmpeg distribution.
type Availability struct {
	FFmpegOK  bool
	FFprobeOK bool
	Version   string // ffmpeg version line when available
	// Resolved absolute paths (may differ from the input when found off-PATH,
	// e.g. Homebrew on macOS for a Finder-launched GUI).
	FFmpegPath  string
	FFprobePath string
}

// OK is true only when both tools are usable.
func (a Availability) OK() bool { return a.FFmpegOK && a.FFprobeOK }

// InstallHint returns the exact command the user should run on this platform.
func InstallHint() string {
	switch runtime.GOOS {
	case "windows":
		return "winget install Gyan.FFmpeg   (then reopen this app)"
	case "darwin":
		return "brew install ffmpeg"
	default:
		return "sudo apt install ffmpeg"
	}
}

// Detect checks that ffmpeg and ffprobe can actually be executed. Paths may be
// bare command names (resolved on PATH) or absolute paths to a bundled copy.
func Detect(ffmpegBin, ffprobeBin string) Availability {
	if ffmpegBin == "" {
		ffmpegBin = "ffmpeg"
	}
	if ffprobeBin == "" {
		ffprobeBin = "ffprobe"
	}
	// Resolve off-PATH locations (Homebrew etc.) so a Finder-launched GUI finds
	// the same binaries the terminal does.
	ffmpegBin = Resolve(ffmpegBin)
	ffprobeBin = Resolve(ffprobeBin)

	a := Availability{FFmpegPath: ffmpegBin, FFprobePath: ffprobeBin}

	if out, err := exec.Command(ffmpegBin, "-hide_banner", "-version").Output(); err == nil {
		a.FFmpegOK = true
		if len(out) > 0 {
			a.Version = firstLine(string(out))
		}
	}
	if err := exec.Command(ffprobeBin, "-hide_banner", "-version").Run(); err == nil {
		a.FFprobeOK = true
	}
	return a
}

func firstLine(s string) string {
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' || s[i] == '\r' {
			return s[:i]
		}
	}
	return s
}
