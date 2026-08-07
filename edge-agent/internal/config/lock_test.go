package config

import (
	"path/filepath"
	"testing"
	"time"
)

func TestLockMutualExclusion(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "config.yaml")

	l1, err := AcquireLock(cfg, time.Second)
	if err != nil {
		t.Fatalf("first lock: %v", err)
	}
	// Second acquire (short timeout) must fail while first is held.
	if _, err := AcquireLock(cfg, 300*time.Millisecond); err != ErrLockTimeout {
		t.Errorf("expected lock timeout, got %v", err)
	}
	l1.Release()
	// After release, it's acquirable again.
	l2, err := AcquireLock(cfg, time.Second)
	if err != nil {
		t.Fatalf("re-acquire after release: %v", err)
	}
	l2.Release()
}

func TestValidateBytesRejectsBad(t *testing.T) {
	// Missing token → invalid.
	bad := []byte(`
schemaVersion: 1
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", enabled: true}
`)
	if _, err := ValidateBytes(bad); err == nil {
		t.Error("expected validation error for missing token")
	}
	good := []byte(`
schemaVersion: 1
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", token: t, enabled: true}
`)
	if _, err := ValidateBytes(good); err != nil {
		t.Errorf("valid config rejected: %v", err)
	}
}

func TestSaveValidatedRejectsInvalidLeavesFileUntouched(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	// Write a valid config first.
	c := &Config{SchemaVersion: 1}
	c.Cameras = []CameraConfig{{CameraID: "c", RTSP: "rtsp://h/s", Publish: "https://a/x/index.m3u8", Token: "t", Enabled: true}}
	if err := SaveValidated(path, c); err != nil {
		t.Fatal(err)
	}
	// Now attempt to save an invalid one (no enabled cameras).
	bad := &Config{SchemaVersion: 1}
	bad.Cameras = []CameraConfig{{CameraID: "c", RTSP: "rtsp://h/s", Publish: "https://a/x/index.m3u8", Token: "t", Enabled: false}}
	if err := SaveValidated(path, bad); err == nil {
		t.Error("invalid config should be refused")
	}
	// The live file must still be the valid one.
	got, err := Load(path)
	if err != nil || len(got.EnabledCameras()) != 1 {
		t.Errorf("live config was corrupted by a rejected save: %v", err)
	}
}
