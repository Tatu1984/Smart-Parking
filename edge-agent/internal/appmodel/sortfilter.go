package appmodel

import (
	"sort"
	"strings"

	"github.com/sparking/edge-agent/internal/publisher"
)

// SortKey selects the column to sort the table by.
type SortKey int

const (
	SortByName SortKey = iota
	SortByStatus
	SortByHealth
	SortByReconnects
	SortByLastSeen
	SortByGroup
)

// Filter describes the table's current filter. Empty fields match everything.
type Filter struct {
	Text   string              // matches name/cameraId/group (case-insensitive substring)
	Status publisher.Status    // "" = any
	Group  string              // "" = any
}

// Row combines a camera's runtime snapshot for display. (Config-only fields the
// table needs are already in the snapshot: id/name/group.)
type Row = publisher.StateSnapshot

// ApplyFilter returns the rows matching f, preserving input order. Efficient:
// single pass, no allocation beyond the result.
func ApplyFilter(rows []Row, f Filter) []Row {
	if f.Text == "" && f.Status == "" && f.Group == "" {
		return rows
	}
	text := strings.ToLower(f.Text)
	out := rows[:0:0] // new backing array, don't mutate caller's slice
	for _, r := range rows {
		if f.Status != "" && r.Status != f.Status {
			continue
		}
		if f.Group != "" && r.Group != f.Group {
			continue
		}
		if text != "" &&
			!strings.Contains(strings.ToLower(r.Name), text) &&
			!strings.Contains(strings.ToLower(r.CameraID), text) &&
			!strings.Contains(strings.ToLower(r.Group), text) {
			continue
		}
		out = append(out, r)
	}
	return out
}

// SortRows sorts rows by key. STABLE (sort.SliceStable) so equal rows keep their
// relative order across refreshes — avoids visual jitter. asc controls direction.
func SortRows(rows []Row, key SortKey, asc bool) {
	less := func(i, j int) bool {
		a, b := rows[i], rows[j]
		switch key {
		case SortByStatus:
			return a.Status < b.Status
		case SortByHealth:
			return a.HealthScore < b.HealthScore
		case SortByReconnects:
			return a.ReconnectCount < b.ReconnectCount
		case SortByLastSeen:
			return a.LastSeenAt.Before(b.LastSeenAt)
		case SortByGroup:
			return a.Group < b.Group
		default: // SortByName
			return strings.ToLower(a.Name) < strings.ToLower(b.Name)
		}
	}
	if asc {
		sort.SliceStable(rows, less)
	} else {
		sort.SliceStable(rows, func(i, j int) bool { return less(j, i) })
	}
}
