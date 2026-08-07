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
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	_ "net/http/pprof" // registers /debug/pprof handlers (only served when EDGE_DEBUG_ADDR is set)
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/sparking/edge-agent/internal/audit"
	"github.com/sparking/edge-agent/internal/config"
	"github.com/sparking/edge-agent/internal/control"
	"github.com/sparking/edge-agent/internal/diagbundle"
	"github.com/sparking/edge-agent/internal/ffmpeg"
	"github.com/sparking/edge-agent/internal/publisher"
	"github.com/sparking/edge-agent/internal/rotatelog"
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
	// file (rotated by size), which the GUI tails to show live status.
	var logOut io.Writer = os.Stdout
	if *serviceMode {
		if p, perr := config.LogPath(); perr == nil {
			if rw, ferr := rotatelog.New(p, cfg.Log.MaxSizeMB, cfg.Log.MaxBackups); ferr == nil {
				logOut = rw
				defer rw.Close()
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

	// Audit log: structured, append-only, size-rotated. Separate from the
	// operational log. Best-effort (no-op if the path fails).
	auditFile, _ := config.AuditPath()
	var aud *audit.Logger
	var auditCloser io.Closer
	if arw, aerr := rotatelog.New(auditFile, cfg.Log.MaxSizeMB, cfg.Log.MaxBackups); aerr == nil {
		aud, auditCloser = audit.OpenRotating(arw)
	} else {
		aud, auditCloser = audit.Open(auditFile)
	}
	defer auditCloser.Close()

	// One supervisor runs every enabled camera concurrently (a goroutine each).
	// Runtime state is reconstructed from config (Enabled) — config is the only
	// persisted state; transient runtime state is never persisted.
	sup := publisher.NewSupervisor(cfg, log, aud)

	// Local control API (127.0.0.1 + per-run token) so the GUI — a SEPARATE
	// process — can drive per-camera start/stop and read live state/events, and
	// so operators can hit /health, /version, /diagnostics.
	// Best-effort: streaming does not depend on it.
	host, _ := os.Hostname()
	meta := &control.Meta{
		AgentVersion:  version,
		SchemaVersion: config.CurrentSchemaVersion,
		FFmpegPath:    av.FFmpegPath,
		FFmpegVersion: av.Version,
		OS:            runtime.GOOS,
		Arch:          runtime.GOARCH,
		Hostname:      host,
		StartedAt:     time.Now(),
	}
	stopControl := startControlAPI(sup, log, meta, cfg)
	defer stopControl()

	sup.Run(ctx) // blocks until ctx cancelled
	log.Info("edge-agent stopped")
}

// startControlAPI binds the local control server, publishes its endpoint file
// (0600) for the GUI, and serves in the background. Returns a cleanup func that
// stops the server and removes the endpoint file. Best-effort — failure to start
// it never affects streaming (returns a no-op cleanup).
func startControlAPI(sup *publisher.Supervisor, log *slog.Logger, meta *control.Meta, cfg *config.Config) func() {
	noop := func() {}
	epPath, err := config.ControlEndpointPath()
	if err != nil {
		log.Warn("control API: no endpoint path", "err", err)
		return noop
	}
	token := control.NewToken()
	srv, err := control.NewServerWithMeta(sup, token, 0, meta) // OS-assigned port on 127.0.0.1
	if err != nil {
		log.Warn("control API: bind failed", "err", err)
		return noop
	}
	srv.SetBundleFunc(bundleBuilder(sup, meta, cfg))
	if err := control.WriteEndpoint(epPath, control.Endpoint{Addr: srv.Addr(), Token: token}); err != nil {
		log.Warn("control API: could not publish endpoint", "err", err)
	}
	log.Info("control API listening", "addr", srv.Addr())
	go func() { _ = srv.Serve() }()
	return func() {
		_ = srv.Close()
		control.RemoveEndpoint(epPath)
	}
}

// bundleBuilder returns a closure that writes a support diagnostics zip. It
// redacts the config (secrets stripped) and never includes tokens/stream keys.
func bundleBuilder(sup *publisher.Supervisor, meta *control.Meta, cfg *config.Config) func(io.Writer) error {
	return func(w io.Writer) error {
		logPath, _ := config.LogPath()
		auditPath, _ := config.AuditPath()

		redacted, _ := cfg.RedactedYAML()

		// Diagnostics snapshot: current camera states (state carries no secrets).
		diagJSON, _ := json.Marshal(map[string]any{
			"generatedAt": time.Now().UTC().Format(time.RFC3339),
			"cameras":     sup.States(),
		})

		sysInfo := fmt.Sprintf(
			"agent: %s\nschemaVersion: %d\nos: %s\narch: %s\nhostname: %s\nffmpeg: %s (%s)\nuptimeSeconds: %d\ngoVersion: %s\nnumGoroutine: %d\n",
			meta.AgentVersion, meta.SchemaVersion, meta.OS, meta.Arch, meta.Hostname,
			meta.FFmpegVersion, meta.FFmpegPath,
			int64(time.Since(meta.StartedAt).Seconds()),
			runtime.Version(), runtime.NumGoroutine(),
		)

		return diagbundle.Build(w, diagbundle.Inputs{
			Manifest: diagbundle.Manifest{
				AgentVersion:  meta.AgentVersion,
				SchemaVersion: meta.SchemaVersion,
				GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
				OS:            meta.OS,
				Arch:          meta.Arch,
				Hostname:      meta.Hostname,
			},
			RedactedConfigYAML: redacted,
			DiagnosticsJSON:    diagJSON,
			SystemInfo:         []byte(sysInfo),
			AgentLogPath:       logPath,
			AuditLogPath:       auditPath,
		})
	}
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
