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
	StatusStalled      Status = "STALLED"      // ffmpeg alive but not producing output; being restarted
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

	// Metadata (set once after construction; optional).
	group        string
	capabilities Capabilities

	// Live state.
	status      Status
	detail      string     // last human-readable reason (e.g. "source not reachable")
	lastError   string
	errorClass  ErrorClass // operator-facing failure category (empty when healthy)

	// Metrics.
	reconnectCount int
	startedAt      time.Time  // when the current successful publish began (zero if not publishing)
	lastSeenAt     time.Time  // last time it was confirmed publishing
	lastChangeAt   time.Time  // last status transition
	firstStartedAt time.Time  // when this camera first went online (for uptime ratio)
	totalOnline    time.Duration // accumulated online time (for uptime/health)

	// Probed source facts (populated on connect).
	videoCodec string
	resolution string

	// Reserved metrics (future phases populate these; zero for now).
	fps             float64
	bitrateKbps     int
	recordingStatus string
	aiStatus        string
	edgeLatencyMs   int

	// Bounded in-memory history (diagnostics; not persisted).
	reconnects  *ring[time.Time]
	transitions *ring[Transition]
	bitrateHist *ring[BitrateSample]

	// onTransition fires (outside the lock) after each status change; wired by
	// the publisher to the supervisor event bus. Nil = no subscribers.
	onTransition func(from, to Status, detail string)
}

// Capabilities mirrors config.CameraCapabilities in the runtime state so readers
// (GUI/AI) can gate features without importing config.
type Capabilities struct {
	SupportsPTZ       bool
	SupportsAudio     bool
	SupportsRecording bool
	SupportsAI        bool
}

// NewCameraState creates a state object for a camera in the IDLE state.
func NewCameraState(cameraID, name string) *CameraState {
	return &CameraState{
		CameraID:     cameraID,
		Name:         name,
		status:       StatusIdle,
		lastChangeAt: time.Time{},
		reconnects:   newRing[time.Time](histReconnects),
		transitions:  newRing[Transition](histTransitions),
		bitrateHist:  newRing[BitrateSample](histBitrate),
	}
}

// SetMeta attaches optional group + capabilities (called once after construction).
func (s *CameraState) SetMeta(group string, caps Capabilities) {
	s.mu.Lock()
	s.group = group
	s.capabilities = caps
	s.mu.Unlock()
}

// History returns a snapshot of the bounded diagnostic history.
func (s *CameraState) History() HistorySnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return HistorySnapshot{
		Reconnects:  s.reconnects.slice(),
		Transitions: s.transitions.slice(),
		Bitrate:     s.bitrateHist.slice(),
	}
}

// healthScore computes a 0–100 health value from reconnect churn, uptime, and
// current status. v1 heuristic — documented in runtime-api.md; intentionally
// simple, meant to be refined later. Must be called with s.mu held.
func (s *CameraState) healthScore() int {
	// Terminal/negative states dominate.
	switch s.status {
	case StatusFailed:
		return 0
	case StatusOffline:
		return 20
	case StatusReconnecting, StatusStalled:
		return 40
	case StatusIdle, StatusStopped:
		return 100 // not an error; nothing wrong, just not running
	}
	// ONLINE / CONNECTING: start high, penalize recent reconnect churn.
	score := 100
	recent := 0
	cutoff := nowFn().Add(-10 * time.Minute)
	for _, t := range s.reconnects.slice() {
		if t.After(cutoff) {
			recent++
		}
	}
	score -= recent * 8 // each reconnect in the last 10 min costs 8 points
	if score < 30 {
		score = 30 // an online camera is never worse than 30
	}
	if score > 100 {
		score = 100
	}
	return score
}

// StateSnapshot is an immutable copy safe to hand to readers (GUI, status API).
//
// The metric fields below (FPS…EdgeLatencyMs) are FUTURE-PROOFING: the table
// binds to this stable struct, so columns for FPS / bitrate / recording / AI /
// latency can be added to the GUI without changing the state contract. They are
// zero/empty until later phases populate them.
type StateSnapshot struct {
	CameraID       string
	Name           string
	Group          string
	Capabilities   Capabilities
	Status         Status
	Detail         string
	LastError      string
	ErrorClass     ErrorClass // operator-facing failure category (empty when healthy)
	ErrorHint      string     // remediation text for ErrorClass (empty when healthy)
	HealthScore    int        // 0–100 (v1 heuristic; see runtime-api.md)
	ReconnectCount int
	StartedAt      time.Time
	LastSeenAt     time.Time
	LastChangeAt   time.Time
	VideoCodec     string
	Resolution     string

	// --- reserved for future population (Phase 3/4) ---
	FPS             float64 // measured frame rate
	BitrateKbps     int     // measured publish bitrate
	RecordingStatus string  // e.g. "off" | "recording"
	AIStatus        string  // e.g. "off" | "detecting"
	EdgeLatencyMs   int     // source→publish latency estimate
}

// Snapshot returns a consistent copy of the current state.
func (s *CameraState) Snapshot() StateSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return StateSnapshot{
		CameraID:       s.CameraID,
		Name:           s.Name,
		Group:          s.group,
		Capabilities:   s.capabilities,
		Status:         s.status,
		Detail:         s.detail,
		LastError:      s.lastError,
		ErrorClass:     s.errorClass,
		ErrorHint:      errorHint(s.errorClass),
		HealthScore:    s.healthScore(),
		ReconnectCount: s.reconnectCount,
		StartedAt:      s.startedAt,
		LastSeenAt:     s.lastSeenAt,
		LastChangeAt:   s.lastChangeAt,
		VideoCodec:     s.videoCodec,
		Resolution:     s.resolution,

		FPS:             s.fps,
		BitrateKbps:     s.bitrateKbps,
		RecordingStatus: s.recordingStatus,
		AIStatus:        s.aiStatus,
		EdgeLatencyMs:   s.edgeLatencyMs,
	}
}

// onTransition, if set, is invoked (OUTSIDE the state lock) after every status
// transition. The publisher wires this to the supervisor's event bus. It must be
// non-blocking (the bus drops on a full buffer) so it can never stall the state.
func (s *CameraState) SetTransitionHook(fn func(from, to Status, detail string)) {
	s.mu.Lock()
	s.onTransition = fn
	s.mu.Unlock()
}

// recordTransition (mu held) updates status, timestamps, and history, and
// returns the previous status + the hook to fire after unlocking.
func (s *CameraState) recordTransition(to Status, detail string) (from Status, fire func()) {
	from = s.status
	now := nowFn()
	s.status = to
	s.detail = detail
	s.lastChangeAt = now
	if from != to {
		s.transitions.add(Transition{At: now, From: from, To: to, Detail: detail})
	}
	hook := s.onTransition
	if hook != nil && from != to {
		return from, func() { hook(from, to, detail) }
	}
	return from, func() {}
}

func (s *CameraState) set(status Status, detail string) {
	s.mu.Lock()
	_, fire := s.recordTransition(status, detail)
	s.mu.Unlock()
	fire()
}

func (s *CameraState) setConnecting(detail string) { s.set(StatusConnecting, detail) }
func (s *CameraState) setOffline(detail string)    { s.set(StatusOffline, detail) }

func (s *CameraState) setReconnecting(detail string) {
	s.mu.Lock()
	s.reconnectCount++
	s.reconnects.add(nowFn())
	s.startedAt = time.Time{}
	_, fire := s.recordTransition(StatusReconnecting, detail)
	s.mu.Unlock()
	fire()
}

func (s *CameraState) setFailed(err string) { s.setErr(StatusFailed, err) }
func (s *CameraState) setStopped()          { s.set(StatusStopped, "stopped") }

func (s *CameraState) setErr(status Status, err string) {
	s.mu.Lock()
	s.lastError = err
	_, fire := s.recordTransition(status, err)
	s.mu.Unlock()
	fire()
}

// setErrorClass records the operator-facing failure category. Set alongside the
// status transition that reported the failure; cleared automatically on the next
// successful publish (setOnline).
func (s *CameraState) setErrorClass(c ErrorClass) {
	s.mu.Lock()
	s.errorClass = c
	s.mu.Unlock()
}

// setOnline marks a successful publish start and records probed facts.
func (s *CameraState) setOnline(codec, resolution string) {
	s.mu.Lock()
	now := nowFn()
	s.errorClass = "" // healthy again → clear any prior classified error
	s.videoCodec = codec
	s.resolution = resolution
	s.startedAt = now
	s.lastSeenAt = now
	if s.firstStartedAt.IsZero() {
		s.firstStartedAt = now
	}
	_, fire := s.recordTransition(StatusOnline, "publishing")
	s.mu.Unlock()
	fire()
}

// touch updates lastSeenAt while a publish is healthy (called on ffmpeg output).
func (s *CameraState) touch() {
	s.mu.Lock()
	s.lastSeenAt = nowFn()
	s.mu.Unlock()
}

// setStalled marks a running-but-frozen publish (watchdog). It transitions into
// the normal reconnect path afterwards, so it is a transient state.
func (s *CameraState) setStalled(detail string) {
	s.mu.Lock()
	_, fire := s.recordTransition(StatusStalled, detail)
	s.mu.Unlock()
	fire()
}

// isOnlineSince reports the current status and how long since the last ffmpeg
// output — the signal the stall watchdog uses. Returns online=true only when
// actively ONLINE.
func (s *CameraState) isOnlineSince() (online bool, sinceSeen time.Duration) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.status != StatusOnline {
		return false, 0
	}
	if s.lastSeenAt.IsZero() {
		return true, 0
	}
	return true, nowFn().Sub(s.lastSeenAt)
}

// nowFn is overridable in tests (production uses time.Now).
var nowFn = time.Now
