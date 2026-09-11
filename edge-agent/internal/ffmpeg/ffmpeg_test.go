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

func TestArgsHLSWindowIsLargeEnough(t *testing.T) {
	args := Args("rtsp://cam/s", "https://app/x/index.m3u8", "", ModeCopy)
	joined := strings.Join(args, " ")

	// A browser plays several seconds behind the live edge; too small a window
	// deletes segments before they are fetched → 404s and the replay loop. The
	// window plus the delete threshold must comfortably exceed that lag.
	for _, want := range []string{
		"-hls_time 2",
		"-hls_list_size 10",
		"-hls_delete_threshold 6",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("missing %q in args: %s", want, joined)
		}
	}
	// append_list keeps numbering continuous across an ffmpeg restart (no reset
	// to index0), delete_segments bounds storage, program_date_time lets the
	// player pin the live edge.
	for _, flag := range []string{"delete_segments", "append_list", "program_date_time", "omit_endlist"} {
		if !strings.Contains(joined, flag) {
			t.Errorf("missing hls flag %q in args: %s", flag, joined)
		}
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
