// Package publisher is the supervisor loop: probe the source, launch ffmpeg to
// publish it to the cloud, watch ffmpeg, and reconnect with backoff if it exits.
// This is the "continuously publish / auto-reconnect" requirement.
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

type Publisher struct {
	cfg *config.Config
	log *slog.Logger

	probeTimeout time.Duration
	backoffMin   time.Duration
	backoffMax   time.Duration
	stableAfter  time.Duration // a run lasting this long resets the backoff
}

func New(cfg *config.Config, log *slog.Logger) *Publisher {
	return &Publisher{
		cfg:          cfg,
		log:          log,
		probeTimeout: 10 * time.Second,
		backoffMin:   1 * time.Second,
		backoffMax:   30 * time.Second,
		stableAfter:  30 * time.Second,
	}
}

// Run supervises the publish forever until ctx is cancelled.
func (p *Publisher) Run(ctx context.Context) {
	backoff := p.backoffMin
	src := config.Redacted(p.cfg.Camera.RTSP)
	dst := config.Redacted(p.cfg.Cloud.Publish)

	for {
		if ctx.Err() != nil {
			return
		}

		// 1. Probe the source.
		probe := Probe(ctx, "ffprobe", p.cfg.Camera.RTSP, p.probeTimeout)
		if !probe.Reachable {
			p.log.Warn("source not reachable",
				"event", "network_error", "source", src, "detail", probe.Detail)
			if p.sleep(ctx, backoff) {
				return
			}
			backoff = p.next(backoff)
			continue
		}
		p.log.Info("source reachable",
			"event", "connected", "source", src,
			"codec", probe.VideoCodec, "resolution", res(probe))

		// 2. Decide copy vs transcode.
		mode, why := ffmpeg.ResolveMode(p.cfg.FFmpeg.Transcode, probe.IsH265())
		p.log.Info("publish plan", "mode", string(mode), "reason", why, "target", dst)

		// 3. Run ffmpeg (blocks until it exits).
		start := time.Now()
		err := p.runFFmpeg(ctx, mode)
		ran := time.Since(start)

		if ctx.Err() != nil {
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

		// A long, stable run means the network was fine — reset backoff.
		if ran >= p.stableAfter {
			backoff = p.backoffMin
		}
		p.log.Info("reconnecting", "event", "reconnect", "in", backoff.String())
		if p.sleep(ctx, backoff) {
			return
		}
		backoff = p.next(backoff)
	}
}

func (p *Publisher) runFFmpeg(ctx context.Context, mode ffmpeg.Mode) error {
	args := ffmpeg.Args(p.cfg.Camera.RTSP, p.cfg.Cloud.Publish, p.cfg.Cloud.Token, mode)
	cmd := exec.CommandContext(ctx, p.cfg.FFmpeg.Binary, args...)

	stderr, _ := cmd.StderrPipe()
	if err := cmd.Start(); err != nil {
		return err
	}
	p.log.Info("ffmpeg started", "event", "publishing", "pid", cmd.Process.Pid)

	go func() {
		sc := bufio.NewScanner(stderr)
		for sc.Scan() {
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
