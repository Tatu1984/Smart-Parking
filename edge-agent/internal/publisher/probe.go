package publisher

import (
	"context"
	"encoding/json"
	"os/exec"
	"strings"
	"time"
)

// ProbeResult is the outcome of an ffprobe reachability + codec check.
type ProbeResult struct {
	Reachable  bool
	VideoCodec string
	Width      int
	Height     int
	Detail     string
}

// IsH265 reports whether the source video is HEVC/H.265 (needs transcode).
func (p ProbeResult) IsH265() bool {
	c := strings.ToLower(p.VideoCodec)
	return c == "hevc" || c == "h265"
}

// Probe runs ffprobe against the RTSP source to confirm reachability and read
// the video codec/resolution. A failure here means the camera is unreachable or
// the credentials are wrong — the caller backs off and retries.
func Probe(ctx context.Context, ffprobeBin, rtsp string, timeout time.Duration) ProbeResult {
	if ffprobeBin == "" {
		ffprobeBin = "ffprobe"
	}
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(cctx, ffprobeBin,
		"-rtsp_transport", "tcp",
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=codec_name,width,height",
		"-of", "json",
		rtsp,
	)
	out, err := cmd.Output()
	if err != nil {
		detail := err.Error()
		if ee, ok := err.(*exec.ExitError); ok && len(ee.Stderr) > 0 {
			detail = strings.TrimSpace(string(ee.Stderr))
		}
		return ProbeResult{Reachable: false, Detail: truncate(detail, 200)}
	}

	var parsed struct {
		Streams []struct {
			CodecName string `json:"codec_name"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(out, &parsed); err != nil || len(parsed.Streams) == 0 {
		// Reachable (ffprobe exited 0) but we couldn't read stream info.
		return ProbeResult{Reachable: true, Detail: "no video stream info"}
	}
	s := parsed.Streams[0]
	return ProbeResult{
		Reachable:  true,
		VideoCodec: s.CodecName,
		Width:      s.Width,
		Height:     s.Height,
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
