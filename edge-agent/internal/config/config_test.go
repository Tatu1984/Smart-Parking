package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeTemp(t *testing.T, body string) string {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

// A legacy (schema v0, unversioned single-camera) config must still load, by
// migrating into a one-element Cameras list.
func TestLoadLegacySingleCameraMigrates(t *testing.T) {
	p := writeTemp(t, `
cameraId: cam1
camera:
  name: Cam One
  rtsp: rtsp://user:pass@192.168.1.10:554/s
cloud:
  publish: https://app.example.com/api/edge/ingest/cam1/index.m3u8
  token: edge_abc
`)
	c, err := Load(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.SchemaVersion != CurrentSchemaVersion {
		t.Errorf("schemaVersion = %d, want %d (migration should stamp it)", c.SchemaVersion, CurrentSchemaVersion)
	}
	if len(c.Cameras) != 1 {
		t.Fatalf("expected 1 migrated camera, got %d", len(c.Cameras))
	}
	cam := c.Cameras[0]
	if cam.RTSP != "rtsp://user:pass@192.168.1.10:554/s" || cam.Token != "edge_abc" || !cam.Enabled {
		t.Errorf("legacy fields not folded correctly: %+v", cam)
	}
	if c.FFmpeg.Binary != "ffmpeg" || c.FFmpeg.Transcode != "auto" || c.Log.Level != "info" {
		t.Errorf("defaults not applied: %+v %+v", c.FFmpeg, c.Log)
	}
}

// A modern multi-camera config loads all cameras.
func TestLoadMultiCamera(t *testing.T) {
	p := writeTemp(t, `
schemaVersion: 1
agentId: lot-01
cameras:
  - cameraId: cam-a
    name: Gate A
    rtsp: rtsp://h/a
    publish: https://app/api/edge/ingest/a/index.m3u8
    token: edge_a
    enabled: true
  - cameraId: cam-b
    name: Gate B
    rtsp: rtsp://h/b
    publish: https://app/api/edge/ingest/b/index.m3u8
    token: edge_b
    enabled: true
`)
	c, err := Load(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(c.Cameras) != 2 {
		t.Fatalf("expected 2 cameras, got %d", len(c.Cameras))
	}
	if len(c.EnabledCameras()) != 2 {
		t.Errorf("expected 2 enabled, got %d", len(c.EnabledCameras()))
	}
}

// A config whose schemaVersion is newer than this build must be refused clearly.
func TestLoadRejectsNewerSchema(t *testing.T) {
	p := writeTemp(t, `
schemaVersion: 999
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", token: t, enabled: true}
`)
	_, err := Load(p)
	if err == nil || !strings.Contains(err.Error(), "newer than this agent supports") {
		t.Errorf("expected a clear newer-version error, got %v", err)
	}
}

// A disabled camera and a channel/subtype+template camera both behave correctly.
func TestTemplateAndDisabled(t *testing.T) {
	p := writeTemp(t, `
schemaVersion: 1
portalBaseUrl: https://app.example.com
rtspTemplate: "rtsp://u:p@10.0.0.5:554/cam?channel={channel}&subtype={subtype}"
cameras:
  - cameraId: cam-a
    name: A
    channel: 2
    subtype: 0
    streamKey: keyA
    token: edge_a
    enabled: true
  - cameraId: cam-b
    name: B (off)
    rtsp: rtsp://h/b
    publish: https://app/x/index.m3u8
    token: edge_b
    enabled: false
`)
	c, err := Load(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(c.EnabledCameras()) != 1 {
		t.Fatalf("expected 1 enabled camera, got %d", len(c.EnabledCameras()))
	}
	cam := c.EnabledCameras()[0]
	rtsp, _ := c.EffectiveRTSP(&cam)
	if rtsp != "rtsp://u:p@10.0.0.5:554/cam?channel=2&subtype=0" {
		t.Errorf("template not expanded: %q", rtsp)
	}
	pub, _ := c.EffectivePublish(&cam)
	if pub != "https://app.example.com/api/edge/ingest/keyA/index.m3u8" {
		t.Errorf("publish not built from streamKey: %q", pub)
	}
}

func TestValidateErrors(t *testing.T) {
	cases := map[string]string{
		"no enabled cameras": `
schemaVersion: 1
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", token: t, enabled: false}`,
		"missing rtsp": `
schemaVersion: 1
cameras:
  - {cameraId: c, name: x, publish: "https://a/api/edge/ingest/k/index.m3u8", token: t, enabled: true}`,
		"missing publish and streamKey": `
schemaVersion: 1
cameras:
  - {cameraId: c, name: x, rtsp: "rtsp://h/s", token: t, enabled: true}`,
		"publish not http": `
schemaVersion: 1
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "ftp://a/index.m3u8", token: t, enabled: true}`,
		"publish not m3u8": `
schemaVersion: 1
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/api/edge/ingest/k/", token: t, enabled: true}`,
		"bad transcode": `
schemaVersion: 1
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", token: t, enabled: true, transcode: potato}`,
		"duplicate ingest target": `
schemaVersion: 1
cameras:
  - {cameraId: c1, rtsp: "rtsp://h/1", publish: "https://a/x/index.m3u8", token: t, enabled: true}
  - {cameraId: c2, rtsp: "rtsp://h/2", publish: "https://a/x/index.m3u8", token: t, enabled: true}`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Load(writeTemp(t, body)); err == nil {
				t.Errorf("expected error for %q", name)
			}
		})
	}
}

func TestRedacted(t *testing.T) {
	got := Redacted("rtsp://admin:secret@192.168.1.10:554/s")
	if strings.Contains(got, "secret") || strings.Contains(got, "admin") {
		t.Errorf("credentials leaked: %s", got)
	}
	if !strings.Contains(got, "***") {
		t.Errorf("expected mask in %s", got)
	}
	// Unparseable input must not panic.
	_ = Redacted("://not a url")
}

func TestFFprobeBinaryPairsWithFFmpeg(t *testing.T) {
	cases := []struct{ ffmpeg, want string }{
		{"", "ffprobe"},                                     // default → PATH
		{"ffmpeg", "ffprobe"},                               // PATH lookup
		{"/opt/sparking/ffmpeg", "/opt/sparking/ffprobe"},   // bundled (unix)
		{`C:\App\bin\ffmpeg.exe`, `C:\App\bin\ffprobe.exe`}, // bundled (windows)
	}
	for _, c := range cases {
		cfg := &Config{}
		cfg.FFmpeg.Binary = c.ffmpeg
		got := cfg.FFprobeBinary()
		// Normalise separators so the windows case passes on linux too.
		if filepath.ToSlash(got) != filepath.ToSlash(c.want) {
			t.Errorf("FFprobeBinary(%q) = %q, want %q", c.ffmpeg, got, c.want)
		}
	}
}

func TestGroupAndCapabilitiesParse(t *testing.T) {
	p := writeTemp(t, `
schemaVersion: 1
groups: [Entrance, Basement]
cameras:
  - cameraId: cam-a
    name: Gate
    group: Entrance
    rtsp: rtsp://h/a
    publish: https://app/api/edge/ingest/a/index.m3u8
    token: edge_a
    enabled: true
    capabilities:
      supportsPtz: true
      supportsAi: true
`)
	c, err := Load(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(c.Groups) != 2 || c.Groups[0] != "Entrance" {
		t.Errorf("groups not parsed: %v", c.Groups)
	}
	cam := c.Cameras[0]
	if cam.Group != "Entrance" {
		t.Errorf("camera group = %q", cam.Group)
	}
	if !cam.Capabilities.SupportsPTZ || !cam.Capabilities.SupportsAI {
		t.Errorf("capabilities not parsed: %+v", cam.Capabilities)
	}
	if cam.Capabilities.SupportsAudio {
		t.Error("supportsAudio should default false")
	}
}

// A config WITHOUT group/capabilities still loads (back-compat).
func TestNoGroupNoCapabilitiesBackCompat(t *testing.T) {
	p := writeTemp(t, `
schemaVersion: 1
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", token: t, enabled: true}
`)
	c, err := Load(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.Cameras[0].Group != "" {
		t.Error("group should default empty")
	}
}

func TestWatchdogAndBackoffDefaultsAndClamp(t *testing.T) {
	// Defaults when unset.
	p := writeTemp(t, `
schemaVersion: 1
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", token: t, enabled: true}
`)
	c, _ := Load(p)
	if c.Watchdog.StallSeconds != 30 || c.BackoffMaxSeconds != 30 {
		t.Errorf("defaults wrong: stall=%d backoff=%d", c.Watchdog.StallSeconds, c.BackoffMaxSeconds)
	}
	if c.Log.MaxSizeMB != 5 || c.Log.MaxBackups != 3 {
		t.Errorf("log defaults wrong: %d x %d", c.Log.MaxSizeMB, c.Log.MaxBackups)
	}

	// Clamp below min.
	p2 := writeTemp(t, `
schemaVersion: 1
watchdog: {stallSeconds: 5}
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", token: t, enabled: true}
`)
	c2, _ := Load(p2)
	if c2.Watchdog.StallSeconds != 15 {
		t.Errorf("stall should clamp to 15, got %d", c2.Watchdog.StallSeconds)
	}

	// Clamp above max.
	p3 := writeTemp(t, `
schemaVersion: 1
watchdog: {stallSeconds: 999}
cameras:
  - {cameraId: c, rtsp: "rtsp://h/s", publish: "https://a/x/index.m3u8", token: t, enabled: true}
`)
	c3, _ := Load(p3)
	if c3.Watchdog.StallSeconds != 120 {
		t.Errorf("stall should clamp to 120, got %d", c3.Watchdog.StallSeconds)
	}
}
