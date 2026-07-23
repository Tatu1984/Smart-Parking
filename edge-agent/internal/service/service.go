// Package service starts, stops, and reports on the background agent process,
// and registers it to run automatically at login/boot.
//
// Design: the GUI and the worker are SEPARATE processes. The GUI launches the
// worker detached (no console window on Windows) and records its PID. Closing
// the GUI therefore does not stop streaming — only the Stop button does.
//
// Auto-start is implemented per OS with the platform's own mechanism:
//   Windows : a Startup-folder shortcut / registry Run entry (no admin needed)
//   macOS   : a launchd LaunchAgent plist (~/Library/LaunchAgents)
//   Linux   : a systemd --user service
package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/sparking/edge-agent/internal/config"
)

// Status describes whether the background worker is currently running.
type Status struct {
	Running bool
	PID     int
}

// workerBinary returns the path to the agent worker binary. It sits next to the
// GUI executable (both are shipped in the same install directory).
func workerBinary() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	dir := filepath.Dir(exe)
	name := "edge-agent"
	if runtime.GOOS == "windows" {
		name = "edge-agent.exe"
	}
	path := filepath.Join(dir, name)
	if _, err := os.Stat(path); err != nil {
		return "", fmt.Errorf("worker binary not found at %s", path)
	}
	return path, nil
}

// CurrentStatus reports whether the worker is running, based on the PID file.
func CurrentStatus() Status {
	pidPath, err := config.PIDPath()
	if err != nil {
		return Status{}
	}
	data, err := os.ReadFile(pidPath)
	if err != nil {
		return Status{}
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 {
		return Status{}
	}
	if !processAlive(pid) {
		// Stale PID file — clean it up so status is accurate.
		_ = os.Remove(pidPath)
		return Status{}
	}
	return Status{Running: true, PID: pid}
}

// Start launches the worker detached and records its PID. No-op if running.
func Start() error {
	if CurrentStatus().Running {
		return nil
	}
	bin, err := workerBinary()
	if err != nil {
		return err
	}
	cfgPath, err := config.DefaultConfigPath()
	if err != nil {
		return err
	}
	if _, err := os.Stat(cfgPath); err != nil {
		return fmt.Errorf("no configuration saved yet — fill in the settings and click Save")
	}

	cmd := exec.Command(bin, "--config", cfgPath, "--service")
	detach(cmd) // platform-specific: no console window, own process group
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start worker: %w", err)
	}

	pidPath, err := config.PIDPath()
	if err != nil {
		return err
	}
	if err := os.WriteFile(pidPath, []byte(strconv.Itoa(cmd.Process.Pid)), 0o600); err != nil {
		return fmt.Errorf("record pid: %w", err)
	}
	// Reap the child when it exits so it doesn't linger as a zombie.
	go func() { _ = cmd.Wait() }()
	return nil
}

// Stop terminates the worker if running. Only this (or a reboot without
// auto-start) stops streaming.
func Stop() error {
	st := CurrentStatus()
	if !st.Running {
		return nil
	}
	if err := terminate(st.PID); err != nil {
		return fmt.Errorf("stop worker: %w", err)
	}
	if pidPath, err := config.PIDPath(); err == nil {
		_ = os.Remove(pidPath)
	}
	return nil
}

// Restart applies new configuration by stopping and starting the worker.
func Restart() error {
	if err := Stop(); err != nil {
		return err
	}
	return Start()
}
