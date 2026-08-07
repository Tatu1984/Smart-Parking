package publisher

import "testing"

func TestClassifySource(t *testing.T) {
	cases := []struct {
		detail string
		want   ErrorClass
	}{
		{"401 Unauthorized", ErrClassAuth},
		{"server returned 403 Forbidden", ErrClassAuth},
		{"404 Not Found", ErrClassBadRTSP},
		{"No such stream on device", ErrClassBadRTSP},
		{"Connection timed out", ErrClassSourceUnreachable},
		{"No route to host", ErrClassSourceUnreachable},
		{"could not resolve name (name resolution failed)", ErrClassSourceUnreachable},
		{"some unfamiliar message", ErrClassUnknown},
	}
	for _, c := range cases {
		if got := classifySource(c.detail); got != c.want {
			t.Errorf("classifySource(%q) = %q, want %q", c.detail, got, c.want)
		}
	}
}

func TestClassifyFFmpegStderr(t *testing.T) {
	cases := []struct {
		name   string
		stderr string
		perr   string
		want   ErrorClass
	}{
		{"ffmpeg missing", "", `exec: "ffmpeg": executable file not found in $PATH`, ErrClassFFmpegMissing},
		{"source auth", "rtsp://cam 401 unauthorized", "exit status 1", ErrClassAuth},
		{"source bad path", "rtsp://cam/badpath 404 not found", "exit status 1", ErrClassBadRTSP},
		{"source unreachable", "rtsp://cam connection refused", "exit status 1", ErrClassSourceUnreachable},
		{"codec", "codec not currently supported in container", "exit status 1", ErrClassCodec},
		{"ingest 404", "https://portal/ingest/index.m3u8 HTTP error 404 Not Found", "exit status 1", ErrClassIngestUnreachable},
		{"ingest auth", "https://portal/api/edge/ingest/index.m3u8 HTTP error 403 Forbidden", "exit status 1", ErrClassIngestAuth},
		{"unknown", "some weird internal thing", "exit status 8", ErrClassUnknown},
	}
	for _, c := range cases {
		if got := classifyFFmpegStderr(c.stderr, c.perr); got != c.want {
			t.Errorf("%s: classifyFFmpegStderr = %q, want %q", c.name, got, c.want)
		}
	}
}

func TestErrorHintNonEmptyForClasses(t *testing.T) {
	for _, c := range []ErrorClass{
		ErrClassBadRTSP, ErrClassAuth, ErrClassSourceUnreachable, ErrClassIngestUnreachable,
		ErrClassIngestAuth, ErrClassFFmpegMissing, ErrClassCodec, ErrClassUnknown,
	} {
		if c.Hint() == "" {
			t.Errorf("class %q has empty hint", c)
		}
	}
	// Empty class → empty hint (healthy cameras carry no hint).
	if errorHint("") != "" {
		t.Errorf("empty class should yield empty hint")
	}
}

func TestLineTail(t *testing.T) {
	tl := newLineTail(3)
	for _, l := range []string{"a", "b", "c", "d", "e"} {
		tl.add(l)
	}
	if got := tl.String(); got != "c\nd\ne" {
		t.Errorf("tail = %q, want last 3", got)
	}
}
