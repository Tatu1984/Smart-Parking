package config

import (
	"os"
	"path/filepath"
	"runtime"
)

// AppName is the per-user directory name used for config/logs.
const AppName = "SParking"

// AppDir returns the per-user application directory, creating it if needed:
//
//	Windows : %APPDATA%\SParking
//	macOS   : ~/Library/Application Support/SParking
//	Linux   : ~/.config/sparking   (XDG_CONFIG_HOME honoured)
//
// Both the GUI and the background service resolve the same path, which is how
// they share configuration without any IPC.
func AppDir() (string, error) {
	var base string
	switch runtime.GOOS {
	case "windows":
		base = os.Getenv("APPDATA")
		if base == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			base = filepath.Join(home, "AppData", "Roaming")
		}
		base = filepath.Join(base, AppName)
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base = filepath.Join(home, "Library", "Application Support", AppName)
	default: // linux and friends
		if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
			base = filepath.Join(xdg, "sparking")
		} else {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			base = filepath.Join(home, ".config", "sparking")
		}
	}
	if err := os.MkdirAll(base, 0o700); err != nil {
		return "", err
	}
	return base, nil
}

// DefaultConfigPath is the shared config file both binaries read/write.
func DefaultConfigPath() (string, error) {
	dir, err := AppDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.yaml"), nil
}

// LogPath is where the background service writes its log (the GUI tails it).
func LogPath() (string, error) {
	dir, err := AppDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "agent.log"), nil
}

// PIDPath records the running service's PID so the GUI can report status and
// stop it.
func PIDPath() (string, error) {
	dir, err := AppDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "agent.pid"), nil
}

// AuditPath is the append-only audit log of lifecycle/operator actions.
func AuditPath() (string, error) {
	dir, err := AppDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "audit.log"), nil
}

// ControlEndpointPath is the 0600 file where the worker publishes its local
// control-API address + token for the GUI to read.
func ControlEndpointPath() (string, error) {
	dir, err := AppDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "control.json"), nil
}
