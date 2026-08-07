package publisher

import (
	"testing"
	"time"
)

func TestStallDetectionSignal(t *testing.T) {
	orig := nowFn
	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	cur := base
	nowFn = func() time.Time { return cur }
	defer func() { nowFn = orig }()

	st := NewCameraState("c", "C")
	st.setOnline("h264", "1080p") // lastSeenAt = base
	online, since := st.isOnlineSince()
	if !online || since != 0 {
		t.Fatalf("fresh online: online=%v since=%v", online, since)
	}

	// Advance time 40s with no touch() → stalled by a 30s window.
	cur = base.Add(40 * time.Second)
	online, since = st.isOnlineSince()
	if !online || since < 30*time.Second {
		t.Errorf("expected stalled >=30s, got online=%v since=%v", online, since)
	}

	// A touch() resets the clock.
	st.touch()
	if _, since := st.isOnlineSince(); since != 0 {
		t.Errorf("touch should reset stall clock, got %v", since)
	}

	// Not-online states never report stalled.
	st.setOffline("down")
	if online, _ := st.isOnlineSince(); online {
		t.Error("OFFLINE must not be reported as online/stallable")
	}
}

func TestSetStalledTransitionsAndEvents(t *testing.T) {
	st := NewCameraState("c", "C")
	st.setOnline("h264", "1080p")
	st.setStalled("no output for 30s")
	snap := st.Snapshot()
	if snap.Status != StatusStalled {
		t.Errorf("expected STALLED, got %s", snap.Status)
	}
	// STALLED maps to a reconnect-class event and reduced health.
	if eventFromStatus(StatusStalled) != EventCameraReconnect {
		t.Error("STALLED should emit a reconnect event")
	}
	if snap.HealthScore != 40 {
		t.Errorf("STALLED health = %d, want 40", snap.HealthScore)
	}
}
