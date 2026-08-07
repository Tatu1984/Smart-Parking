package publisher

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/sparking/edge-agent/internal/config"
)

func quietLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func multiCamConfig() *config.Config {
	c := &config.Config{SchemaVersion: config.CurrentSchemaVersion}
	c.FFmpeg.Binary = "ffmpeg"
	c.FFmpeg.Transcode = "copy"
	c.Cameras = []config.CameraConfig{
		{CameraID: "cam-a", Name: "A", RTSP: "rtsp://127.0.0.1:1/a", Publish: "https://x/a/index.m3u8", Token: "ta", Enabled: true},
		{CameraID: "cam-b", Name: "B", RTSP: "rtsp://127.0.0.1:1/b", Publish: "https://x/b/index.m3u8", Token: "tb", Enabled: true},
		{CameraID: "cam-c", Name: "C (off)", RTSP: "rtsp://127.0.0.1:1/c", Publish: "https://x/c/index.m3u8", Token: "tc", Enabled: false},
	}
	return c
}

func TestSupervisorBuildsAllCamerasIdle(t *testing.T) {
	s := NewSupervisor(multiCamConfig(), quietLogger(), nil)
	states := s.States()
	// All 3 cameras are present (enabled + disabled); none running yet.
	if len(states) != 3 {
		t.Fatalf("expected 3 managed cameras, got %d", len(states))
	}
	for _, st := range states {
		if st.Status != StatusIdle {
			t.Errorf("camera %s should start IDLE, got %s", st.CameraID, st.Status)
		}
		if s.IsRunning(st.CameraID) {
			t.Errorf("camera %s should not be running before Run", st.CameraID)
		}
	}
}

func TestSupervisorReconstructsRuntimeFromEnabled(t *testing.T) {
	// On Run, only ENABLED cameras start; disabled stays stopped.
	s := NewSupervisor(multiCamConfig(), quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()

	// Give the supervisor a moment to start the enabled cameras.
	waitFor(t, 3*time.Second, func() bool {
		return s.IsRunning("cam-a") && s.IsRunning("cam-b")
	})
	if s.IsRunning("cam-c") {
		t.Error("disabled cam-c must not be started on Run")
	}

	cancel()
	waitClosed(t, done, 15*time.Second)
	// After shutdown nothing should be left running or ONLINE.
	for _, st := range s.States() {
		if s.IsRunning(st.CameraID) {
			t.Errorf("camera %s still running after shutdown", st.CameraID)
		}
	}
}

func TestStopOneLeavesOthersRunning(t *testing.T) {
	s := NewSupervisor(multiCamConfig(), quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()

	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") && s.IsRunning("cam-b") })

	// Stop ONLY cam-a. cam-b must keep running.
	s.StopCamera("cam-a")
	if s.IsRunning("cam-a") {
		t.Error("cam-a should be stopped")
	}
	if !s.IsRunning("cam-b") {
		t.Error("cam-b must remain running when cam-a is stopped (fault/lifecycle isolation)")
	}

	// Restart cam-a independently.
	s.StartCamera("cam-a")
	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") })
	if !s.IsRunning("cam-b") {
		t.Error("cam-b must remain running across cam-a restart")
	}

	cancel()
	waitClosed(t, done, 15*time.Second)
}

func TestControlIdempotency(t *testing.T) {
	s := NewSupervisor(multiCamConfig(), quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") })

	// Double-start is a no-op; double-stop is a no-op; unknown id is safe.
	s.StartCamera("cam-a")
	s.StartCamera("cam-a")
	if !s.IsRunning("cam-a") {
		t.Error("cam-a should still be running after double-start")
	}
	s.StopCamera("cam-a")
	s.StopCamera("cam-a") // must not block or panic
	if s.IsRunning("cam-a") {
		t.Error("cam-a should be stopped")
	}
	s.StartCamera("no-such-camera") // safe no-op
	s.StopCamera("no-such-camera")  // safe no-op

	cancel()
	waitClosed(t, done, 15*time.Second)
}

func TestStopAllThenStartAll(t *testing.T) {
	s := NewSupervisor(multiCamConfig(), quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") && s.IsRunning("cam-b") })

	s.StopAll()
	for _, id := range []string{"cam-a", "cam-b"} {
		if s.IsRunning(id) {
			t.Errorf("%s should be stopped after StopAll", id)
		}
	}

	s.StartAll()
	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") && s.IsRunning("cam-b") })
	// StartAll must NOT start disabled cam-c.
	if s.IsRunning("cam-c") {
		t.Error("StartAll must not start disabled cam-c")
	}

	cancel()
	waitClosed(t, done, 15*time.Second)
}

// --- helpers ---

func waitFor(t *testing.T, d time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(d)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("condition not met within %s", d)
}

func waitClosed(t *testing.T, ch <-chan struct{}, d time.Duration) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(d):
		t.Fatalf("channel not closed within %s", d)
	}
}

func TestCameraStateTransitions(t *testing.T) {
	fixed := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	orig := nowFn
	nowFn = func() time.Time { return fixed }
	defer func() { nowFn = orig }()

	st := NewCameraState("cam-x", "X")
	if st.Snapshot().Status != StatusIdle {
		t.Fatal("should start IDLE")
	}
	st.setConnecting("probing")
	if st.Snapshot().Status != StatusConnecting {
		t.Error("expected CONNECTING")
	}
	st.setOnline("h264", "1920x1080")
	if snap := st.Snapshot(); snap.Status != StatusOnline || snap.VideoCodec != "h264" || snap.Resolution != "1920x1080" {
		t.Errorf("expected ONLINE with probed facts, got %+v", snap)
	}
	st.setReconnecting("ffmpeg exited")
	if s := st.Snapshot(); s.Status != StatusReconnecting || s.ReconnectCount != 1 {
		t.Errorf("expected RECONNECTING reconnectCount=1, got %+v", s)
	}
	st.setReconnecting("again")
	if st.Snapshot().ReconnectCount != 2 {
		t.Error("reconnectCount should increment")
	}
	st.setStopped()
	if st.Snapshot().Status != StatusStopped {
		t.Error("expected STOPPED")
	}
}
