// Package appmodel is the GUI's CONFIGURATION model — the "desired state"
// (cameras, groups, RTSP template) the operator edits, plus persistence,
// backup/restore, and versioned import/export. It is PURE (no Fyne, no engine),
// so the conflict/validation logic is unit-testable in isolation.
//
// It is deliberately separate from RUNTIME state (Supervisor.States()), keeping
// the two models independent (a core Phase-2 principle).
package appmodel

import (
	"fmt"
	"sort"
	"strings"

	"github.com/sparking/edge-agent/internal/config"
)

// Model holds the editable configuration. It never talks to the supervisor.
//
// THREADING CONTRACT: Model is NOT safe for concurrent use. It is designed to be
// driven from a single goroutine — the GUI's UI thread, where all mutators
// (Add/Update/Delete/ApplyImport/Save) and reads run. The GUI's only background
// goroutine is the status poller, which touches RUNTIME state (Supervisor
// snapshots via the control client), never this Model, and marshals its UI
// updates back onto the UI thread via fyne.Do. Cross-process config writes are
// serialized separately by the on-disk config lock (see config.AcquireLock).
// If a future caller needs concurrent access, add a mutex here — do not rely on
// the current type being goroutine-safe.
type Model struct {
	cfg *config.Config
}

// New wraps a loaded config (or a fresh one) in an editable model.
func New(cfg *config.Config) *Model {
	if cfg == nil {
		cfg = &config.Config{SchemaVersion: config.CurrentSchemaVersion}
	}
	if cfg.Cameras == nil {
		cfg.Cameras = []config.CameraConfig{}
	}
	return &Model{cfg: cfg}
}

// Config exposes the underlying config (read-only intent; callers must go
// through the mutators below to change cameras).
func (m *Model) Config() *config.Config { return m.cfg }

// Cameras returns the current camera list (copy of the slice header; entries are
// values, so callers get copies).
func (m *Model) Cameras() []config.CameraConfig {
	out := make([]config.CameraConfig, len(m.cfg.Cameras))
	copy(out, m.cfg.Cameras)
	return out
}

// Groups returns configured group names.
func (m *Model) Groups() []string { return append([]string(nil), m.cfg.Groups...) }

// FindIndex returns the slice index of a camera by id, or -1.
func (m *Model) FindIndex(cameraID string) int {
	for i := range m.cfg.Cameras {
		if m.cfg.Cameras[i].CameraID == cameraID {
			return i
		}
	}
	return -1
}

// Add appends a camera. Rejects a duplicate cameraId.
func (m *Model) Add(cam config.CameraConfig) error {
	if strings.TrimSpace(cam.CameraID) == "" {
		return fmt.Errorf("cameraId is required")
	}
	if m.FindIndex(cam.CameraID) >= 0 {
		return fmt.Errorf("cameraId %q already exists", cam.CameraID)
	}
	m.cfg.Cameras = append(m.cfg.Cameras, cam)
	m.registerGroup(cam.Group)
	return nil
}

// Update replaces the camera with the same cameraId.
func (m *Model) Update(cam config.CameraConfig) error {
	i := m.FindIndex(cam.CameraID)
	if i < 0 {
		return fmt.Errorf("cameraId %q not found", cam.CameraID)
	}
	m.cfg.Cameras[i] = cam
	m.registerGroup(cam.Group)
	return nil
}

// Delete removes a camera by id.
func (m *Model) Delete(cameraID string) {
	i := m.FindIndex(cameraID)
	if i < 0 {
		return
	}
	m.cfg.Cameras = append(m.cfg.Cameras[:i], m.cfg.Cameras[i+1:]...)
}

// SetEnabled toggles a camera's enabled flag.
func (m *Model) SetEnabled(cameraID string, enabled bool) {
	if i := m.FindIndex(cameraID); i >= 0 {
		m.cfg.Cameras[i].Enabled = enabled
	}
}

// --- bulk operations (config-level; runtime start/stop is the supervisor's job) ---

// SetEnabledBulk enables/disables several cameras at once.
func (m *Model) SetEnabledBulk(ids []string, enabled bool) {
	set := toSet(ids)
	for i := range m.cfg.Cameras {
		if set[m.cfg.Cameras[i].CameraID] {
			m.cfg.Cameras[i].Enabled = enabled
		}
	}
}

// DeleteBulk removes several cameras at once.
func (m *Model) DeleteBulk(ids []string) {
	set := toSet(ids)
	kept := m.cfg.Cameras[:0]
	for _, c := range m.cfg.Cameras {
		if !set[c.CameraID] {
			kept = append(kept, c)
		}
	}
	m.cfg.Cameras = kept
}

func (m *Model) registerGroup(g string) {
	if g == "" {
		return
	}
	for _, existing := range m.cfg.Groups {
		if existing == g {
			return
		}
	}
	m.cfg.Groups = append(m.cfg.Groups, g)
	sort.Strings(m.cfg.Groups)
}

func toSet(ids []string) map[string]bool {
	s := make(map[string]bool, len(ids))
	for _, id := range ids {
		s[id] = true
	}
	return s
}
