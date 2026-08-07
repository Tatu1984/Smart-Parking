package publisher

import (
	"context"
	"os/exec"
	"runtime"
	"syscall"
	"testing"
	"time"
)

// TestContextCancelKillsChild is the mechanical guarantee behind "no orphaned
// ffmpeg": the agent launches ffmpeg via exec.CommandContext, so cancelling a
// camera's context terminates its child process, and Wait() reaps it. This test
// proves that guarantee directly with a long-lived child (sleep) standing in for
// ffmpeg, mirroring exactly how runFFmpeg starts and waits on the process.
func TestContextCancelKillsChild(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("uses POSIX sleep + signal 0")
	}
	ctx, cancel := context.WithCancel(context.Background())

	// Same construction as publisher.runFFmpeg: ctx-bound command.
	cmd := exec.CommandContext(ctx, "sleep", "300")
	if err := cmd.Start(); err != nil {
		t.Fatalf("start child: %v", err)
	}
	pid := cmd.Process.Pid

	// Child is alive.
	if err := syscall.Kill(pid, 0); err != nil {
		t.Fatalf("child should be alive: %v", err)
	}

	// Cancelling the context must terminate it; Wait() reaps it (as runFFmpeg does).
	done := make(chan struct{})
	go func() { _ = cmd.Wait(); close(done) }()
	cancel()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("child not reaped within 5s of context cancel")
	}

	// After Wait returns, the process must be gone (no orphan). Poll briefly for
	// the kernel to finish reaping.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if syscall.Kill(pid, 0) != nil {
			return // process gone — success
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("child pid %d still alive after cancel (orphaned)", pid)
}
