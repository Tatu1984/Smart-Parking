//go:build windows

package ffmpeg

import (
	"os/exec"
	"syscall"
)

// CREATE_NO_WINDOW prevents a console window from flashing when the worker (a GUI
// app with no console of its own) spawns ffmpeg/ffprobe. Without it, EVERY probe
// and every reconnect pops a cmd window; under a reconnect loop this floods the
// screen with windows and can freeze the machine.
const createNoWindow = 0x08000000

// HideWindow configures cmd so its child process runs with no visible console
// window on Windows. No-op on other platforms (see hidewindow_other.go).
func HideWindow(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags |= createNoWindow
}
