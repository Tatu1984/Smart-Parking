package ffmpeg

import (
	"strings"
	"testing"
)

func TestResolveMode(t *testing.T) {
	cases := []struct {
		setting string
		isH265  bool
		want    Mode
	}{
		{"copy", true, ModeCopy},   // forced copy even for H.265
		{"h264", false, ModeTranscode}, // forced transcode
		{"auto", false, ModeCopy},      // H.264 → copy
		{"auto", true, ModeTranscode},  // H.265 → transcode
	}
	for _, c := range cases {
		got, _ := ResolveMode(c.setting, c.isH265)
		if got != c.want {
			t.Errorf("ResolveMode(%q, %v) = %v, want %v", c.setting, c.isH265, got, c.want)
		}
	}
}

func TestArgsCopyMode(t *testing.T) {
	args := Args("rtsp://cam/s", "https://app/x/index.m3u8", "edge_tok", ModeCopy)
	joined := strings.Join(args, " ")

	// Copy mode must not re-encode video.
	if !strings.Contains(joined, "-c:v copy") {
		t.Error("copy mode should use -c:v copy")
	}
	// Always HLS + HTTP PUT.
	for _, want := range []string{"-f hls", "-method PUT", "index.m3u8"} {
		if !strings.Contains(joined, want) {
			t.Errorf("missing %q in args: %s", want, joined)
		}
	}
	// Token becomes an Authorization header.
	if !strings.Contains(joined, "Authorization: Bearer edge_tok") {
		t.Error("expected bearer auth header")
	}
	// RTSP pulled over TCP.
	if !strings.Contains(joined, "-rtsp_transport tcp") {
		t.Error("expected rtsp tcp transport")
	}
}

func TestArgsTranscodeMode(t *testing.T) {
	args := Args("rtsp://cam/s", "https://app/x/index.m3u8", "", ModeTranscode)
	joined := strings.Join(args, " ")
	if !strings.Contains(joined, "libx264") {
		t.Error("transcode mode should encode with libx264")
	}
	// No token → no Authorization header.
	if strings.Contains(joined, "Authorization") {
		t.Error("no token should mean no auth header")
	}
}
