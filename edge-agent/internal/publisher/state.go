package publisher

import (
	"sync"
	"time"
)

// Status is a camera's live runtime state within the agent. It is distinct from
// the portal's ONLINE/OFFLINE (which the portal derives from playlist
// freshness) — this is the agent's own finer-grained view.
type Status string

const (
	StatusIdle         Status = "IDLE"         // not started yet
	StatusConnecting   Status = "CONNECTING"   // probing the source for the first time
	StatusOnline       Status = "ONLINE"       // ffmpeg publishing successfully
	StatusReconnecting Status = "RECONNECTING" // ffmpeg exited; backing off to retry
	StatusOffline      Status = "OFFLINE"      // source unreachable at the moment
	StatusFailed       Status = "FAILED"       // stopped permanently (e.g. bad config)
	StatusStopped      Status = "STOPPED"      // supervisor asked it to stop
)

// CameraState is the per-camera runtime state + metrics. Each camera owns one;
// the supervisor exposes a snapshot so later phases (GUI, a local status
// endpoint) can render per-camera health WITHOUT refactoring. All access is
// mutex-guarded because the publisher goroutine writes while readers snapshot.
type CameraState struct {
	mu sync.RWMutex

	// Identity (immutable).
	CameraID string
	Name     string

	// Live state.
	status      Status
	detail      string // last human-readable reason (e.g. "source not reachable")
	lastError   string

	// Metrics.
	reconnectCount int
	startedAt      time.Time  // when the current successful publish began (zero if not publishing)
	lastSeenAt     time.Time  // last time it was confirmed publishing
	lastChangeAt   time.Time  // last status transition

	// Probed source facts (populated on connect).
	videoCodec string
	resolution string
}

// NewCameraState creates a state object for a camera in the IDLE state.
func NewCameraState(cameraID, name string) *CameraState {
	return &CameraState{
		CameraID:     cameraID,
		Name:         name,
		status:       StatusIdle,
		lastChangeAt: time.Time{},
	}
}

// StateSnapshot is an immutable copy safe to hand to readers (GUI, status API).
type StateSnapshot struct {
	CameraID       string
	Name           string
	Status         Status
	Detail         string
	LastError      string
	ReconnectCount int
	StartedAt      time.Time
	LastSeenAt     time.Time
	LastChangeAt   time.Time
	VideoCodec     string
	Resolution     string
}

// Snapshot returns a consistent copy of the current state.
func (s *CameraState) Snapshot() StateSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return StateSnapshot{
		CameraID:       s.CameraID,
		Name:           s.Name,
		Status:         s.status,
		Detail:         s.detail,
		LastError:      s.lastError,
		ReconnectCount: s.reconnectCount,
		StartedAt:      s.startedAt,
		LastSeenAt:     s.lastSeenAt,
		LastChangeAt:   s.lastChangeAt,
		VideoCodec:     s.videoCodec,
		Resolution:     s.resolution,
	}
}

// --- mutators used by the publisher, each records the transition time ---

func (s *CameraState) set(status Status, detail string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = status
	s.detail = detail
	s.lastChangeAt = nowFn()
}

func (s *CameraState) setConnecting(detail string) { s.set(StatusConnecting, detail) }
func (s *CameraState) setOffline(detail string)    { s.set(StatusOffline, detail) }
func (s *CameraState) setReconnecting(detail string) {
	s.mu.Lock()
	s.status = StatusReconnecting
	s.detail = detail
	s.reconnectCount++
	s.startedAt = time.Time{}
	s.lastChangeAt = nowFn()
	s.mu.Unlock()
}
func (s *CameraState) setFailed(err string)  { s.setErr(StatusFailed, err) }
func (s *CameraState) setStopped()           { s.set(StatusStopped, "stopped") }

func (s *CameraState) setErr(status Status, err string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = status
	s.lastError = err
	s.detail = err
	s.lastChangeAt = nowFn()
}

// setOnline marks a successful publish start and records probed facts.
func (s *CameraState) setOnline(codec, resolution string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := nowFn()
	s.status = StatusOnline
	s.detail = "publishing"
	s.videoCodec = codec
	s.resolution = resolution
	s.startedAt = now
	s.lastSeenAt = now
	s.lastChangeAt = now
}

// touch updates lastSeenAt while a publish is healthy.
func (s *CameraState) touch() {
	s.mu.Lock()
	s.lastSeenAt = nowFn()
	s.mu.Unlock()
}

// nowFn is overridable in tests (production uses time.Now).
var nowFn = time.Now
