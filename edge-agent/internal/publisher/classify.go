package publisher

import "strings"

// stderrTailLines is how many trailing ffmpeg stderr lines to retain for
// classification. ffmpeg reports the fatal cause in its last few lines.
const stderrTailLines = 12

// lineTail keeps the last n lines added (a tiny fixed-size ring). Not safe for
// concurrent use; used from a single reader goroutine, read after it finishes.
type lineTail struct {
	buf []string
	n   int
}

func newLineTail(n int) *lineTail { return &lineTail{n: n} }

func (t *lineTail) add(line string) {
	t.buf = append(t.buf, line)
	if len(t.buf) > t.n {
		t.buf = t.buf[len(t.buf)-t.n:]
	}
}

func (t *lineTail) String() string { return strings.Join(t.buf, "\n") }

// ErrorClass is an operator-facing category for a camera failure. It turns raw
// ffmpeg/ffprobe noise into something an installer can act on without reading
// codec logs.
type ErrorClass string

const (
	ErrClassUnknown        ErrorClass = "unknown"
	ErrClassBadRTSP        ErrorClass = "bad-rtsp"         // URL/path wrong, 404, no such stream
	ErrClassAuth           ErrorClass = "auth"             // 401/403, bad camera username/password
	ErrClassSourceUnreachable ErrorClass = "source-unreachable" // camera offline / network / DNS
	ErrClassIngestUnreachable ErrorClass = "ingest-unreachable" // cloud ingest endpoint down/blocked
	ErrClassIngestAuth     ErrorClass = "ingest-auth"       // ingest token rejected (401/403 to portal)
	ErrClassFFmpegMissing  ErrorClass = "ffmpeg-missing"    // ffmpeg/ffprobe not runnable
	ErrClassCodec          ErrorClass = "codec"             // unsupported/negotiation codec failure
)

// hint is the operator-facing remediation for each class.
func (c ErrorClass) Hint() string {
	switch c {
	case ErrClassBadRTSP:
		return "Check the camera's RTSP path/channel — the stream URL appears wrong or the stream does not exist."
	case ErrClassAuth:
		return "Camera rejected the credentials — check the camera username/password in the RTSP URL."
	case ErrClassSourceUnreachable:
		return "Cannot reach the camera — check it is powered on and on the same network as this agent."
	case ErrClassIngestUnreachable:
		return "Cannot reach the SParking ingest endpoint — check this machine's internet/firewall (outbound HTTPS)."
	case ErrClassIngestAuth:
		return "Ingest rejected the token — the camera's ingest token may be wrong or revoked; re-copy it from the portal."
	case ErrClassFFmpegMissing:
		return "FFmpeg is not available — reinstall the Edge Agent or install FFmpeg."
	case ErrClassCodec:
		return "The camera's video format could not be published — try setting this camera's transcode to h264."
	default:
		return "See agent.log for details."
	}
}

// errorHint returns the operator remediation for c, or "" when there is no
// active error (healthy cameras carry no hint).
func errorHint(c ErrorClass) string {
	if c == "" {
		return ""
	}
	return c.Hint()
}

// classifySource classifies a source-side failure (probe unreachable). detail is
// the ffprobe/probe message. isIngest=false.
func classifySource(detail string) ErrorClass {
	d := strings.ToLower(detail)
	switch {
	case containsAny(d, "401", "unauthorized", "403", "forbidden", "authentication", "auth failed"):
		return ErrClassAuth
	case containsAny(d, "404", "not found", "no such", "invalid data", "no route to stream"):
		return ErrClassBadRTSP
	case containsAny(d, "no route to host", "connection refused", "timed out", "timeout", "network is unreachable", "name resolution", "no such host", "unreachable"):
		return ErrClassSourceUnreachable
	default:
		return ErrClassUnknown
	}
}

// classifyFFmpegStderr classifies ffmpeg's failure from its (last) stderr output
// plus the process error. It distinguishes source-side vs ingest-side problems
// where possible.
func classifyFFmpegStderr(stderr, procErr string) ErrorClass {
	s := strings.ToLower(stderr + " " + procErr)
	switch {
	case containsAny(s, "no such file or directory", "executable file not found", "cannot run"):
		// Only when the message is about the ffmpeg binary itself.
		if containsAny(s, "ffmpeg", "ffprobe", "executable file not found") {
			return ErrClassFFmpegMissing
		}
	}
	// Ingest side (the HTTP PUT to the cloud).
	switch {
	case containsAny(s, "http error 401", "http error 403", "401 unauthorized", "403 forbidden"):
		// Ambiguous: could be camera or ingest. If the URL context mentions the
		// ingest path, treat as ingest-auth; else camera auth.
		if containsAny(s, "ingest", "index.m3u8", "https://", "http://") && !strings.Contains(s, "rtsp://") {
			return ErrClassIngestAuth
		}
		return ErrClassAuth
	case containsAny(s, "http error 404", "http error 400"):
		return ErrClassIngestUnreachable
	case containsAny(s, "error opening output", "failed to open", "connection refused", "could not connect", "network is unreachable") && containsAny(s, "http", "https"):
		return ErrClassIngestUnreachable
	}
	// Source side.
	switch {
	case containsAny(s, "401 unauthorized", "403 forbidden", "authorization failed"):
		return ErrClassAuth
	case containsAny(s, "404 not found", "stream not found", "invalid data found"):
		return ErrClassBadRTSP
	case containsAny(s, "connection refused", "no route to host", "timed out", "timeout", "immediate exit requested", "name resolution", "no such host"):
		return ErrClassSourceUnreachable
	case containsAny(s, "codec not currently supported", "could not find codec", "unsupported codec", "non-monotonous", "could not write header"):
		return ErrClassCodec
	}
	return ErrClassUnknown
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
