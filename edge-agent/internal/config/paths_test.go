package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAppDirIsCreatedAndStable(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmp)
	t.Setenv("APPDATA", tmp)
	t.Setenv("HOME", tmp)

	dir, err := AppDir()
	if err != nil {
		t.Fatalf("AppDir: %v", err)
	}
	if fi, err := os.Stat(dir); err != nil || !fi.IsDir() {
		t.Fatalf("AppDir did not create a directory: %v", err)
	}
	// Calling again must return the same path (both binaries rely on this).
	again, err := AppDir()
	if err != nil || again != dir {
		t.Fatalf("AppDir not stable: %q vs %q (%v)", dir, again, err)
	}
}

func TestConfigLogPidPathsShareAppDir(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmp)
	t.Setenv("APPDATA", tmp)
	t.Setenv("HOME", tmp)

	cfg, err := DefaultConfigPath()
	if err != nil {
		t.Fatal(err)
	}
	logp, err := LogPath()
	if err != nil {
		t.Fatal(err)
	}
	pid, err := PIDPath()
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(cfg) != filepath.Dir(logp) || filepath.Dir(cfg) != filepath.Dir(pid) {
		t.Errorf("paths not in the same dir: %s / %s / %s", cfg, logp, pid)
	}
	if !strings.HasSuffix(cfg, "config.yaml") {
		t.Errorf("unexpected config filename: %s", cfg)
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "nested", "config.yaml")

	in := &Config{}
	in.Cameras = []CameraConfig{{
		CameraID: "cam-001",
		Name:     "Gate Cam",
		RTSP:     "rtsp://user:p@ss@10.0.0.5:554/s",
		Publish:  "https://app.example.com/api/edge/ingest/k/index.m3u8",
		Token:    "edge_secret",
		Enabled:  true,
	}}
	in.FFmpeg.Transcode = "auto"

	if err := Save(path, in); err != nil {
		t.Fatalf("Save: %v", err)
	}

	// The file holds a live token — it must not be world-readable.
	fi, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if perm := fi.Mode().Perm(); perm != 0o600 {
		t.Errorf("config perms = %o, want 600", perm)
	}

	out, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(out.Cameras) != 1 ||
		out.Cameras[0].RTSP != in.Cameras[0].RTSP ||
		out.Cameras[0].Token != in.Cameras[0].Token {
		t.Errorf("round-trip mismatch: %+v", out)
	}
	// Save must stamp the current schema version.
	if out.SchemaVersion != CurrentSchemaVersion {
		t.Errorf("schemaVersion = %d, want %d", out.SchemaVersion, CurrentSchemaVersion)
	}
}

func TestLoadOrDefaultOnMissingFile(t *testing.T) {
	c := LoadOrDefault(filepath.Join(t.TempDir(), "nope.yaml"))
	if c == nil {
		t.Fatal("expected a defaulted config, got nil")
	}
	if c.FFmpeg.Transcode != "auto" || c.FFmpeg.Binary != "ffmpeg" {
		t.Errorf("defaults not applied: %+v", c.FFmpeg)
	}
}
