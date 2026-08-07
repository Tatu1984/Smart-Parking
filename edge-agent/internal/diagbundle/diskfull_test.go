package diagbundle

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// TestBuildFailsLoudOnDiskFull: when the destination writer is a full disk, Build
// must return an error (fail loud) rather than silently producing a truncated or
// empty bundle.
func TestBuildFailsLoudOnDiskFull(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("/dev/full is Linux-only")
	}
	f, err := os.OpenFile("/dev/full", os.O_WRONLY, 0)
	if err != nil {
		t.Skip("/dev/full not available")
	}
	defer f.Close()

	dir := t.TempDir()
	logPath := filepath.Join(dir, "agent.log")
	// Give the bundle enough content that the zip must actually flush bytes to the
	// (full) destination and hit ENOSPC.
	big := make([]byte, 128*1024)
	for i := range big {
		big[i] = 'x'
	}
	if err := os.WriteFile(logPath, big, 0o600); err != nil {
		t.Fatal(err)
	}

	err = Build(f, Inputs{
		Manifest:           Manifest{AgentVersion: "1.0.0"},
		RedactedConfigYAML: []byte("schemaVersion: 1\n"),
		DiagnosticsJSON:    big,
		AgentLogPath:       logPath,
	})
	if err == nil {
		t.Fatal("Build to a full disk must return an error, got nil")
	}
}
