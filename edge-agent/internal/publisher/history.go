package publisher

import "time"

// Bounded in-memory history for diagnostics. Fixed capacity, no allocation on
// the hot path after warm-up, never persisted. Guarded by CameraState.mu.

const (
	histReconnects  = 10 // last N reconnect timestamps
	histTransitions = 20 // last N status transitions
	histBitrate     = 20 // last N bitrate samples
)

// Transition is one recorded status change.
type Transition struct {
	At     time.Time
	From   Status
	To     Status
	Detail string
}

// BitrateSample is one measured bitrate reading (future population).
type BitrateSample struct {
	At          time.Time
	BitrateKbps int
}

// ring is a fixed-capacity circular buffer of any comparable-agnostic value.
type ring[T any] struct {
	buf  []T
	next int
	size int
}

func newRing[T any](capacity int) *ring[T] { return &ring[T]{buf: make([]T, capacity)} }

func (r *ring[T]) add(v T) {
	r.buf[r.next] = v
	r.next = (r.next + 1) % len(r.buf)
	if r.size < len(r.buf) {
		r.size++
	}
}

// slice returns the items oldest→newest (a copy, safe to hand out).
func (r *ring[T]) slice() []T {
	out := make([]T, 0, r.size)
	start := (r.next - r.size + len(r.buf)) % len(r.buf)
	for i := 0; i < r.size; i++ {
		out = append(out, r.buf[(start+i)%len(r.buf)])
	}
	return out
}

// HistorySnapshot is an immutable copy of a camera's recent history.
type HistorySnapshot struct {
	Reconnects  []time.Time
	Transitions []Transition
	Bitrate     []BitrateSample
}
