//go:build !windows

package ffmpeg

import "os/exec"

// HideWindow is a no-op on non-Windows platforms (there is no console window to
// hide). Present so callers can call it unconditionally.
func HideWindow(cmd *exec.Cmd) {}
