package publisher

import (
	"context"
	"log/slog"
	"sync"

	"github.com/sparking/edge-agent/internal/audit"
	"github.com/sparking/edge-agent/internal/config"
)

// managed wraps one camera's publisher with its OWN cancel func and a done
// channel, so it can be started/stopped independently of every other camera.
type managed struct {
	pub    *Publisher
	cancel context.CancelFunc // nil when not running
	done   chan struct{}      // closed when the publisher goroutine exits
}

// running reports whether this camera has a live (or still winding-down)
// publisher goroutine. It stays true from start until the goroutine's `done`
// channel actually closes — NOT merely until cancel is called — so a start that
// races a stop can never launch a SECOND goroutine on the same Publisher while
// the first is still exiting (which corrupted state and stranded the old
// goroutine's context, causing a hang). See StopCamera.
func (m *managed) running() bool {
	if m.done == nil {
		return false
	}
	select {
	case <-m.done:
		return false // goroutine has fully exited
	default:
		return true // still running or winding down
	}
}

// Supervisor owns all cameras' publishers and controls their lifecycle at
// runtime: a camera can be started or stopped individually WITHOUT disturbing
// the others (each has its own context derived from the root). It is the single
// source of truth for runtime state; readers get snapshots via States().
//
// Concurrency: `mu` guards the map and each managed entry's cancel/done. The
// root context (set in Run) bounds every camera; StopAll/root-cancel stop all.
type Supervisor struct {
	cfg   *config.Config
	log   *slog.Logger
	audit *auditRecorder
	bus   *eventBus

	mu   sync.Mutex
	root context.Context // set when Run starts; parent for per-camera contexts
	cams map[string]*managed
	order []string // stable iteration order (config order)

	// enabled is a precomputed id→enabled lookup so StartAll is O(N), not O(N²)
	// (previously isEnabled scanned cfg.Cameras for every camera). Built once at
	// construction from the config; the config's camera SET is immutable for the
	// life of a Supervisor (the GUI edits config then restarts the worker).
	enabled map[string]bool

	// startGate bounds how many cameras may be in the middle of their FIRST
	// probe+launch at once, so bringing up a large fleet (or StartAll on
	// thousands of cameras) does not spawn thousands of ffprobe processes in the
	// same instant (a startup thundering herd). nil = unbounded (small fleets).
	//
	// Note it is a startup RAMP shaper, not a steady-state limit: a publisher
	// releases its slot as soon as its first probe returns, before ffmpeg is
	// launched. It does not bound how many transcodes run at once — see `load`.
	startGate chan struct{}

	// load counts cameras currently transcoding, shared by every publisher this
	// supervisor owns, and warns once when the machine is oversubscribed.
	load transcodeLoad
}

// auditRecorder is the small subset of audit.Logger the supervisor uses; kept as
// an interface so tests can pass nil/no-op.
type auditRecorder struct{ l *audit.Logger }

func (a *auditRecorder) camera(action audit.Action, id, name string) {
	if a != nil && a.l != nil {
		a.l.Camera(action, id, name)
	}
}

// NewSupervisor builds a managed publisher for each camera in the config
// (enabled and disabled alike — disabled ones simply aren't started). Cameras
// whose config can't be resolved are recorded FAILED and never started.
func NewSupervisor(cfg *config.Config, log *slog.Logger, aud *audit.Logger) *Supervisor {
	s := &Supervisor{
		cfg:     cfg,
		log:     log,
		audit:   &auditRecorder{l: aud},
		bus:     newEventBus(),
		cams:    make(map[string]*managed, len(cfg.Cameras)),
		enabled: make(map[string]bool, len(cfg.Cameras)),
	}
	if n := cfg.MaxConcurrentStarts; n > 0 {
		s.startGate = make(chan struct{}, n)
	}
	for _, cam := range cfg.Cameras {
		id := cam.CameraID
		if id == "" {
			// Guard: every camera needs a stable key. Fall back to name+index.
			id = cam.Name
		}
		rtsp, rerr := cfg.EffectiveRTSP(&cam)
		pub, perr := cfg.EffectivePublish(&cam)
		p := New(cfg, cam, rtsp, pub, log)
		// One transcode counter for the whole fleet, so the overload warning is
		// about the machine rather than any single camera.
		p.shareTranscodeLoad(&s.load)
		// Attach group + capabilities to runtime state.
		p.State.SetMeta(cam.Group, Capabilities{
			SupportsPTZ:       cam.Capabilities.SupportsPTZ,
			SupportsAudio:     cam.Capabilities.SupportsAudio,
			SupportsRecording: cam.Capabilities.SupportsRecording,
			SupportsAI:        cam.Capabilities.SupportsAI,
		})
		// Bridge state transitions → event bus (non-blocking).
		cid, cname := id, cam.Name
		p.State.SetTransitionHook(func(_, to Status, detail string) {
			if et := eventFromStatus(to); et != "" {
				s.bus.publish(Event{Type: et, CameraID: cid, Name: cname, At: nowFn(), Detail: detail})
			}
		})
		if rerr != nil {
			p.State.setFailed("rtsp: " + rerr.Error())
			log.Error("camera config invalid; will not start", "cameraId", id, "err", rerr)
		} else if perr != nil {
			p.State.setFailed("publish: " + perr.Error())
			log.Error("camera config invalid; will not start", "cameraId", id, "err", perr)
		}
		s.cams[id] = &managed{pub: p}
		s.order = append(s.order, id)
		s.enabled[id] = cam.Enabled
	}
	return s
}

// Run sets the root context and starts every ENABLED, valid camera, then blocks
// until ctx is cancelled and all publishers have exited.
//
// Runtime state is RECONSTRUCTED from config here (Enabled flag) — the agent
// persists configuration only, never transient runtime state. A disabled camera
// stays stopped; an enabled one starts from CONNECTING.
func (s *Supervisor) Run(ctx context.Context) {
	s.log.Info("supervisor starting", "cameras", len(s.cams))

	// Hold the lock across setting root + starting the enabled cameras, so the
	// managed entries' cancel/done writes are synchronized against concurrent
	// readers (IsRunning/States/StopCamera).
	s.mu.Lock()
	s.root = ctx
	for _, cam := range s.cfg.EnabledCameras() {
		id := cam.CameraID
		if id == "" {
			id = cam.Name
		}
		s.startLocked(id, false) // startup start (not an operator action → no audit)
	}
	s.mu.Unlock()

	<-ctx.Done() // root cancelled (app quitting)
	s.stopAllInternal(true)
	s.log.Info("supervisor stopped")
}

// StartCamera starts one camera if it is not already running. Idempotent.
func (s *Supervisor) StartCamera(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.startLocked(id, true)
}

// startLocked must be called with s.mu held. `operator` gates audit logging so
// startup-time starts aren't logged as operator actions.
func (s *Supervisor) startLocked(id string, operator bool) {
	m, ok := s.cams[id]
	if !ok {
		s.log.Warn("start: unknown camera", "cameraId", id)
		return
	}
	if m.running() {
		return // idempotent
	}
	if m.pub.State.Snapshot().Status == StatusFailed {
		s.log.Warn("start: camera is FAILED (fix config)", "cameraId", id)
		return
	}
	if s.root == nil {
		s.log.Warn("start: supervisor not running yet", "cameraId", id)
		return
	}
	cctx, cancel := context.WithCancel(s.root)
	done := make(chan struct{})
	m.cancel = cancel
	m.done = done
	gate := s.startGate
	go func(p *Publisher) {
		defer close(done)
		// Startup admission control: bound how many cameras hit their FIRST probe
		// at once (avoids a thundering herd of ffprobe/ffmpeg on a large fleet).
		// The slot is held only until the first probe attempt returns — steady
		// reconnects are NOT gated, so a later mass reconnect is spread by jitter
		// instead (see Publisher backoff). Cancellation is respected while waiting.
		if gate != nil {
			select {
			case gate <- struct{}{}:
				p.releaseGateAfterFirstProbe(func() { <-gate })
				// Safety net: if Run returns before its first probe (e.g. ctx
				// cancelled at the loop top), still free the slot — release is
				// idempotent, so a normal first-probe release is unaffected.
				defer p.releaseGate()
			case <-cctx.Done():
				p.State.setStopped()
				return
			}
		}
		p.Run(cctx) // its own probe/ffmpeg/backoff loop
	}(m.pub)

	if operator {
		s.audit.camera(audit.CameraStarted, m.pub.State.CameraID, m.pub.State.Name)
		s.bus.publish(Event{Type: EventCameraStarted, CameraID: m.pub.State.CameraID, Name: m.pub.State.Name, At: nowFn()})
	}
}

// StopCamera stops one camera if running, leaving all others untouched.
// Idempotent. Blocks until that camera's publisher goroutine has exited and its
// ffmpeg child is gone (no orphaned processes).
func (s *Supervisor) StopCamera(id string) {
	s.mu.Lock()
	m, ok := s.cams[id]
	if !ok || !m.running() {
		s.mu.Unlock()
		return // unknown or already stopped — idempotent
	}
	cancel, done := m.cancel, m.done
	// Cancel THIS run now. Leave m.cancel/m.done in place so running() keeps
	// reporting true (winding down) until the goroutine actually closes `done` —
	// that's what stops a racing StartCamera from launching a second goroutine on
	// the same Publisher. Every concurrent stopper captures the SAME cancel+done,
	// so it is always safe to call cancel() (idempotent) and then wait on the
	// closed-channel broadcast; nobody can strand the goroutine by niling cancel.
	id2, name := m.pub.State.CameraID, m.pub.State.Name
	s.mu.Unlock()

	cancel() // signal only THIS camera's context (idempotent across stoppers)
	<-done   // wait for its goroutine (and thus ctx-bound ffmpeg) to exit

	// Clear the slot, but ONLY if it still points at the run we just drained — a
	// StartCamera after full exit may have installed a fresh goroutine (new
	// m.cancel/m.done) which we must not disturb.
	s.mu.Lock()
	if m.done == done {
		m.cancel = nil
		m.done = nil
	}
	s.mu.Unlock()

	s.audit.camera(audit.CameraStopped, id2, name)
	s.bus.publish(Event{Type: EventCameraStopped, CameraID: id2, Name: name, At: nowFn()})
}

// StartAll starts every enabled, valid, not-yet-running camera.
func (s *Supervisor) StartAll() {
	s.mu.Lock()
	for _, id := range s.order {
		// Only auto-start cameras marked enabled in config.
		if s.isEnabled(id) {
			s.startLocked(id, true)
		}
	}
	s.mu.Unlock()
}

// StopAll stops every running camera (operator action).
func (s *Supervisor) StopAll() { s.stopAllInternal(false) }

func (s *Supervisor) stopAllInternal(shutdown bool) {
	// Collect running ids under lock, then stop each (StopCamera re-locks).
	s.mu.Lock()
	ids := make([]string, 0, len(s.order))
	for _, id := range s.order {
		if m := s.cams[id]; m != nil && m.running() {
			ids = append(ids, id)
		}
	}
	s.mu.Unlock()
	for _, id := range ids {
		s.StopCamera(id)
	}
	if !shutdown && s.audit != nil {
		s.audit.l.Record(audit.StoppedAll, "count", len(ids))
	}
}

// isEnabled reports whether a camera is enabled in config. O(1) via the
// precomputed map (previously an O(N) scan, making StartAll O(N²)).
func (s *Supervisor) isEnabled(id string) bool { return s.enabled[id] }

// States returns a snapshot of every camera's runtime state, in config order.
// Safe to call concurrently while Run is active.
//
// Scale note: the global lock is held only long enough to copy the per-camera
// pointers (the map/order are stable for the Supervisor's life), then released
// BEFORE snapshotting each camera. Each Snapshot() takes that camera's OWN lock.
// This keeps a large States() call (thousands of cameras) from serializing
// against every StartCamera/StopCamera for the whole snapshot duration.
func (s *Supervisor) States() []StateSnapshot {
	s.mu.Lock()
	pubs := make([]*Publisher, 0, len(s.order))
	for _, id := range s.order {
		if m := s.cams[id]; m != nil {
			pubs = append(pubs, m.pub)
		}
	}
	s.mu.Unlock()

	out := make([]StateSnapshot, 0, len(pubs))
	for _, p := range pubs {
		out = append(out, p.State.Snapshot())
	}
	return out
}

// Histories returns each camera's bounded diagnostic history, keyed by camera
// ID, in stable display order. Used by the diagnostics endpoint (?history=true).
func (s *Supervisor) Histories() map[string]HistorySnapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string]HistorySnapshot, len(s.order))
	for _, id := range s.order {
		if m := s.cams[id]; m != nil {
			out[id] = m.pub.State.History()
		}
	}
	return out
}

// Events subscribes to runtime events. Returns a receive-only channel and an
// unsubscribe func. The channel is buffered; if a subscriber falls behind, the
// oldest events are dropped rather than blocking the engine (delivery never
// stalls streaming). Part of the STABLE runtime API — see runtime-api.md.
func (s *Supervisor) Events(bufSize int) (<-chan Event, func()) {
	return s.bus.subscribe(bufSize)
}

// IsRunning reports whether a camera's publisher goroutine is active.
func (s *Supervisor) IsRunning(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	m := s.cams[id]
	return m != nil && m.running()
}
