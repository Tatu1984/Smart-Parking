package publisher

import (
	"context"
	"log/slog"
	"sync"

	"github.com/sparking/edge-agent/internal/config"
)

// Supervisor runs one Publisher per enabled camera, concurrently and
// independently: each camera has its own goroutine, ffmpeg process, backoff, and
// runtime state. One camera failing or reconnecting never affects the others.
type Supervisor struct {
	cfg        *config.Config
	log        *slog.Logger
	publishers []*Publisher
}

// NewSupervisor builds a Publisher for each ENABLED camera, resolving each
// camera's effective RTSP and publish URL up front. Cameras that fail to resolve
// are recorded in FAILED state and skipped (they never block healthy ones).
func NewSupervisor(cfg *config.Config, log *slog.Logger) *Supervisor {
	s := &Supervisor{cfg: cfg, log: log}
	for _, cam := range cfg.EnabledCameras() {
		rtsp, rerr := cfg.EffectiveRTSP(&cam)
		pub, perr := cfg.EffectivePublish(&cam)
		p := New(cfg, cam, rtsp, pub, log)
		if rerr != nil {
			p.State.setFailed("rtsp: " + rerr.Error())
			log.Error("camera config invalid; skipping", "cameraId", cam.CameraID, "err", rerr)
		} else if perr != nil {
			p.State.setFailed("publish: " + perr.Error())
			log.Error("camera config invalid; skipping", "cameraId", cam.CameraID, "err", perr)
		}
		s.publishers = append(s.publishers, p)
	}
	return s
}

// Run starts every valid camera's publisher and blocks until ctx is cancelled
// and all goroutines have exited.
func (s *Supervisor) Run(ctx context.Context) {
	s.log.Info("supervisor starting", "cameras", len(s.publishers))
	var wg sync.WaitGroup
	for _, p := range s.publishers {
		// A FAILED-at-construction camera has nothing to run; leave its state.
		if p.State.Snapshot().Status == StatusFailed {
			continue
		}
		wg.Add(1)
		go func(pub *Publisher) {
			defer wg.Done()
			pub.Run(ctx) // its own probe/ffmpeg/backoff loop
		}(p)
	}
	wg.Wait()
	s.log.Info("supervisor stopped")
}

// States returns a snapshot of every camera's runtime state (for the GUI / a
// future status endpoint). Safe to call concurrently while Run is active.
func (s *Supervisor) States() []StateSnapshot {
	out := make([]StateSnapshot, 0, len(s.publishers))
	for _, p := range s.publishers {
		out = append(out, p.State.Snapshot())
	}
	return out
}
