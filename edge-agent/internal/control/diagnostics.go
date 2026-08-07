package control

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/sparking/edge-agent/internal/publisher"
)

// Meta is static runtime metadata the worker knows at startup and the health /
// version / diagnostics endpoints report. Passed into NewServerWithMeta so the
// control package needn't import main or reach for a clock.
type Meta struct {
	AgentVersion  string
	SchemaVersion int
	FFmpegPath    string
	FFmpegVersion string
	OS            string
	Arch          string
	Hostname      string
	StartedAt     time.Time // used to compute uptime; nowFn keeps it testable
}

// nowFn is overridable in tests (the agent otherwise has no injected clock).
var nowFn = time.Now

// Version is the payload of GET /version.
type Version struct {
	Agent         string `json:"agent"`
	SchemaVersion int    `json:"schemaVersion"`
	FFmpeg        string `json:"ffmpeg,omitempty"`
	OS            string `json:"os"`
	Arch          string `json:"arch"`
}

// CameraCounts summarises camera states for the health payload.
type CameraCounts struct {
	Total        int `json:"total"`
	Online       int `json:"online"`
	Reconnecting int `json:"reconnecting"`
	Stalled      int `json:"stalled"`
	Offline      int `json:"offline"`
	Failed       int `json:"failed"`
	Idle         int `json:"idle"`
}

// Health is the payload of GET /health — a structured, at-a-glance operational
// summary with a per-status camera breakdown.
type Health struct {
	Status        string       `json:"status"` // ok | degraded
	Agent         string       `json:"agent"`
	SchemaVersion int          `json:"schemaVersion"`
	UptimeSeconds int64        `json:"uptimeSeconds"`
	FFmpeg        string       `json:"ffmpeg,omitempty"`
	FFmpegPath    string       `json:"ffmpegPath,omitempty"`
	Hostname      string       `json:"hostname,omitempty"`
	Cameras       CameraCounts `json:"cameras"`
}

// Diagnostics is the payload of GET /diagnostics — the current state of every
// camera, plus (only when ?history=true) each camera's bounded history.
type Diagnostics struct {
	GeneratedAt string                                 `json:"generatedAt"`
	Version     Version                                `json:"version"`
	Cameras     []publisher.StateSnapshot              `json:"cameras"`
	History     map[string]publisher.HistorySnapshot   `json:"history,omitempty"`
}

func (s *Server) meta() Meta {
	if s.metaData == nil {
		return Meta{StartedAt: nowFn()}
	}
	return *s.metaData
}

func countStates(states []publisher.StateSnapshot) CameraCounts {
	c := CameraCounts{Total: len(states)}
	for _, st := range states {
		switch st.Status {
		case publisher.StatusOnline, publisher.StatusConnecting:
			c.Online++
		case publisher.StatusReconnecting:
			c.Reconnecting++
		case publisher.StatusStalled:
			c.Stalled++
		case publisher.StatusOffline:
			c.Offline++
		case publisher.StatusFailed:
			c.Failed++
		default:
			c.Idle++
		}
	}
	return c
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	m := s.meta()
	states := s.ctrl.States()
	counts := countStates(states)
	// "degraded" if any enabled camera is not healthy (failed/offline/stalled).
	status := "ok"
	if counts.Failed > 0 || counts.Offline > 0 || counts.Stalled > 0 {
		status = "degraded"
	}
	h := Health{
		Status:        status,
		Agent:         m.AgentVersion,
		SchemaVersion: m.SchemaVersion,
		UptimeSeconds: int64(nowFn().Sub(m.StartedAt).Seconds()),
		FFmpeg:        m.FFmpegVersion,
		FFmpegPath:    m.FFmpegPath,
		Hostname:      m.Hostname,
		Cameras:       counts,
	}
	writeJSON(w, h)
}

func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	m := s.meta()
	writeJSON(w, Version{
		Agent:         m.AgentVersion,
		SchemaVersion: m.SchemaVersion,
		FFmpeg:        m.FFmpegVersion,
		OS:            m.OS,
		Arch:          m.Arch,
	})
}

func (s *Server) handleDiagnostics(w http.ResponseWriter, r *http.Request) {
	m := s.meta()
	d := Diagnostics{
		GeneratedAt: nowFn().UTC().Format(time.RFC3339),
		Version: Version{
			Agent:         m.AgentVersion,
			SchemaVersion: m.SchemaVersion,
			FFmpeg:        m.FFmpegVersion,
			OS:            m.OS,
			Arch:          m.Arch,
		},
		Cameras: s.ctrl.States(),
	}
	// History is OPT-IN (?history=true) — it's larger and only needed when
	// investigating an incident. Default keeps the response light.
	if r.URL.Query().Get("history") == "true" {
		d.History = s.ctrl.Histories()
	}
	writeJSON(w, d)
}

// handleBundle streams a support diagnostics zip. It delegates to the server's
// bundleFn (wired by the worker, which owns the config + log paths). If no
// builder is wired, it 501s rather than pretending.
func (s *Server) handleBundle(w http.ResponseWriter, r *http.Request) {
	if s.bundleFn == nil {
		http.Error(w, "bundle export not available", http.StatusNotImplemented)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="sparking-diagnostics.zip"`)
	if err := s.bundleFn(w); err != nil {
		// Headers may already be sent; best-effort error.
		http.Error(w, "bundle failed", http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
