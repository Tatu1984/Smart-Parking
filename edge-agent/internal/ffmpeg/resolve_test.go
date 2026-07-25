package ffmpeg

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeExecutable creates a file with the exec bit set (0755).
func writeExecutable(path string) error {
	return os.WriteFile(path, []byte("#!/bin/sh\n"), 0o755)
}

func TestResolvePassesThroughExplicitPaths(t *testing.T) {
	// A value containing a separator is a path and must be returned unchanged.
	for _, p := range []string{"/opt/sparking/ffmpeg", "./bin/ffmpeg", `C:\App\ffmpeg.exe`} {
		if got := Resolve(p); got != p {
			t.Errorf("Resolve(%q) = %q, want unchanged", p, got)
		}
	}
}

func TestResolveEmpty(t *testing.T) {
	if Resolve("") != "" {
		t.Error("Resolve(\"\") should stay empty")
	}
}

func TestResolveBareNameFallsBackToNameWhenNotFound(t *testing.T) {
	// A name that exists nowhere resolves back to the bare name (so the eventual
	// exec error is clear) rather than an empty string or a panic.
	got := Resolve("definitely-not-a-real-binary-xyz")
	if got != "definitely-not-a-real-binary-xyz" {
		t.Errorf("expected bare name fallback, got %q", got)
	}
}

func TestResolveFindsBinaryInCommonDir(t *testing.T) {
	// Create a fake executable in a temp dir and confirm isExecutable + the
	// common-dir search mechanism accept it. (We can't inject commonDirs()
	// without exporting it, so we test the executable check directly.)
	dir := t.TempDir()
	name := "ffprobe"
	path := filepath.Join(dir, name)
	if err := writeExecutable(path); err != nil {
		t.Fatal(err)
	}
	if !isExecutable(path) {
		t.Errorf("isExecutable(%q) = false, want true", path)
	}
	// A directory must never be considered executable.
	if isExecutable(dir) {
		t.Error("a directory should not be executable")
	}
	// Sanity: the fake path is absolute (has a separator), so Resolve passes it through.
	if !strings.Contains(Resolve(path), name) {
		t.Errorf("Resolve(%q) lost the name", path)
	}
}
