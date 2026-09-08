package publisher

import (
	"context"
	"testing"
	"time"

	"github.com/sparking/edge-agent/internal/config"
)

// TestBackoffJitterSpreadsRetries proves withJitter actually varies the delay so
// a fleet does not retry in lockstep. With 20% jitter over many samples we must
// see a spread of values (not all identical) inside the ±20% band.
func TestBackoffJitterSpreadsRetries(t *testing.T) {
	p := &Publisher{jitter: 0.20}
	base := 10 * time.Second
	min, max := base, base
	distinct := map[time.Duration]bool{}
	for i := 0; i < 200; i++ {
		d := p.withJitter(base)
		if d < min {
			min = d
		}
		if d > max {
			max = d
		}
		distinct[d] = true
		// Must stay within the ±20% band.
		if d < time.Duration(float64(base)*0.80)-time.Millisecond ||
			d > time.Duration(float64(base)*1.20)+time.Millisecond {
			t.Fatalf("jittered delay %v out of ±20%% band around %v", d, base)
		}
	}
	if len(distinct) < 50 {
		t.Errorf("jitter not spreading: only %d distinct values in 200 samples", len(distinct))
	}
	if max-min < base/10 {
		t.Errorf("jitter spread too narrow: min=%v max=%v", min, max)
	}
}

// TestJitterDisabledIsExact confirms jitter=0 returns the delay unchanged (so
// operators who want deterministic backoff get it).
func TestJitterDisabledIsExact(t *testing.T) {
	p := &Publisher{jitter: 0}
	for i := 0; i < 20; i++ {
		if got := p.withJitter(7 * time.Second); got != 7*time.Second {
			t.Fatalf("jitter=0 changed delay to %v", got)
		}
	}
}

// TestStartGateBoundsConcurrentFirstProbes verifies the startup admission gate
// caps how many cameras may be launching at once. We hold the gate FULL from the
// test (by pre-filling it) so no camera can acquire a slot; every camera must
// stay IDLE until we free the gate. This is deterministic — it does not depend on
// probe timing.
func TestStartGateBoundsConcurrentFirstProbes(t *testing.T) {
	c := &config.Config{SchemaVersion: config.CurrentSchemaVersion}
	c.FFmpeg.Binary = "ffmpeg"
	c.FFmpeg.Transcode = "copy"
	c.BackoffMaxSeconds = 2
	c.MaxConcurrentStarts = 2
	for i := 0; i < 6; i++ {
		c.Cameras = append(c.Cameras, config.CameraConfig{
			CameraID: itoaTest(i), Name: itoaTest(i),
			RTSP: "rtsp://127.0.0.1:1/x", Publish: "https://x/y/index.m3u8",
			Token: "t", Enabled: true,
		})
	}
	s := NewSupervisor(c, quietLogger(), nil)
	if s.startGate == nil || cap(s.startGate) != 2 {
		t.Fatalf("expected startGate cap 2, got %v", s.startGate)
	}
	// Saturate the gate so NO camera can acquire a start slot.
	s.startGate <- struct{}{}
	s.startGate <- struct{}{}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()

	// With the gate full, all six goroutines are parked waiting for a slot — none
	// has probed, so all stay IDLE. Give it a moment and confirm.
	time.Sleep(200 * time.Millisecond)
	for _, st := range s.States() {
		if st.Status != StatusIdle {
			t.Fatalf("camera %s left IDLE (%s) while start gate was saturated", st.CameraID, st.Status)
		}
	}

	// Free both slots; now cameras may proceed and leave IDLE.
	<-s.startGate
	<-s.startGate
	waitFor(t, 10*time.Second, func() bool {
		for _, st := range s.States() {
			if st.Status != StatusIdle {
				return true // at least one proceeded once a slot opened
			}
		}
		return false
	})

	cancel()
	select {
	case <-done:
	case <-time.After(15 * time.Second):
		t.Fatal("supervisor did not stop")
	}
}

// TestStartGateEventuallyStartsAll confirms gating only SHAPES the ramp — every
// enabled camera still starts once slots cycle.
func TestStartGateEventuallyStartsAll(t *testing.T) {
	c := &config.Config{SchemaVersion: config.CurrentSchemaVersion}
	c.FFmpeg.Binary = "ffmpeg"
	c.FFmpeg.Transcode = "copy"
	c.BackoffMaxSeconds = 1
	c.MaxConcurrentStarts = 3
	for i := 0; i < 8; i++ {
		c.Cameras = append(c.Cameras, config.CameraConfig{
			CameraID: itoaTest(i), Name: itoaTest(i),
			RTSP: "rtsp://127.0.0.1:1/x", Publish: "https://x/y/index.m3u8",
			Token: "t", Enabled: true,
		})
	}
	s := NewSupervisor(c, quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()

	waitFor(t, 20*time.Second, func() bool {
		for _, st := range s.States() {
			if st.Status == StatusIdle {
				return false // still waiting for a start slot
			}
		}
		return true
	})
	cancel()
	waitClosed(t, done, 15*time.Second)
}

func itoaTest(n int) string {
	if n == 0 {
		return "cam-0"
	}
	return "cam-" + string(rune('0'+n))
}

// TestStartAllScalesLinearly guards against the O(N²) regression in StartAll /
// isEnabled (which used to scan cfg.Cameras for every camera). We build a large
// fleet with the start gate FULL (so no goroutine actually launches — we are
// timing the enabled-lookup + map bookkeeping, not ffprobe) and confirm that
// quadrupling N does not quadratically inflate StartAll's wall time.
//
// Skipped under -short. It's a coarse ratio check, not a micro-benchmark.
func TestStartAllScalesLinearly(t *testing.T) {
	if testing.Short() {
		t.Skip("scale test skipped under -short")
	}
	build := func(n int) *Supervisor {
		c := &config.Config{SchemaVersion: config.CurrentSchemaVersion}
		c.FFmpeg.Binary = "ffmpeg"
		c.FFmpeg.Transcode = "copy"
		c.MaxConcurrentStarts = 1 // gate we will saturate so nothing launches
		c.Cameras = make([]config.CameraConfig, n)
		for i := 0; i < n; i++ {
			id := "cam-" + itoa(i)
			c.Cameras[i] = config.CameraConfig{
				CameraID: id, Name: id,
				RTSP: "rtsp://127.0.0.1:1/x", Publish: "https://x/y/index.m3u8",
				Token: "t", Enabled: true,
			}
		}
		s := NewSupervisor(c, quietLogger(), nil)
		// Set a root so startLocked proceeds to the launch path, and saturate the
		// gate so the launched goroutines immediately park (no probing).
		s.root = context.Background()
		s.startGate <- struct{}{}
		return s
	}

	timeStartAll := func(n int) time.Duration {
		s := build(n)
		start := time.Now()
		s.StartAll()
		d := time.Since(start)
		// Tear down: free the gate and cancel everything that parked.
		go func() { <-s.startGate }()
		s.StopAll()
		return d
	}

	small := timeStartAll(2000)
	large := timeStartAll(8000) // 4× the cameras

	t.Logf("StartAll: 2000=%v  8000=%v  ratio=%.1fx (4x cameras)", small, large,
		float64(large)/float64(small+1))

	// O(N²) would make 4× cameras ~16× slower. O(N) should be ~4×. Allow generous
	// slack for scheduler noise; fail only if it looks quadratic (>10×).
	if small > 0 && large > 10*small {
		t.Errorf("StartAll looks super-linear: 2000=%v 8000=%v (%.1fx) — possible O(N²) regression",
			small, large, float64(large)/float64(small))
	}
}
