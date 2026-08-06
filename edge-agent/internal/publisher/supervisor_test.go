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

func TestSupervisorBuildsOnePublisherPerEnabledCamera(t *testing.T) {
	s := NewSupervisor(multiCamConfig(), quietLogger())
	states := s.States()
	if len(states) != 2 {
		t.Fatalf("expected 2 publishers (enabled only), got %d", len(states))
	}
	// Identities are the stable CameraIDs, independent per camera.
	ids := map[string]bool{}
	for _, st := range states {
		ids[st.CameraID] = true
		if st.Status != StatusIdle {
			t.Errorf("camera %s should start IDLE, got %s", st.CameraID, st.Status)
		}
	}
	if !ids["cam-a"] || !ids["cam-b"] {
		t.Errorf("expected cam-a and cam-b, got %v", ids)
	}
	if ids["cam-c"] {
		t.Error("disabled cam-c should not have a publisher")
	}
}

func TestSupervisorStopsOnContextCancel(t *testing.T) {
	// Cameras point at an unreachable port; probe fails fast and the loop backs
	// off. Cancelling ctx must make Run return promptly for ALL cameras.
	s := NewSupervisor(multiCamConfig(), quietLogger())
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()

	cancel()
	select {
	case <-done:
		// good — returned after cancel
	case <-time.After(15 * time.Second):
		t.Fatal("supervisor did not stop within 15s of cancel")
	}

	// After stopping, both cameras should be in a terminal-ish state (STOPPED
	// or OFFLINE), never left ONLINE.
	for _, st := range s.States() {
		if st.Status == StatusOnline {
			t.Errorf("camera %s left ONLINE after stop", st.CameraID)
		}
	}
}

func TestCameraStateTransitions(t *testing.T) {
	// Freeze time so lastChangeAt is deterministic.
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
	snap := st.Snapshot()
	if snap.Status != StatusOnline || snap.VideoCodec != "h264" || snap.Resolution != "1920x1080" {
		t.Errorf("expected ONLINE with probed facts, got %+v", snap)
	}

	st.setReconnecting("ffmpeg exited")
	if s := st.Snapshot(); s.Status != StatusReconnecting || s.ReconnectCount != 1 {
		t.Errorf("expected RECONNECTING with reconnectCount=1, got %+v", s)
	}
	st.setReconnecting("again")
	if st.Snapshot().ReconnectCount != 2 {
		t.Error("reconnectCount should increment per reconnect")
	}

	st.setStopped()
	if st.Snapshot().Status != StatusStopped {
		t.Error("expected STOPPED")
	}
}
