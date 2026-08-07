// Package rotatelog is a tiny size-based rotating file writer (stdlib only, no
// external deps). When the active file exceeds MaxSizeMB it is rotated to
// <name>.1, older backups shift up, and the oldest beyond MaxBackups is dropped.
// Used for agent.log and audit.log so a long-running site never fills the disk.
package rotatelog

import (
	"os"
	"path/filepath"
	"strconv"
	"sync"
)

// Writer is an io.Writer that rotates by size. Safe for concurrent use.
type Writer struct {
	mu         sync.Mutex
	path       string
	maxBytes   int64
	maxBackups int
	f          *os.File
	size       int64
}

// New opens (appends to) path with the given rotation limits. maxSizeMB<=0 → 5;
// maxBackups<=0 → 3.
func New(path string, maxSizeMB, maxBackups int) (*Writer, error) {
	if maxSizeMB <= 0 {
		maxSizeMB = 5
	}
	if maxBackups <= 0 {
		maxBackups = 3
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	w := &Writer{path: path, maxBytes: int64(maxSizeMB) * 1024 * 1024, maxBackups: maxBackups}
	if err := w.open(); err != nil {
		return nil, err
	}
	return w, nil
}

func (w *Writer) open() error {
	f, err := os.OpenFile(w.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	fi, err := f.Stat()
	if err != nil {
		f.Close()
		return err
	}
	w.f = f
	w.size = fi.Size()
	return nil
}

func (w *Writer) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.size+int64(len(p)) > w.maxBytes {
		// rotate() guarantees w.f is a valid open handle whether it succeeds or
		// fails (on a full disk it leaves the current file open), so the write
		// below is always safe — no writes to a closed fd, no lost logs.
		_ = w.rotate()
	}
	if w.f == nil {
		// Defensive: should never happen (rotate keeps a handle), but never panic
		// on a nil fd — try to reopen, and if even that fails, drop this write.
		if err := w.open(); err != nil {
			return 0, err
		}
	}
	n, err := w.f.Write(p)
	w.size += int64(n)
	return n, err
}

// rotate shifts backups (name.(n-1)→name.n …), moves the active file to name.1,
// drops name.(maxBackups+1), and opens a fresh active file.
//
// DISK-FULL SAFETY: the active file is only closed AFTER a successful rename to
// name.1, and a new active file is opened only if that rename succeeded. If any
// step fails (e.g. ENOSPC — no room to create the new file), w.f is left as a
// valid, open handle to whatever file is still the active path, so Write can
// keep appending. We never end up with a nil or closed w.f.
func (w *Writer) rotate() error {
	// Best-effort backup shuffle — these are non-destructive to the active file.
	_ = os.Remove(w.backupName(w.maxBackups))
	for i := w.maxBackups - 1; i >= 1; i-- {
		_ = os.Rename(w.backupName(i), w.backupName(i+1))
	}

	// Commit point: rename the active file to name.1. If this fails, the active
	// file is untouched and still open — bail, keep appending to it.
	if err := os.Rename(w.path, w.backupName(1)); err != nil {
		return err
	}

	// The old active file is now at name.1. Close our handle to it and open a
	// fresh active file. If the open fails (disk full), recover a working handle
	// by reopening name.1 (append) so logging continues rather than dying.
	_ = w.f.Close()
	w.f = nil
	if err := w.open(); err != nil {
		if f, rerr := os.OpenFile(w.backupName(1), os.O_WRONLY|os.O_APPEND, 0o600); rerr == nil {
			w.f = f
			if fi, serr := f.Stat(); serr == nil {
				w.size = fi.Size()
			}
		}
		return err
	}
	return nil
}

func (w *Writer) backupName(i int) string {
	return w.path + "." + strconv.Itoa(i)
}

// Close closes the underlying file.
func (w *Writer) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.f != nil {
		return w.f.Close()
	}
	return nil
}
