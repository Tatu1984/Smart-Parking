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

func TestLoadValidAppliesDefaults(t *testing.T) {
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
	if c.FFmpeg.Binary != "ffmpeg" {
		t.Errorf("default binary = %q", c.FFmpeg.Binary)
	}
	if c.FFmpeg.Transcode != "auto" {
		t.Errorf("default transcode = %q", c.FFmpeg.Transcode)
	}
	if c.Log.Level != "info" {
		t.Errorf("default log level = %q", c.Log.Level)
	}
}

func TestValidateErrors(t *testing.T) {
	cases := map[string]string{
		"missing rtsp": `
camera: {name: x}
cloud: {publish: "https://a/api/edge/ingest/k/index.m3u8"}`,
		"missing publish": `
camera: {name: x, rtsp: "rtsp://h/s"}`,
		"publish not http": `
camera: {rtsp: "rtsp://h/s"}
cloud: {publish: "ftp://a/index.m3u8"}`,
		"publish not m3u8": `
camera: {rtsp: "rtsp://h/s"}
cloud: {publish: "https://a/api/edge/ingest/k/"}`,
		"bad transcode": `
camera: {rtsp: "rtsp://h/s"}
cloud: {publish: "https://a/x/index.m3u8"}
ffmpeg: {transcode: potato}`,
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
