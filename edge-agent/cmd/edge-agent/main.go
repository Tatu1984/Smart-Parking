// Command edge-agent is the SParking CCTV Edge Agent.
//
// It runs on-site at a parking facility, reads config.yaml, probes an RTSP
// camera/NVR on the local network, and continuously publishes the stream to
// SParking's cloud ingest over outbound HTTPS (HLS-over-HTTP-PUT), reconnecting
// automatically. This is how cameras behind NAT/CGNAT reach the cloud without
// any inbound port, public IP, or router configuration.
//
// See docs/cctv/edge-agent.md.
package main

import (
	"context"
	"flag"
	"io"
	"log/slog"
	"net/http"
	_ "net/http/pprof" // registers /debug/pprof handlers (only served when EDGE_DEBUG_ADDR is set)
	"os"
	"os/signal"
	"syscall"

	"github.com/sparking/edge-agent/internal/config"
	"github.com/sparking/edge-agent/internal/ffmpeg"
	"github.com/sparking/edge-agent/internal/publisher"
)

// version is set at build time via -ldflags "-X main.version=...".
var version = "dev"

func main() {
	cfgPath := flag.String("config", "config.yaml", "path to config.yaml")
	showVersion := flag.Bool("version", false, "print version and exit")
	serviceMode := flag.Bool("service", false, "run as a background service (log to the app log file)")
	flag.Parse()

	if *showVersion {
		os.Stdout.WriteString("edge-agent " + version + "\n")
		return
	}

	// Optional diagnostics: when EDGE_DEBUG_ADDR is set (e.g. "127.0.0.1:6060"),
	// expose net/http/pprof for live goroutine/heap inspection. Off by default,
	// zero cost otherwise. Useful for field troubleshooting a busy multi-camera
	// agent.
	if addr := os.Getenv("EDGE_DEBUG_ADDR"); addr != "" {
		go func() { _ = http.ListenAndServe(addr, nil) }()
	}

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		os.Stderr.WriteString("config error: " + err.Error() + "\n")
		os.Exit(1)
	}

	// In service mode there is no terminal, so write logs to the shared app log
	// file, which the GUI tails to show live status.
	var logOut *os.File = os.Stdout
	if *serviceMode {
		if p, perr := config.LogPath(); perr == nil {
			if f, ferr := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600); ferr == nil {
				logOut = f
				defer f.Close()
			}
		}
	}

	log := newLoggerTo(logOut, cfg.Log.Level)
	log.Info("edge-agent starting",
		"version", version,
		"schemaVersion", cfg.SchemaVersion,
		"agentId", cfg.AgentID,
		"cameras", len(cfg.EnabledCameras()),
		"transcode", cfg.FFmpeg.Transcode,
	)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Resolve ffmpeg/ffprobe to absolute paths. A GUI-launched agent inherits a
	// minimal PATH that omits Homebrew (macOS) etc., so resolve the real
	// locations and pin them into the config for everything downstream.
	av := ffmpeg.Detect(cfg.FFmpeg.Binary, cfg.FFprobeBinary())
	cfg.FFmpeg.Binary = av.FFmpegPath
	cfg.FFmpeg.Probe = av.FFprobePath
	if !av.OK() {
		log.Error("cannot run ffmpeg/ffprobe",
			"ffmpeg", av.FFmpegPath, "ffprobe", av.FFprobePath,
			"hint", ffmpeg.InstallHint())
		os.Exit(1)
	}
	log.Info("ffmpeg ok", "version", av.Version, "path", av.FFmpegPath)

	// One supervisor runs every enabled camera concurrently (a goroutine each).
	publisher.NewSupervisor(cfg, log).Run(ctx) // blocks until ctx cancelled
	log.Info("edge-agent stopped")
}

func newLoggerTo(w io.Writer, level string) *slog.Logger {
	var lvl slog.Level
	switch level {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	return slog.New(slog.NewTextHandler(w, &slog.HandlerOptions{Level: lvl}))
}
