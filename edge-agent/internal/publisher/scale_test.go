package publisher

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"testing"
	"time"

	"github.com/sparking/edge-agent/internal/config"
)

// scaleConfig builds n cameras pointing at an unreachable local port, so each
// publisher exercises the real probe→offline→backoff path without needing n real
// cameras or n live ffmpeg processes.
func scaleConfig(n int) *config.Config {
	c := &config.Config{SchemaVersion: config.CurrentSchemaVersion}
	c.FFmpeg.Binary = "ffmpeg"
	c.FFmpeg.Transcode = "copy"
	c.BackoffMaxSeconds = 2 // keep the loop lively so goroutines actually cycle
	c.Cameras = make([]config.CameraConfig, n)
	for i := 0; i < n; i++ {
		id := fmt.Sprintf("cam-%03d", i)
		c.Cameras[i] = config.CameraConfig{
			CameraID: id,
			Name:     id,
			RTSP:     fmt.Sprintf("rtsp://127.0.0.1:1/%d", i), // port 1 → refused fast
			Publish:  fmt.Sprintf("https://ingest.invalid/%d/index.m3u8", i),
			Token:    "t",
			Enabled:  true,
		}
	}
	return c
}

// countOpenFDs returns this process's open file-descriptor count on Linux, or -1
// if unavailable (best-effort; the check is skipped when unsupported).
func countOpenFDs() int {
	entries, err := os.ReadDir("/proc/self/fd")
	if err != nil {
		return -1
	}
	return len(entries)
}

// TestScaleManyCameras is a headless scale check: stand up N cameras in ONE
// supervisor, let them all reach a steady (offline/backoff) state, and record
// goroutine count, open FDs, /states payload size, and heap. It asserts only
// coarse safety bounds (no runaway goroutines/FDs); the numbers are logged so a
// human can eyeball scaling. Set EDGE_SCALE (e.g. 200) to change the count.
//
// Skipped under -short. This is deliberately NOT a pass/fail perf gate — it is
// evidence collection + a guard against gross leaks.
func TestScaleManyCameras(t *testing.T) {
	if testing.Short() {
		t.Skip("scale test skipped under -short")
	}
	n := 100
	if v := os.Getenv("EDGE_SCALE"); v != "" {
		fmt.Sscanf(v, "%d", &n)
	}

	base := runtime.NumGoroutine()
	baseFD := countOpenFDs()

	s := NewSupervisor(scaleConfig(n), quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()

	// Wait until all cameras have left IDLE (each goroutine has started + probed).
	waitFor(t, 30*time.Second, func() bool {
		for _, st := range s.States() {
			if st.Status == StatusIdle {
				return false
			}
		}
		return true
	})
	// Let it settle into steady-state backoff.
	time.Sleep(3 * time.Second)

	goroutines := runtime.NumGoroutine() - base
	fds := countOpenFDs()
	states := s.States()

	payload, _ := json.Marshal(states)
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)

	t.Logf("SCALE n=%d: goroutines(+%d) fds=%d (base %d) statesPayload=%dKB heapAlloc=%dMB",
		n, goroutines, fds, baseFD, len(payload)/1024, ms.HeapAlloc/1024/1024)

	// Coarse safety bounds (not perf gates):
	//  - goroutines should scale ~linearly, a handful per camera — never 100s/cam.
	if goroutines > n*8+50 {
		t.Errorf("goroutine blowup: +%d for %d cameras (>%d)", goroutines, n, n*8+50)
	}
	//  - FDs must stay far below the process limit; a leak would climb without bound.
	if fds > 0 && fds > n*4+200 {
		t.Errorf("FD blowup: %d fds for %d cameras (>%d) — possible descriptor leak", fds, n, n*4+200)
	}
	//  - all cameras must be represented in States().
	if len(states) != n {
		t.Errorf("States() returned %d, want %d", len(states), n)
	}

	cancel()
	waitClosed(t, done, 60*time.Second)

	// After shutdown, goroutines should return near baseline (no leak).
	time.Sleep(500 * time.Millisecond)
	leaked := runtime.NumGoroutine() - base
	if leaked > 20 {
		t.Errorf("goroutine leak after shutdown: +%d still live", leaked)
	}
}
