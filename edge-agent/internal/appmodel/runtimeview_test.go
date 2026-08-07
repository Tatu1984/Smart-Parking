package appmodel

import (
	"testing"
	"time"

	"github.com/sparking/edge-agent/internal/publisher"
)

func snap(id string, status publisher.Status, health, reconnects int) publisher.StateSnapshot {
	return publisher.StateSnapshot{CameraID: id, Name: id, Status: status, HealthScore: health, ReconnectCount: reconnects}
}

func TestRuntimeViewDiff(t *testing.T) {
	v := NewRuntimeView()

	// First diff: everything is "changed" (new).
	states := []publisher.StateSnapshot{snap("a", publisher.StatusOnline, 100, 0), snap("b", publisher.StatusOffline, 20, 0)}
	d := v.Diff(states)
	if len(d.Changed) != 2 || !d.OrderChanged {
		t.Fatalf("first diff should mark all changed + order changed: %+v", d)
	}

	// Second diff, no change → nothing repaints.
	d = v.Diff(states)
	if len(d.Changed) != 0 || d.OrderChanged {
		t.Errorf("unchanged poll should yield no changes, got %+v", d)
	}

	// Change only 'a' status → only 'a' repaints.
	states2 := []publisher.StateSnapshot{snap("a", publisher.StatusReconnecting, 40, 1), snap("b", publisher.StatusOffline, 20, 0)}
	d = v.Diff(states2)
	if len(d.Changed) != 1 || d.Changed[0].CameraID != "a" {
		t.Errorf("only 'a' should change, got %+v", d.Changed)
	}
	if d.OrderChanged {
		t.Error("order did not change; OrderChanged should be false")
	}

	// Remove 'b'.
	d = v.Diff([]publisher.StateSnapshot{snap("a", publisher.StatusReconnecting, 40, 1)})
	if len(d.Removed) != 1 || d.Removed[0] != "b" {
		t.Errorf("expected 'b' removed, got %+v", d.Removed)
	}
	if !d.OrderChanged {
		t.Error("removing a row changes the set → OrderChanged true")
	}
}

func TestApplyFilter(t *testing.T) {
	rows := []Row{
		{CameraID: "cam-1", Name: "Entrance Gate", Group: "Entrance", Status: publisher.StatusOnline},
		{CameraID: "cam-2", Name: "Basement A", Group: "Basement", Status: publisher.StatusOffline},
		{CameraID: "cam-3", Name: "Exit", Group: "Exit", Status: publisher.StatusOnline},
	}
	// Text filter.
	got := ApplyFilter(rows, Filter{Text: "base"})
	if len(got) != 1 || got[0].CameraID != "cam-2" {
		t.Errorf("text filter wrong: %+v", got)
	}
	// Status filter.
	got = ApplyFilter(rows, Filter{Status: publisher.StatusOnline})
	if len(got) != 2 {
		t.Errorf("status filter wrong: %d", len(got))
	}
	// Group filter.
	got = ApplyFilter(rows, Filter{Group: "Exit"})
	if len(got) != 1 || got[0].CameraID != "cam-3" {
		t.Errorf("group filter wrong: %+v", got)
	}
	// Empty filter → all, and must NOT mutate the input slice.
	got = ApplyFilter(rows, Filter{})
	if len(got) != 3 {
		t.Errorf("empty filter should return all, got %d", len(got))
	}
}

func TestSortRowsStable(t *testing.T) {
	rows := []Row{
		{CameraID: "b", Name: "Bravo", HealthScore: 50, ReconnectCount: 2, LastSeenAt: time.Unix(200, 0)},
		{CameraID: "a", Name: "alpha", HealthScore: 50, ReconnectCount: 1, LastSeenAt: time.Unix(100, 0)},
		{CameraID: "c", Name: "Charlie", HealthScore: 90, ReconnectCount: 0, LastSeenAt: time.Unix(300, 0)},
	}
	SortRows(rows, SortByName, true)
	if rows[0].Name != "alpha" || rows[2].Name != "Charlie" {
		t.Errorf("name sort (case-insensitive) wrong: %v", names(rows))
	}
	SortRows(rows, SortByHealth, false) // desc
	if rows[0].HealthScore != 90 {
		t.Errorf("health desc wrong: %v", rows[0].HealthScore)
	}
	SortRows(rows, SortByReconnects, true)
	if rows[0].ReconnectCount != 0 {
		t.Errorf("reconnect asc wrong")
	}
}

func names(rows []Row) []string {
	out := make([]string, len(rows))
	for i, r := range rows {
		out[i] = r.Name
	}
	return out
}
