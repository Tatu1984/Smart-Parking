//go:build windows

package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/sparking/edge-agent/internal/config"
)

// detach hides the console window and puts the worker in its own process group
// so it keeps running after the GUI exits.
func detach(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x00000008 | 0x00000200, // DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
	}
}

func processAlive(pid int) bool {
	// On Windows, FindProcess only fails for genuinely invalid handles, so we
	// probe with tasklist to confirm the PID is actually present. When the PID
	// is gone, tasklist prints an "INFO: No tasks..." banner instead of a row.
	out, err := exec.Command("tasklist", "/FI", fmt.Sprintf("PID eq %d", pid), "/NH").Output()
	if err != nil {
		return false
	}
	s := string(out)
	return len(s) > 0 && !strings.Contains(s, "No tasks") && !strings.Contains(s, "INFO:")
}

func terminate(pid int) error {
	return exec.Command("taskkill", "/PID", fmt.Sprintf("%d", pid), "/T", "/F").Run()
}

// startupShortcutPath is the per-user Startup folder entry (no admin rights
// needed, runs at login).
func startupShortcutPath() (string, error) {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return "", fmt.Errorf("APPDATA not set")
	}
	return filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs",
		"Startup", "SParkingEdgeAgent.cmd"), nil
}

// EnableAutostart makes the worker start automatically at user login.
func EnableAutostart() error {
	bin, err := workerBinary()
	if err != nil {
		return err
	}
	cfgPath, err := config.DefaultConfigPath()
	if err != nil {
		return err
	}
	path, err := startupShortcutPath()
	if err != nil {
		return err
	}
	// A .cmd that launches the worker minimised/detached at login.
	script := fmt.Sprintf("@echo off\r\nstart \"\" /B \"%s\" --config \"%s\" --service\r\n", bin, cfgPath)
	return os.WriteFile(path, []byte(script), 0o644)
}

// DisableAutostart removes the login entry.
func DisableAutostart() error {
	path, err := startupShortcutPath()
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

// AutostartEnabled reports whether the login entry exists.
func AutostartEnabled() bool {
	path, err := startupShortcutPath()
	if err != nil {
		return false
	}
	_, err = os.Stat(path)
	return err == nil
}
