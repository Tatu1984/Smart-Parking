package publisher

import (
	"testing"
	"time"
)

func TestRingKeepsLastN(t *testing.T) {
	r := newRing[int](3)
	for i := 1; i <= 5; i++ {
		r.add(i)
	}
	got := r.slice() // oldest→newest
	want := []int{3, 4, 5}
	if len(got) != 3 {
		t.Fatalf("expected 3 items, got %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("ring order wrong: got %v want %v", got, want)
		}
	}
}

func TestHistoryRecordsTransitionsAndReconnects(t *testing.T) {
	st := NewCameraState("c", "C")
	st.setConnecting("probe")
	st.setOnline("h264", "1920x1080")
	st.setReconnecting("exit")
	st.setOnline("h264", "1920x1080")

	h := st.History()
	if len(h.Transitions) < 3 {
		t.Errorf("expected >=3 transitions recorded, got %d", len(h.Transitions))
	}
	if len(h.Reconnects) != 1 {
		t.Errorf("expected 1 reconnect recorded, got %d", len(h.Reconnects))
	}
	// Transitions are oldest→newest and carry from/to.
	last := h.Transitions[len(h.Transitions)-1]
	if last.To != StatusOnline {
		t.Errorf("last transition should be ONLINE, got %s", last.To)
	}
}

func TestHealthScore(t *testing.T) {
	orig := nowFn
	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	nowFn = func() time.Time { return base }
	defer func() { nowFn = orig }()

	st := NewCameraState("c", "C")

	// FAILED → 0
	st.setFailed("bad config")
	if got := st.Snapshot().HealthScore; got != 0 {
		t.Errorf("FAILED health = %d, want 0", got)
	}

	// Fresh ONLINE, no reconnects → 100
	st2 := NewCameraState("c2", "C2")
	st2.setOnline("h264", "1080p")
	if got := st2.Snapshot().HealthScore; got != 100 {
		t.Errorf("clean ONLINE health = %d, want 100", got)
	}

	// ONLINE with several recent reconnects → reduced but >=30
	st3 := NewCameraState("c3", "C3")
	for i := 0; i < 5; i++ {
		st3.setReconnecting("churn")
	}
	st3.setOnline("h264", "1080p")
	got := st3.Snapshot().HealthScore
	if got >= 100 || got < 30 {
		t.Errorf("churny ONLINE health = %d, want between 30 and 99", got)
	}

	// OFFLINE → 20
	st4 := NewCameraState("c4", "C4")
	st4.setOffline("unreachable")
	if got := st4.Snapshot().HealthScore; got != 20 {
		t.Errorf("OFFLINE health = %d, want 20", got)
	}
}

func TestSnapshotCarriesGroupAndCapabilities(t *testing.T) {
	st := NewCameraState("c", "C")
	st.SetMeta("Entrance", Capabilities{SupportsPTZ: true, SupportsAI: true})
	snap := st.Snapshot()
	if snap.Group != "Entrance" {
		t.Errorf("group = %q, want Entrance", snap.Group)
	}
	if !snap.Capabilities.SupportsPTZ || !snap.Capabilities.SupportsAI {
		t.Errorf("capabilities not carried: %+v", snap.Capabilities)
	}
	if snap.Capabilities.SupportsAudio {
		t.Error("SupportsAudio should default false")
	}
}
