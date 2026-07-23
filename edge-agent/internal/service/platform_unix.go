//go:build !windows

package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"

	"github.com/sparking/edge-agent/internal/config"
)

// detach puts the worker in its own session so it survives the GUI exiting.
func detach(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
}

func processAlive(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	// Signal 0 checks for existence without actually signalling.
	return proc.Signal(syscall.Signal(0)) == nil
}

func terminate(pid int) error {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return err
	}
	// SIGTERM lets the agent shut ffmpeg down cleanly.
	return proc.Signal(syscall.SIGTERM)
}

// ---------------------------------------------------------------------------
// Autostart: launchd on macOS, systemd --user on Linux.
// ---------------------------------------------------------------------------

func autostartPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	if runtime.GOOS == "darwin" {
		return filepath.Join(home, "Library", "LaunchAgents", "io.sparking.edgeagent.plist"), nil
	}
	return filepath.Join(home, ".config", "systemd", "user", "sparking-edge-agent.service"), nil
}

// EnableAutostart registers the worker to start at login/boot.
func EnableAutostart() error {
	bin, err := workerBinary()
	if err != nil {
		return err
	}
	cfgPath, err := config.DefaultConfigPath()
	if err != nil {
		return err
	}
	path, err := autostartPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	if runtime.GOOS == "darwin" {
		plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>io.sparking.edgeagent</string>
  <key>ProgramArguments</key>
  <array>
    <string>%s</string>
    <string>--config</string>
    <string>%s</string>
    <string>--service</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
`, bin, cfgPath)
		if err := os.WriteFile(path, []byte(plist), 0o644); err != nil {
			return err
		}
		// Best-effort load; ignore "already loaded".
		_ = exec.Command("launchctl", "load", "-w", path).Run()
		return nil
	}

	unit := fmt.Sprintf(`[Unit]
Description=SParking CCTV Edge Agent
After=network-online.target

[Service]
ExecStart=%s --config %s --service
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
`, bin, cfgPath)
	if err := os.WriteFile(path, []byte(unit), 0o644); err != nil {
		return err
	}
	_ = exec.Command("systemctl", "--user", "daemon-reload").Run()
	_ = exec.Command("systemctl", "--user", "enable", "sparking-edge-agent.service").Run()
	return nil
}

// DisableAutostart removes the login/boot registration.
func DisableAutostart() error {
	path, err := autostartPath()
	if err != nil {
		return err
	}
	if runtime.GOOS == "darwin" {
		_ = exec.Command("launchctl", "unload", "-w", path).Run()
	} else {
		_ = exec.Command("systemctl", "--user", "disable", "sparking-edge-agent.service").Run()
	}
	err = os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

// AutostartEnabled reports whether the registration exists.
func AutostartEnabled() bool {
	path, err := autostartPath()
	if err != nil {
		return false
	}
	_, err = os.Stat(path)
	return err == nil
}
