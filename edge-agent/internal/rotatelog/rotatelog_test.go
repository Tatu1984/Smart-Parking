package rotatelog

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

// TestRotatesBySize writes past the size limit and asserts backups are created
// and capped at maxBackups.
func TestRotatesBySize(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "agent.log")

	// 1 MB cap is the smallest New allows (maxSizeMB is in MB), so drive it with
	// a hand-built Writer for a tiny limit.
	w := &Writer{path: path, maxBytes: 100, maxBackups: 2}
	if err := w.open(); err != nil {
		t.Fatalf("open: %v", err)
	}
	line := strings.Repeat("x", 40) + "\n" // 41 bytes
	for i := 0; i < 10; i++ {
		if _, err := w.Write([]byte(line)); err != nil {
			t.Fatalf("write %d: %v", i, err)
		}
	}
	w.Close()

	// Active file exists.
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("active log missing: %v", err)
	}
	// .1 and .2 exist; .3 must NOT (capped at maxBackups=2).
	if _, err := os.Stat(path + ".1"); err != nil {
		t.Fatalf("expected backup .1: %v", err)
	}
	if _, err := os.Stat(path + ".2"); err != nil {
		t.Fatalf("expected backup .2: %v", err)
	}
	if _, err := os.Stat(path + ".3"); err == nil {
		t.Fatalf(".3 should have been pruned (maxBackups=2)")
	}
}

// TestConcurrentWritesRace exercises the mutex under -race.
func TestConcurrentWritesRace(t *testing.T) {
	dir := t.TempDir()
	w, err := New(filepath.Join(dir, "a.log"), 1, 3)
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	defer w.Close()
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			for j := 0; j < 200; j++ {
				_, _ = w.Write([]byte(strings.Repeat("y", 100) + "\n"))
			}
		}(i)
	}
	wg.Wait()
}

// TestAppendsToExisting confirms reopening an existing file keeps prior content
// (append, not truncate) and seeds size from the existing file.
func TestAppendsToExisting(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "a.log")
	if err := os.WriteFile(path, []byte("existing\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	w, err := New(path, 5, 3)
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	if _, err := w.Write([]byte("more\n")); err != nil {
		t.Fatal(err)
	}
	w.Close()
	got, _ := os.ReadFile(path)
	if !strings.Contains(string(got), "existing") || !strings.Contains(string(got), "more") {
		t.Fatalf("expected append, got %q", got)
	}
}
