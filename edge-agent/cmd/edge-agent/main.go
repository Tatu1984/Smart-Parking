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
