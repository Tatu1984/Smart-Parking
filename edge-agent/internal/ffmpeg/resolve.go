package ffmpeg

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// commonDirs lists directories where ffmpeg/ffprobe are commonly installed but
// which a GUI app launched from Finder/Dock does NOT have on its PATH. This is
// the classic macOS gotcha: apps started from the GUI inherit a minimal PATH
// (/usr/bin:/bin:/usr/sbin:/sbin) that excludes Homebrew, so `exec.Command
// ("ffmpeg")` fails even when ffmpeg is installed and works in the terminal.
func commonDirs() []string {
	switch runtime.GOOS {
	case "darwin":
		return []string{
			"/opt/homebrew/bin", // Homebrew on Apple Silicon
			"/usr/local/bin",    // Homebrew on Intel / manual installs
			"/opt/local/bin",    // MacPorts
		}
	case "windows":
		return []string{
			`C:\ffmpeg\bin`,
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "WinGet", "Links"),
			filepath.Join(os.Getenv("ProgramFiles"), "ffmpeg", "bin"),
		}
	default:
		return []string{"/usr/bin", "/usr/local/bin", "/snap/bin"}
	}
}

// Resolve returns a runnable path for a tool ("ffmpeg" or "ffprobe").
//
//   - An absolute/relative path with a separator is returned as-is (a bundled or
//     user-specified binary).
//   - A bare name is first looked up on PATH; if that fails (the GUI-PATH case),
//     the common install directories are searched. Falls back to the bare name.
func Resolve(tool string) string {
	if tool == "" {
		return tool
	}
	// Already a path (contains a separator) — trust it.
	if filepath.Base(tool) != tool {
		return tool
	}

	// 1. Normal PATH lookup.
	if p, err := exec.LookPath(tool); err == nil {
		return p
	}

	// 2. Search known locations the GUI PATH omits.
	name := tool
	if runtime.GOOS == "windows" && filepath.Ext(name) == "" {
		name += ".exe"
	}
	for _, dir := range commonDirs() {
		cand := filepath.Join(dir, name)
		if isExecutable(cand) {
			return cand
		}
	}

	// 3. Give up gracefully — return the bare name so the error is clear.
	return tool
}

func isExecutable(path string) bool {
	fi, err := os.Stat(path)
	if err != nil || fi.IsDir() {
		return false
	}
	if runtime.GOOS == "windows" {
		return true // no exec bit on Windows; existence is enough
	}
	return fi.Mode()&0o111 != 0
}
