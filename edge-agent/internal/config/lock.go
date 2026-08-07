package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// ErrLockTimeout is returned when the config lock can't be acquired in time.
var ErrLockTimeout = fmt.Errorf("Another configuration operation is already in progress.")

// Lock is an advisory cross-process config lock (a lockfile). It prevents the
// GUI, CLI, or a second writer from applying config concurrently and corrupting
// state. Acquisition waits up to a timeout, then fails clearly rather than
// freezing the caller.
type Lock struct {
	path string
}

// lockPath is <config-dir>/config.lock.
func lockPath(cfgPath string) string {
	return filepath.Join(filepath.Dir(cfgPath), "config.lock")
}

// AcquireLock tries to take the config lock, waiting up to timeout. A lockfile
// older than staleAfter is treated as abandoned (crashed writer) and reclaimed.
func AcquireLock(cfgPath string, timeout time.Duration) (*Lock, error) {
	lp := lockPath(cfgPath)
	if err := os.MkdirAll(filepath.Dir(lp), 0o700); err != nil {
		return nil, err
	}
	deadline := time.Now().Add(timeout)
	for {
		// O_EXCL: create only if it doesn't exist → atomic "who got here first".
		f, err := os.OpenFile(lp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
		if err == nil {
			fmt.Fprintf(f, "%d\n", os.Getpid())
			f.Close()
			return &Lock{path: lp}, nil
		}
		// Reclaim a stale lock (writer crashed without releasing).
		if fi, serr := os.Stat(lp); serr == nil {
			if time.Since(fi.ModTime()) > 30*time.Second {
				_ = os.Remove(lp)
				continue
			}
		}
		if time.Now().After(deadline) {
			return nil, ErrLockTimeout
		}
		time.Sleep(100 * time.Millisecond)
	}
}

// Release frees the lock.
func (l *Lock) Release() {
	if l != nil {
		_ = os.Remove(l.path)
	}
}
