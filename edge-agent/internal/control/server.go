// Package control is the local IPC between the GUI (control panel) and the
// background streaming worker. Because they are separate processes, the GUI
// reaches the worker's Supervisor through a small HTTP API bound STRICTLY to
// 127.0.0.1 and protected by a per-run token.
//
// The API maps 1:1 onto the stable Supervisor API (see docs/cctv/runtime-api.md):
//   GET  /states                 → []StateSnapshot
//   GET  /events (SSE)           → runtime events
//   POST /camera/{id}/start
//   POST /camera/{id}/stop
//   POST /start-all
//   POST /stop-all
package control

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strings"

	"github.com/sparking/edge-agent/internal/publisher"
)

// Controller is the subset of *publisher.Supervisor the API needs (an interface
// so it can be faked in tests).
type Controller interface {
	States() []publisher.StateSnapshot
	Histories() map[string]publisher.HistorySnapshot
	StartCamera(id string)
	StopCamera(id string)
	StartAll()
	StopAll()
	Events(bufSize int) (<-chan publisher.Event, func())
}

// Server exposes a Controller over local HTTP.
type Server struct {
	ctrl     Controller
	token    string
	ln       net.Listener
	srv      *http.Server
	metaData *Meta // static runtime metadata for health/version/diagnostics

	// bundleFn writes a support diagnostics zip to w. Wired by the worker (which
	// owns the config + log paths). nil → /diagnostics/bundle returns 501.
	bundleFn func(w io.Writer) error

	// closed is cancelled on Close so in-flight SSE handlers exit promptly
	// (otherwise Close would block on a GUI holding an open events stream).
	closed chan struct{}
}

// NewServer binds to 127.0.0.1:<port> (port 0 = OS-assigned). token guards every
// request. Returns the server; call Addr() for the chosen address.
func NewServer(ctrl Controller, token string, port int) (*Server, error) {
	return NewServerWithMeta(ctrl, token, port, nil)
}

// NewServerWithMeta is NewServer plus static runtime metadata reported by the
// health/version/diagnostics endpoints.
func NewServerWithMeta(ctrl Controller, token string, port int, meta *Meta) (*Server, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:"+itoa(port))
	if err != nil {
		return nil, err
	}
	s := &Server{ctrl: ctrl, token: token, ln: ln, metaData: meta, closed: make(chan struct{})}
	mux := http.NewServeMux()
	mux.HandleFunc("/states", s.auth(s.handleStates))
	mux.HandleFunc("/streams", s.auth(s.handleStreams))
	mux.HandleFunc("/events", s.auth(s.handleEvents))
	mux.HandleFunc("/health", s.auth(s.handleHealth))
	mux.HandleFunc("/version", s.auth(s.handleVersion))
	mux.HandleFunc("/diagnostics", s.auth(s.handleDiagnostics))
	mux.HandleFunc("/diagnostics/bundle", s.auth(s.handleBundle))
	mux.HandleFunc("/start-all", s.auth(s.post(func() { s.ctrl.StartAll() })))
	mux.HandleFunc("/stop-all", s.auth(s.post(func() { s.ctrl.StopAll() })))
	mux.HandleFunc("/camera/", s.auth(s.handleCamera))
	s.srv = &http.Server{Handler: mux}
	return s, nil
}

// SetBundleFunc wires the diagnostics-bundle builder. Call before Serve. fn
// writes a zip to w; it MUST redact secrets (see diagbundle + config.Redacted).
func (s *Server) SetBundleFunc(fn func(w io.Writer) error) { s.bundleFn = fn }

// Serve blocks serving requests until Close.
func (s *Server) Serve() error { return s.srv.Serve(s.ln) }

// Addr returns the bound address (host:port).
func (s *Server) Addr() string { return s.ln.Addr().String() }

// Close stops the server and signals in-flight SSE handlers to exit.
func (s *Server) Close() error {
	select {
	case <-s.closed:
	default:
		close(s.closed)
	}
	return s.srv.Close()
}

func (s *Server) auth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Defense in depth: the listener is localhost-only, but still require the
		// token so other LOCAL users/processes can't drive streaming.
		if r.Header.Get("Authorization") != "Bearer "+s.token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		h(w, r)
	}
}

func (s *Server) post(fn func()) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		fn()
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleStates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(s.ctrl.States())
}

func (s *Server) handleCamera(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// /camera/{id}/start | stop
	rest := strings.TrimPrefix(r.URL.Path, "/camera/")
	parts := strings.SplitN(rest, "/", 2)
	if len(parts) != 2 {
		http.Error(w, "bad path", http.StatusBadRequest)
		return
	}
	id, action := parts[0], parts[1]
	switch action {
	case "start":
		s.ctrl.StartCamera(id)
	case "stop":
		s.ctrl.StopCamera(id)
	default:
		http.Error(w, "unknown action", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleEvents streams runtime events as Server-Sent Events.
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Flush headers immediately so the client's HTTP round-trip returns without
	// waiting for the first event (otherwise: SSE header deadlock).
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	evs, unsub := s.ctrl.Events(128)
	defer unsub()
	enc := json.NewEncoder(w)
	for {
		select {
		case <-r.Context().Done():
			return
		case <-s.closed:
			return
		case ev, ok := <-evs:
			if !ok {
				return
			}
			if _, err := w.Write([]byte("data: ")); err != nil {
				return
			}
			if err := enc.Encode(ev); err != nil {
				return
			}
			if _, err := w.Write([]byte("\n")); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
