// Package publisher is the per-camera supervisor loop: probe the source, launch
// ffmpeg to publish it to the cloud, watch ffmpeg, and reconnect with backoff if
// it exits. One Publisher runs one camera; the Supervisor runs many concurrently.
package publisher

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"os/exec"
	"sync"
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
	stallWindow  time.Duration // watchdog: restart if ffmpeg produces no output within this
	jitter       float64       // reconnect backoff jitter fraction (0.0–1.0)

	// gateOnce releases a startup-admission slot (set by the supervisor) exactly
	// once, after the first probe attempt returns. nil when startup gating is off.
	gateOnce sync.Once
	gateFn   func()
}

// New builds a Publisher for one camera. rtsp/publish are the effective values
// (already resolved from template/streamKey by the caller).
func New(cfg *config.Config, cam config.CameraConfig, rtsp, publish string, log *slog.Logger) *Publisher {
	backoffMax := cfg.BackoffMax()
	if backoffMax <= 0 {
		backoffMax = 30 * time.Second
	}
	return &Publisher{
		cfg:          cfg,
		cam:          cam,
		log:          log.With("cameraId", cam.CameraID, "camera", cam.Name),
		State:        NewCameraState(cam.CameraID, cam.Name),
		rtsp:         rtsp,
		publish:      publish,
		token:        cfg.EffectiveToken(&cam),
		transcode:    cfg.EffectiveTranscode(&cam),
		probeTimeout: 10 * time.Second,
		backoffMin:   1 * time.Second,
		backoffMax:   backoffMax,
		stableAfter:  30 * time.Second,
		stallWindow:  cfg.StallWindow(),
		jitter:       cfg.BackoffJitter(),
	}
}

// releaseGateAfterFirstProbe registers a startup-slot release fn that the
// publisher invokes exactly once, right after its first probe attempt returns.
// Called by the supervisor when startup admission control is active.
func (p *Publisher) releaseGateAfterFirstProbe(fn func()) { p.gateFn = fn }

// releaseGate frees the startup-admission slot (idempotent, once).
func (p *Publisher) releaseGate() {
	if p.gateFn != nil {
		p.gateOnce.Do(p.gateFn)
	}
}

// withJitter returns d adjusted by +/- up to p.jitter (e.g. 0.2 = ±20%), so a
// fleet reconnecting together spreads its retries instead of stampeding.
func (p *Publisher) withJitter(d time.Duration) time.Duration {
	if p.jitter <= 0 || d <= 0 {
		return d
	}
	// delta in [-jitter, +jitter] * d
	delta := (rand.Float64()*2 - 1) * p.jitter
	out := time.Duration(float64(d) * (1 + delta))
	if out < 0 {
		out = 0
	}
	return out
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
		// First probe done → free the startup-admission slot so the next camera
		// in a large fleet can begin. Steady reconnects are spread by jitter, not
		// gated, so this only shapes the initial ramp-up.
		p.releaseGate()
		if !probe.Reachable {
			class := classifySource(probe.Detail)
			p.State.setErrorClass(class)
			p.log.Warn("source not reachable",
				"event", "network_error", "source", src, "detail", probe.Detail,
				"errorClass", string(class), "hint", class.Hint())
			p.State.setOffline(probe.Detail)
			if p.sleep(ctx, p.withJitter(backoff)) {
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
		err, stderrTail := p.runFFmpeg(ctx, mode)
		ran := time.Since(start)

		if ctx.Err() != nil {
			p.State.setStopped()
			return
		}

		// 4. ffmpeg exited — classify, log, and reconnect.
		if err != nil {
			procErr := err.Error()
			class := classifyFFmpegStderr(stderrTail, procErr)
			p.State.setErrorClass(class)
			p.log.Warn("ffmpeg exited",
				"event", "disconnected", "ran", ran.Round(time.Second).String(), "err", procErr,
				"errorClass", string(class), "hint", class.Hint())
		} else {
			p.log.Warn("ffmpeg exited cleanly (source ended?)",
				"event", "disconnected", "ran", ran.Round(time.Second).String())
		}

		if ran >= p.stableAfter {
			backoff = p.backoffMin
		}
		p.State.setReconnecting("ffmpeg exited; retrying")
		wait := p.withJitter(backoff)
		p.log.Info("reconnecting", "event", "reconnect", "in", wait.String())
		if p.sleep(ctx, wait) {
			p.State.setStopped()
			return
		}
		backoff = p.next(backoff)
	}
}

// runFFmpeg starts ffmpeg and blocks until it exits. It returns the process
// error (nil on clean exit) plus the TAIL of ffmpeg's stderr — the last few
// lines, used to classify the failure into an operator-facing category.
func (p *Publisher) runFFmpeg(ctx context.Context, mode ffmpeg.Mode) (error, string) {
	args := ffmpeg.Args(p.rtsp, p.publish, p.token, mode)
	cmd := exec.CommandContext(ctx, p.cfg.FFmpeg.Binary, args...)
	ffmpeg.HideWindow(cmd) // Windows: no console window per ffmpeg spawn

	stderr, _ := cmd.StderrPipe()
	if err := cmd.Start(); err != nil {
		// Start failure is almost always a missing/broken ffmpeg binary.
		return err, err.Error()
	}
	p.log.Info("ffmpeg started", "event", "publishing", "pid", cmd.Process.Pid)

	tail := newLineTail(stderrTailLines)
	done := make(chan struct{})
	go func() {
		defer close(done)
		sc := bufio.NewScanner(stderr)
		for sc.Scan() {
			// Any ffmpeg output means it's alive and PROGRESSING — refresh
			// lastSeen. This is the stall signal (process progress, NOT video
			// content), so a low-motion but healthy stream is never falsely
			// killed.
			p.State.touch()
			line := sc.Text()
			tail.add(line)
			p.log.Debug("ffmpeg", "line", line)
		}
	}()

	// Stall watchdog: while ffmpeg is running, if it is ONLINE but has produced
	// no output within stallWindow, it is wedged — kill it so the normal
	// reconnect/backoff loop takes over. Runs until this run exits.
	stop := p.startStallWatchdog(cmd)
	defer stop()

	err := cmd.Wait()
	<-done // ensure the stderr reader has drained before reading the tail
	return err, tail.String()
}

// startStallWatchdog monitors the running ffmpeg for a frozen stream and kills
// it if stalled. Returns a stop func (called when the run ends). Disabled when
// stallWindow <= 0.
func (p *Publisher) startStallWatchdog(cmd *exec.Cmd) func() {
	if p.stallWindow <= 0 {
		return func() {}
	}
	done := make(chan struct{})
	go func() {
		// Check a few times per window; a coarse ticker is enough.
		interval := p.stallWindow / 3
		if interval < time.Second {
			interval = time.Second
		}
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-done:
				return
			case <-t.C:
				online, since := p.State.isOnlineSince()
				if online && since >= p.stallWindow {
					p.log.Warn("stream stalled; restarting camera",
						"event", "stalled", "no_output_for", since.Round(time.Second).String())
					p.State.setStalled(fmt.Sprintf("no output for %s", since.Round(time.Second)))
					// Kill ffmpeg → cmd.Wait() returns → reconnect loop runs.
					if cmd.Process != nil {
						_ = cmd.Process.Kill()
					}
					return
				}
			}
		}
	}()
	return func() { close(done) }
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
