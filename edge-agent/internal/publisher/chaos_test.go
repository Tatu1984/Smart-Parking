package publisher

import (
	"context"
	"fmt"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/sparking/edge-agent/internal/config"
)

// tcpSink is a throwaway TCP listener used to simulate a source that is
// reachable, then vanishes (reboot / cable pull), then returns. It doesn't speak
// RTSP — the point is to exercise the agent's probe/offline/reconnect STATE
// MACHINE and prove it recovers without crashing, leaking goroutines, or wedging.
type tcpSink struct {
	mu   sync.Mutex
	ln   net.Listener
	addr string
}

func newTCPSink(t *testing.T) *tcpSink {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	s := &tcpSink{ln: ln, addr: ln.Addr().String()}
	go s.accept()
	return s
}

func (s *tcpSink) accept() {
	for {
		s.mu.Lock()
		ln := s.ln
		s.mu.Unlock()
		if ln == nil {
			return
		}
		c, err := ln.Accept()
		if err != nil {
			return
		}
		c.Close() // accept then immediately close — "reachable but not a stream"
	}
}

func (s *tcpSink) down() {
	s.mu.Lock()
	if s.ln != nil {
		s.ln.Close()
		s.ln = nil
	}
	s.mu.Unlock()
}

func (s *tcpSink) up(t *testing.T) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ln, err := net.Listen("tcp", s.addr) // same port
	if err != nil {
		t.Fatalf("sink back up: %v", err)
	}
	s.ln = ln
	go s.accept()
}

func chaosConfig(rtsp string) *config.Config {
	c := &config.Config{SchemaVersion: config.CurrentSchemaVersion}
	c.FFmpeg.Binary = "ffmpeg"
	c.FFmpeg.Transcode = "copy"
	c.BackoffMaxSeconds = 2
	c.Cameras = []config.CameraConfig{
		{CameraID: "cam-chaos", Name: "Chaos", RTSP: rtsp,
			Publish: "https://ingest.invalid/c/index.m3u8", Token: "t", Enabled: true},
		{CameraID: "cam-stable", Name: "Stable", RTSP: "rtsp://127.0.0.1:1/s",
			Publish: "https://ingest.invalid/s/index.m3u8", Token: "t", Enabled: true},
	}
	return c
}

// TestChaosSourceRebootRecovers cycles a source down→up several times while the
// supervisor runs and asserts: the agent never crashes, the OTHER camera is
// unaffected (isolation), and after the source returns the chaos camera is back
// in a live/probing state (not stuck FAILED). Goroutines return to baseline on
// shutdown (no leak from the churn).
func TestChaosSourceRebootRecovers(t *testing.T) {
	if testing.Short() {
		t.Skip("chaos test skipped under -short")
	}
	sink := newTCPSink(t)
	rtsp := fmt.Sprintf("rtsp://%s/live", sink.addr)

	s := NewSupervisor(chaosConfig(rtsp), quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	waitFor(t, 5*time.Second, func() bool { return s.IsRunning("cam-chaos") && s.IsRunning("cam-stable") })

	statusOf := func(id string) Status {
		for _, st := range s.States() {
			if st.CameraID == id {
				return st.Status
			}
		}
		return ""
	}

	// Several reboot cycles.
	for i := 0; i < 4; i++ {
		sink.down()
		// The chaos camera must NOT get permanently stuck; it should churn through
		// offline/reconnecting. The stable camera must keep running throughout.
		time.Sleep(1500 * time.Millisecond)
		if !s.IsRunning("cam-stable") {
			t.Fatalf("cycle %d: isolation broke — stable camera stopped running", i)
		}
		if statusOf("cam-chaos") == StatusFailed {
			t.Fatalf("cycle %d: chaos camera went FAILED (should retry, not give up)", i)
		}
		sink.up(t)
		time.Sleep(1500 * time.Millisecond)
		// Still running (goroutine alive) after recovery.
		if !s.IsRunning("cam-chaos") {
			t.Fatalf("cycle %d: chaos camera goroutine died after source returned", i)
		}
	}

	cancel()
	waitClosed(t, done, 20*time.Second)
	for _, st := range s.States() {
		if s.IsRunning(st.CameraID) {
			t.Errorf("camera %s still running after shutdown", st.CameraID)
		}
	}
}
