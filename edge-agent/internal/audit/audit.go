// Package audit records operator + lifecycle actions to a structured,
// append-only audit log — separate from the operational log — for
// troubleshooting and operational review.
//
// Actions: camera add/edit/delete, camera start/stop, config import/export,
// template change, etc. Each entry is one structured line (slog) with the
// action, the affected cameraId (when applicable), and a timestamp.
package audit

import (
	"io"
	"log/slog"
	"os"
	"sync"
)

// Action is a well-known audit action name (kept as constants so call sites and
// log consumers agree on the vocabulary).
type Action string

const (
	CameraAdded    Action = "camera.added"
	CameraEdited   Action = "camera.edited"
	CameraDeleted  Action = "camera.deleted"
	CameraEnabled  Action = "camera.enabled"
	CameraDisabled Action = "camera.disabled"
	CameraStarted  Action = "camera.started"
	CameraStopped  Action = "camera.stopped"
	StartedAll     Action = "cameras.started_all"
	StoppedAll     Action = "cameras.stopped_all"
	ConfigImported Action = "config.imported"
	ConfigExported Action = "config.exported"
	ConfigSaved    Action = "config.saved"
	ConfigRestored Action = "config.restored"
	TemplateChanged Action = "template.changed"
)

// Logger writes audit entries. It is safe for concurrent use.
type Logger struct {
	mu  sync.Mutex
	log *slog.Logger
}

// New builds an audit Logger writing to w (text, one line per entry). Pass a
// file opened O_APPEND for a persistent audit trail; io.Discard to disable.
func New(w io.Writer) *Logger {
	if w == nil {
		w = io.Discard
	}
	return &Logger{
		log: slog.New(slog.NewTextHandler(w, &slog.HandlerOptions{Level: slog.LevelInfo})),
	}
}

// Open returns an audit Logger appending to the file at path (0600). On error it
// falls back to a no-op logger so auditing never blocks the agent.
func Open(path string) (*Logger, io.Closer) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return New(io.Discard), io.NopCloser(nil)
	}
	return New(f), f
}

// OpenRotating returns an audit Logger writing to a size-rotated file. w must be
// a rotating writer (e.g. rotatelog.Writer); the caller owns closing it.
func OpenRotating(w io.WriteCloser) (*Logger, io.Closer) {
	if w == nil {
		return New(io.Discard), io.NopCloser(nil)
	}
	return New(w), w
}

// Record writes one audit entry. kv are additional key/value context pairs.
func (l *Logger) Record(action Action, kv ...any) {
	if l == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.log.Info("audit", append([]any{"action", string(action)}, kv...)...)
}

// Camera is a convenience for camera-scoped actions.
func (l *Logger) Camera(action Action, cameraID, name string, kv ...any) {
	l.Record(action, append([]any{"cameraId", cameraID, "camera", name}, kv...)...)
}
