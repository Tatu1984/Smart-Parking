// Package ffmpeg builds the FFmpeg command that pulls the source RTSP and
// publishes it to the cloud as HLS over HTTP PUT.
//
// TRANSPORT: HLS-over-HTTP-PUT. ffmpeg writes HLS segments and uploads each via
// HTTP PUT to the SParking ingest endpoint. Plain outbound HTTP → rides any
// HTTP(S) tunnel or reverse proxy, NAT/CGNAT-friendly, no WebRTC/UDP/TURN/
// public IP. Works on any modern ffmpeg (the hls muxer + http PUT are
// long-standing).
package ffmpeg

// ffmpeg version detection lives in detect.go (ffmpeg.Detect), which also
// resolves off-PATH install locations. There is intentionally no bare-name
// exec here.

// Mode is the resolved encoding mode for the publish.
type Mode string

const (
	ModeCopy      Mode = "copy" // -c:v copy: no re-encode (source is H.264)
	ModeTranscode Mode = "h264" // re-encode video to H.264 (source is H.265)
)

// ResolveMode decides copy vs transcode from the config setting and probed codec.
func ResolveMode(setting string, sourceIsH265 bool) (Mode, string) {
	switch setting {
	case "copy":
		return ModeCopy, "forced copy (config: copy)"
	case "h264":
		return ModeTranscode, "forced transcode to H.264 (config: h264)"
	default: // auto
		if sourceIsH265 {
			return ModeTranscode, "source is H.265 → transcoding to H.264 for browser"
		}
		return ModeCopy, "source is H.264 → copy (no re-encode)"
	}
}

// Args builds the ffmpeg argument list for an HLS-over-HTTP-PUT publish.
//
//	sourceRTSP : rtsp://user:pass@camera/path            (the camera on the LAN)
//	publishURL : http(s)://app/api/edge/ingest/<key>/index.m3u8  (cloud ingest)
//	token      : per-camera Bearer token for the ingest auth
//	mode       : ModeCopy (H.264 source) or ModeTranscode (H.265 → H.264)
//
// Video is copied (H.264) or transcoded (H.265→H.264). Audio is AAC (HLS-native;
// plays on all browsers incl. Safari/iOS). ffmpeg PUTs the playlist + segments.
func Args(sourceRTSP, publishURL, token string, mode Mode) []string {
	args := []string{
		"-hide_banner",
		"-loglevel", "warning",
		"-rtsp_transport", "tcp", // pull the source over TCP (firewall-resilient)
		"-i", sourceRTSP,
	}

	// Video.
	if mode == ModeTranscode {
		args = append(args,
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-tune", "zerolatency",
			"-pix_fmt", "yuv420p",
			"-profile:v", "baseline",
		)
	} else {
		args = append(args, "-c:v", "copy")
	}

	// Audio (AAC — HLS-native, universal browser support).
	args = append(args, "-c:a", "aac", "-b:a", "128k")

	// Publish as HLS via HTTP PUT.
	//
	// Window sizing is the difference between a smooth live feed and a 404 storm.
	// A browser playing over the internet sits several seconds BEHIND the live
	// edge (network RTT to the origin + R2 write→read propagation + hls.js's own
	// live-sync buffer, ~6s by default). If the sliding window is shorter than
	// that lag, ffmpeg deletes a segment before the browser fetches it → 404,
	// stall, and a jump back to whatever is still on the playlist (the "loop").
	//
	//   -hls_list_size 10        20s of segments listed in the playlist
	//   -hls_delete_threshold 6  keep 6 MORE segments on the origin after they
	//                            leave the playlist before deleting → a segment
	//                            survives ~32s from creation, well past any
	//                            realistic player lag, so a slightly-behind
	//                            browser always finds what the playlist named.
	//   append_list              on an ffmpeg restart, CONTINUE the existing
	//                            playlist and segment numbering instead of
	//                            resetting to index0/MEDIA-SEQUENCE:0 — which is
	//                            what made a transient restart replay old footage.
	//   program_date_time        wall-clock tags so the player can pin the true
	//                            live edge rather than drifting backwards.
	args = append(args,
		"-f", "hls",
		"-method", "PUT",
		"-http_persistent", "1", // reuse the HTTP connection
		"-ignore_io_errors", "1", // survive transient upload blips
		"-hls_time", "2", // 2s segments
		"-hls_list_size", "10", // 20s sliding window (was 6 = 12s, too small)
		"-hls_delete_threshold", "6", // keep 6 segments past the window before deleting
		"-hls_flags", "delete_segments+append_list+omit_endlist+program_date_time",
	)
	if token != "" {
		args = append(args, "-headers", "Authorization: Bearer "+token+"\r\n")
	}
	args = append(args, publishURL)
	return args
}
