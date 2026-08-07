package config

import (
	"os"
	"runtime"
	"testing"
)

// /dev/full is a Linux special file whose writes always fail with ENOSPC. It
// lets us exercise the disk-full path deterministically without root or mounts.
const devFull = "/dev/full"

func requireDevFull(t *testing.T) {
	t.Helper()
	if runtime.GOOS != "linux" {
		t.Skip("/dev/full is Linux-only")
	}
	if _, err := os.Stat(devFull); err != nil {
		t.Skip("/dev/full not available")
	}
}

// TestWriteFileSyncCatchesENOSPC proves the fsync surfaces a full disk. A plain
// os.WriteFile to a buffered fs can report success and only fail at fsync/close;
// writeFileSync must return the ENOSPC.
func TestWriteFileSyncCatchesENOSPC(t *testing.T) {
	requireDevFull(t)
	err := writeFileSync(devFull, []byte("some config bytes that will not fit"), 0o600)
	if err == nil {
		t.Fatal("writeFileSync to /dev/full must fail with ENOSPC, got nil")
	}
}

// TestSaveLeavesExistingConfigIntactOnDiskFull is the core safety invariant: if
// the atomic write can't complete (disk full), the LIVE config must be untouched
// and no .tmp litter left behind.
func TestSaveLeavesExistingConfigIntactOnDiskFull(t *testing.T) {
	requireDevFull(t)

	dir := t.TempDir()
	path := dir + "/config.yaml"

	// Seed a known-good config.
	good := &Config{SchemaVersion: 1}
	good.applyDefaults()
	good.Cameras = []CameraConfig{{
		CameraID: "cam-1", Name: "Front", RTSP: "rtsp://10.0.0.5/s1",
		StreamKey: "sk-1", Token: "tok-1", Enabled: true,
	}}
	if err := Save(path, good); err != nil {
		t.Fatalf("seed save: %v", err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	// Now force the temp-write to fail by making the temp path point at /dev/full.
	// Save builds "<path>.tmp"; symlink that to /dev/full so the write hits ENOSPC
	// while the real config.yaml is a separate inode that must stay intact.
	tmp := path + ".tmp"
	if err := os.Symlink(devFull, tmp); err != nil {
		t.Fatalf("symlink tmp→/dev/full: %v", err)
	}

	// Mutate and attempt to save — this must fail.
	good.Cameras[0].Name = "MUTATED — must not land"
	saveErr := Save(path, good)
	if saveErr == nil {
		t.Fatal("Save must fail when the temp write hits a full disk")
	}

	// The live config must be byte-for-byte what it was.
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("live config unreadable after failed save: %v", err)
	}
	if string(after) != string(before) {
		t.Fatalf("SAFETY: live config was corrupted by a failed save.\nbefore:\n%s\nafter:\n%s", before, after)
	}

	// The symlink we planted counts as the .tmp; Save removes it on failure. A
	// real .tmp regular file must never be left behind either.
	if fi, err := os.Lstat(tmp); err == nil {
		t.Fatalf(".tmp litter left after failed save (mode %v)", fi.Mode())
	}
}

// TestSaveValidatedRejectsThenNoWrite confirms an invalid config never even
// reaches the disk (independent of disk-full, but part of the corruption story).
func TestSaveValidatedRejectsBeforeWrite(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/config.yaml"
	good := &Config{SchemaVersion: 1}
	good.applyDefaults()
	good.Cameras = []CameraConfig{{CameraID: "c", Name: "n", RTSP: "rtsp://x/s", StreamKey: "k", Token: "t", Enabled: true}}
	if err := Save(path, good); err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(path)

	// Invalid: camera with no token.
	bad := &Config{SchemaVersion: 1}
	bad.applyDefaults()
	bad.Cameras = []CameraConfig{{CameraID: "c2", Name: "n2", RTSP: "rtsp://x/s2", StreamKey: "k2", Enabled: true}}
	if err := SaveValidated(path, bad); err == nil {
		t.Fatal("SaveValidated must reject a token-less config")
	}
	after, _ := os.ReadFile(path)
	if string(after) != string(before) {
		t.Fatal("SAFETY: invalid config partially written")
	}
}
