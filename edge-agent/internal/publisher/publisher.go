// Package publisher is the per-camera supervisor loop: probe the source, launch
// ffmpeg to publish it to the cloud, watch ffmpeg, and reconnect with backoff if
// it exits. One Publisher runs one camera; the Supervisor runs many concurrently.
package publisher

import (
	"bufio"
	"context"
	"log/slog"
	"os/exec"
	"time"

	"github.com/sparking/edge-agent/internal/config"
	"github.com/sparking/edge-agent/internal/ffmpeg"
)

// Publisher continuously publishes ONE camera and maintains its runtime state.
type Publisher struct {
	cfg   *config.Config       // global settings (ffmpeg binary/probe, defaults)
	cam   config.CameraConfig  // this camera's config
	log   *slog.Logger         // logger, pre-tagged with cameraId/name
	State *CameraState         // per-camera live state + metrics (exposed to readers)

	// resolved once at construction
	rtsp      string
	publish   string
	token     string
	transcode string

	probeTimeout time.Duration
	backoffMin   time.Duration
	backoffMax   time.Duration
	stableAfter  time.Duration
}

// New builds a Publisher for one camera. rtsp/publish are the effective values
// (already resolved from template/streamKey by the caller).
func New(cfg *config.Config, cam config.CameraConfig, rtsp, publish string, log *slog.Logger) *Publisher {
	return &Publisher{
		cfg:          cfg,
		cam:          cam,
		log:          log.With("cameraId", cam.CameraID, "camera", cam.Name),
		State:        NewCameraState(cam.CameraID, cam.Name),
		rtsp:         rtsp,
		publish:      publish,
		token:        cam.Token,
		transcode:    cfg.EffectiveTranscode(&cam),
		probeTimeout: 10 * time.Second,
		backoffMin:   1 * time.Second,
		backoffMax:   30 * time.Second,
		stableAfter:  30 * time.Second,
	}
}

// Run supervises this camera's publish until ctx is cancelled.
func (p *Publisher) Run(ctx context.Context) {
	backoff := p.backoffMin
	src := config.Redacted(p.rtsp)
	dst := config.Redacted(p.publish)

	for {
		if ctx.Err() != nil {
			p.State.setStopped()
			return
		}

		// 1. Probe the source.
		p.State.setConnecting("probing source")
		probe := Probe(ctx, p.cfg.FFprobeBinary(), p.rtsp, p.probeTimeout)
		if !probe.Reachable {
			p.log.Warn("source not reachable",
				"event", "network_error", "source", src, "detail", probe.Detail)
			p.State.setOffline(probe.Detail)
			if p.sleep(ctx, backoff) {
				p.State.setStopped()
				return
			}
			backoff = p.next(backoff)
			continue
		}
		p.log.Info("source reachable",
			"event", "connected", "source", src,
			"codec", probe.VideoCodec, "resolution", res(probe))

		// 2. Decide copy vs transcode.
		mode, why := ffmpeg.ResolveMode(p.transcode, probe.IsH265())
		p.log.Info("publish plan", "mode", string(mode), "reason", why, "target", dst)

		// 3. Run ffmpeg (blocks until it exits).
		p.State.setOnline(probe.VideoCodec, res(probe))
		start := time.Now()
		err := p.runFFmpeg(ctx, mode)
		ran := time.Since(start)

		if ctx.Err() != nil {
			p.State.setStopped()
			return
		}

		// 4. ffmpeg exited — log and reconnect.
		if err != nil {
			p.log.Warn("ffmpeg exited",
				"event", "disconnected", "ran", ran.Round(time.Second).String(), "err", err.Error())
		} else {
			p.log.Warn("ffmpeg exited cleanly (source ended?)",
				"event", "disconnected", "ran", ran.Round(time.Second).String())
		}

		if ran >= p.stableAfter {
			backoff = p.backoffMin
		}
		p.State.setReconnecting("ffmpeg exited; retrying")
		p.log.Info("reconnecting", "event", "reconnect", "in", backoff.String())
		if p.sleep(ctx, backoff) {
			p.State.setStopped()
			return
		}
		backoff = p.next(backoff)
	}
}

func (p *Publisher) runFFmpeg(ctx context.Context, mode ffmpeg.Mode) error {
	args := ffmpeg.Args(p.rtsp, p.publish, p.token, mode)
	cmd := exec.CommandContext(ctx, p.cfg.FFmpeg.Binary, args...)

	stderr, _ := cmd.StderrPipe()
	if err := cmd.Start(); err != nil {
		return err
	}
	p.log.Info("ffmpeg started", "event", "publishing", "pid", cmd.Process.Pid)

	go func() {
		sc := bufio.NewScanner(stderr)
		for sc.Scan() {
			// Any ffmpeg output means it's alive and working — refresh lastSeen.
			p.State.touch()
			p.log.Debug("ffmpeg", "line", sc.Text())
		}
	}()

	return cmd.Wait()
}

func (p *Publisher) sleep(ctx context.Context, d time.Duration) (cancelled bool) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return true
	case <-t.C:
		return false
	}
}

func (p *Publisher) next(cur time.Duration) time.Duration {
	n := cur * 2
	if n > p.backoffMax {
		return p.backoffMax
	}
	return n
}

func res(p ProbeResult) string {
	if p.Width == 0 {
		return "unknown"
	}
	return itoa(p.Width) + "x" + itoa(p.Height)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
