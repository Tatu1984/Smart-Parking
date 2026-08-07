package appmodel

import "github.com/sparking/edge-agent/internal/publisher"

// RuntimeView is a read-only adapter over the supervisor's runtime state. It
// computes ROW DIFFS between polls so the GUI repaints only changed rows — the
// key to staying responsive at 100–200 cameras. Pure (no Fyne), so it is
// unit-testable and keeps the GUI independent of the engine.
//
// The GUI holds one RuntimeView, calls Diff(newStates) each poll, and applies
// only the returned changes to its table widgets.
type RuntimeView struct {
	// last snapshot keyed by cameraId, and the last order seen.
	last  map[string]publisher.StateSnapshot
	order []string
}

// NewRuntimeView creates an empty view.
func NewRuntimeView() *RuntimeView {
	return &RuntimeView{last: make(map[string]publisher.StateSnapshot)}
}

// RowChange describes one row that must be repainted/added/removed.
type RowChange struct {
	CameraID string
	Snapshot publisher.StateSnapshot // zero for Removed
	Removed  bool
}

// DiffResult is the minimal set of updates since the previous Diff.
type DiffResult struct {
	Changed      []RowChange // added or updated rows (repaint these only)
	Removed      []string    // camera ids no longer present
	OrderChanged bool        // the set/order of cameras changed (rebuild layout)
}

// Diff compares new states against the last snapshot and returns only what
// changed. Equality uses the visible fields (status/health/reconnects/last-seen/
// metrics) so a poll with no visible change yields an empty result → no repaint.
func (v *RuntimeView) Diff(states []publisher.StateSnapshot) DiffResult {
	res := DiffResult{}
	newOrder := make([]string, 0, len(states))
	newSet := make(map[string]bool, len(states))

	for _, s := range states {
		newOrder = append(newOrder, s.CameraID)
		newSet[s.CameraID] = true
		prev, existed := v.last[s.CameraID]
		if !existed || rowChanged(prev, s) {
			res.Changed = append(res.Changed, RowChange{CameraID: s.CameraID, Snapshot: s})
		}
		v.last[s.CameraID] = s
	}

	// Removals.
	for id := range v.last {
		if !newSet[id] {
			res.Removed = append(res.Removed, id)
			delete(v.last, id)
		}
	}

	// Order/set change → the table layout (rows present) changed.
	if !sameOrder(v.order, newOrder) {
		res.OrderChanged = true
		v.order = newOrder
	}
	return res
}

// rowChanged reports whether any operator-visible field differs.
func rowChanged(a, b publisher.StateSnapshot) bool {
	return a.Name != b.Name ||
		a.Group != b.Group ||
		a.Status != b.Status ||
		a.HealthScore != b.HealthScore ||
		a.ReconnectCount != b.ReconnectCount ||
		!a.LastSeenAt.Equal(b.LastSeenAt) ||
		a.VideoCodec != b.VideoCodec ||
		a.Resolution != b.Resolution ||
		a.FPS != b.FPS ||
		a.BitrateKbps != b.BitrateKbps
}

func sameOrder(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
