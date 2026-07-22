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
	"log/slog"
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
	flag.Parse()

	if *showVersion {
		os.Stdout.WriteString("edge-agent " + version + "\n")
		return
	}

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		os.Stderr.WriteString("config error: " + err.Error() + "\n")
		os.Exit(1)
	}

	log := newLogger(cfg.Log.Level)
	log.Info("edge-agent starting",
		"version", version,
		"cameraId", cfg.CameraID,
		"camera", cfg.Camera.Name,
		"source", config.Redacted(cfg.Camera.RTSP),
		"publish", config.Redacted(cfg.Cloud.Publish),
		"transcode", cfg.FFmpeg.Transcode,
	)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Preflight: confirm ffmpeg is runnable.
	if ver, err := ffmpeg.Version(ctx, cfg.FFmpeg.Binary); err != nil {
		log.Error("cannot run ffmpeg", "binary", cfg.FFmpeg.Binary, "err", err,
			"hint", "install ffmpeg (Debian/Ubuntu: apt install ffmpeg)")
		os.Exit(1)
	} else {
		log.Info("ffmpeg ok", "version", ver)
	}

	publisher.New(cfg, log).Run(ctx) // blocks until ctx cancelled
	log.Info("edge-agent stopped")
}

func newLogger(level string) *slog.Logger {
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
	return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: lvl}))
}
