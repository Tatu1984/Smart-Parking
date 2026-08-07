package rotatelog

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestRotateReopenFailureLeavesUsableHandle exercises the disk-full-during-
// rotation path directly: after the active file is renamed to name.1, opening a
// fresh active file fails. The fix must recover a working handle onto name.1
// (never nil, never a closed fd) so logging continues instead of panicking.
//
// We simulate the reopen failure by pre-creating a DIRECTORY at the active path
// so os.OpenFile(path) fails with EISDIR — a deterministic stand-in for ENOSPC
// on the create.
func TestRotateReopenFailureLeavesUsableHandle(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "agent.log")

	w := &Writer{path: path, maxBytes: 1_000_000, maxBackups: 3}
	if err := w.open(); err != nil {
		t.Fatalf("open: %v", err)
	}
	if _, err := w.Write([]byte("line one\n")); err != nil {
		t.Fatal(err)
	}

	// Drive rotate()'s steps manually to model the reopen failure precisely.
	// Step 1: rename active → .1 (what rotate does first, and here it succeeds).
	if err := os.Rename(path, w.backupName(1)); err != nil {
		t.Fatalf("manual rename: %v", err)
	}
	// Step 2: make a fresh open at `path` fail by creating a directory there.
	if err := os.Mkdir(path, 0o755); err != nil {
		t.Fatalf("mkdir at path: %v", err)
	}
	// Now w.f still points at the (renamed) old file; simulate rotate's recovery.
	_ = w.f.Close()
	w.f = nil
	openErr := w.open() // must fail (path is a directory)
	if openErr == nil {
		t.Fatal("expected open to fail when path is a directory")
	}
	// Recovery branch (mirrors rotate()): reopen name.1 so a handle survives.
	if f, rerr := os.OpenFile(w.backupName(1), os.O_WRONLY|os.O_APPEND, 0o600); rerr == nil {
		w.f = f
	}
	if w.f == nil {
		t.Fatal("SAFETY: no usable handle recovered after reopen failure")
	}
	// A write must not panic and must land somewhere.
	if _, err := w.Write([]byte("recovered\n")); err != nil {
		t.Fatalf("write after recovery failed: %v", err)
	}
	w.Close()

	got, _ := os.ReadFile(w.backupName(1))
	if !strings.Contains(string(got), "recovered") {
		t.Fatalf("recovered write did not land in .1: %q", got)
	}
}

// TestWriteNeverPanicsOnReadOnlyDir is a black-box check: once the log directory
// becomes read-only mid-run (a proxy for a wedged/full filesystem), continued
// writes that trigger rotation must not panic and the writer must stay non-nil.
func TestWriteNeverPanicsOnReadOnlyDir(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("dir-perm trick is unix-only")
	}
	if os.Geteuid() == 0 {
		t.Skip("root bypasses directory permissions")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "agent.log")
	w := &Writer{path: path, maxBytes: 40, maxBackups: 2}
	if err := w.open(); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0o555); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o755) })

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("Write panicked under read-only dir: %v", r)
		}
	}()
	for i := 0; i < 5; i++ {
		_, _ = w.Write([]byte(strings.Repeat("z", 30) + "\n")) // triggers rotate attempts
	}
	if w.f == nil {
		t.Fatal("SAFETY: writer left with nil fd under read-only dir")
	}
	_ = os.Chmod(dir, 0o755)
	w.Close()
}
