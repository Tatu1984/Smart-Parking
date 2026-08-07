package publisher

import (
	"context"
	"runtime"
	"sync"
	"testing"
	"time"
)

// TestConcurrentLifecycleSpam hammers the runtime control surface from many
// goroutines at once — StartCamera/StopCamera/StartAll/StopAll/States/IsRunning —
// while the supervisor is running. Run with -race. It asserts:
//   - no data race (the -race flag),
//   - no deadlock (the whole thing completes well within the timeout),
//   - the supervisor is still responsive and consistent afterwards,
//   - a final StopAll leaves NOTHING running (no leaked/orphaned camera).
func TestConcurrentLifecycleSpam(t *testing.T) {
	s := NewSupervisor(multiCamConfig(), quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() { s.Run(ctx); close(runDone) }()
	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") })

	ids := []string{"cam-a", "cam-b", "cam-c"}
	var wg sync.WaitGroup
	// Broadcast stop via a closed channel — time.After fires ONCE and would only
	// release a single receiver, hanging the rest.
	stop := make(chan struct{})
	time.AfterFunc(2*time.Second, func() { close(stop) })

	// Spammers: per-camera start/stop churn.
	for _, id := range ids {
		id := id
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
					s.StartCamera(id)
					s.StopCamera(id)
				}
			}
		}()
	}
	// Global start-all / stop-all churn racing the per-camera ops.
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
				s.StartAll()
				s.StopAll()
			}
		}
	}()
	// Readers racing the writers (States/IsRunning must never race or panic).
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
				_ = s.States()
				for _, id := range ids {
					_ = s.IsRunning(id)
				}
			}
		}
	}()

	// The spam must finish (no deadlock).
	spamDone := make(chan struct{})
	go func() { wg.Wait(); close(spamDone) }()
	select {
	case <-spamDone:
	case <-time.After(20 * time.Second):
		buf := make([]byte, 1<<20)
		n := runtime.Stack(buf, true)
		t.Logf("GOROUTINE DUMP:\n%s", buf[:n])
		t.Fatal("DEADLOCK: concurrent lifecycle spam did not complete")
	}

	// Supervisor still responsive: a clean StopAll must quiesce everything.
	s.StopAll()
	waitFor(t, 5*time.Second, func() bool {
		for _, id := range ids {
			if s.IsRunning(id) {
				return false
			}
		}
		return true
	})

	cancel()
	waitClosed(t, runDone, 15*time.Second)

	// No camera left running after shutdown.
	for _, st := range s.States() {
		if s.IsRunning(st.CameraID) {
			t.Errorf("camera %s still running after shutdown", st.CameraID)
		}
	}
}

// TestStartStopIdempotentUnderConcurrency asserts that racing duplicate Start and
// Stop calls for the same camera never leave more than one live goroutine for it
// (idempotency holds under contention) and never orphan a run.
func TestStartStopIdempotentUnderConcurrency(t *testing.T) {
	s := NewSupervisor(multiCamConfig(), quietLogger(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runDone := make(chan struct{})
	go func() { s.Run(ctx); close(runDone) }()
	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") })

	base := runtime.NumGoroutine()

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func() { defer wg.Done(); s.StartCamera("cam-a") }()
		go func() { defer wg.Done(); s.StopCamera("cam-a") }()
	}
	wg.Wait()

	// Settle, then ensure a definite terminal state.
	s.StopCamera("cam-a")
	waitFor(t, 5*time.Second, func() bool { return !s.IsRunning("cam-a") })
	s.StartCamera("cam-a")
	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") })

	// Goroutine count must not have blown up (no per-call leak). Allow slack for
	// the runtime/scheduler; a leak would be dozens+, not a handful.
	time.Sleep(200 * time.Millisecond)
	grew := runtime.NumGoroutine() - base
	if grew > 20 {
		t.Errorf("possible goroutine leak: grew by %d after start/stop spam", grew)
	}

	cancel()
	waitClosed(t, runDone, 15*time.Second)
}
