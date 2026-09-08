package control

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/sparking/edge-agent/internal/publisher"
)

// fakeController records calls and serves canned states/events.
type fakeController struct {
	mu       sync.Mutex
	started  []string
	stopped  []string
	startAll int
	stopAll  int
	evCh     chan publisher.Event
}

func newFake() *fakeController { return &fakeController{evCh: make(chan publisher.Event, 16)} }

func (f *fakeController) States() []publisher.StateSnapshot {
	return []publisher.StateSnapshot{{CameraID: "cam-1", Name: "One", Status: publisher.StatusOnline, HealthScore: 100}}
}
func (f *fakeController) Histories() map[string]publisher.HistorySnapshot {
	return map[string]publisher.HistorySnapshot{"cam-1": {}}
}
func (f *fakeController) StartCamera(id string) { f.mu.Lock(); f.started = append(f.started, id); f.mu.Unlock() }
func (f *fakeController) StopCamera(id string)  { f.mu.Lock(); f.stopped = append(f.stopped, id); f.mu.Unlock() }
func (f *fakeController) StartAll()             { f.mu.Lock(); f.startAll++; f.mu.Unlock() }
func (f *fakeController) StopAll()              { f.mu.Lock(); f.stopAll++; f.mu.Unlock() }
func (f *fakeController) Events(buf int) (<-chan publisher.Event, func()) {
	return f.evCh, func() {}
}

func startTestServer(t *testing.T) (*fakeController, *Client, func()) {
	t.Helper()
	f := newFake()
	token := NewToken()
	srv, err := NewServer(f, token, 0)
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = srv.Serve() }()
	c := NewClient(srv.Addr(), token)
	// wait until reachable
	for i := 0; i < 50; i++ {
		if c.Ping() {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	return f, c, func() { srv.Close() }
}

func TestControlStatesAndCommands(t *testing.T) {
	f, c, stop := startTestServer(t)
	defer stop()

	states, err := c.States()
	if err != nil || len(states) != 1 || states[0].CameraID != "cam-1" {
		t.Fatalf("states: %v %+v", err, states)
	}
	if err := c.StartCamera("cam-1"); err != nil {
		t.Fatal(err)
	}
	if err := c.StopCamera("cam-2"); err != nil {
		t.Fatal(err)
	}
	if err := c.StartAll(); err != nil {
		t.Fatal(err)
	}
	if err := c.StopAll(); err != nil {
		t.Fatal(err)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.started) != 1 || f.started[0] != "cam-1" {
		t.Errorf("start not forwarded: %v", f.started)
	}
	if len(f.stopped) != 1 || f.stopped[0] != "cam-2" {
		t.Errorf("stop not forwarded: %v", f.stopped)
	}
	if f.startAll != 1 || f.stopAll != 1 {
		t.Errorf("all-controls not forwarded: %d %d", f.startAll, f.stopAll)
	}
}

func TestControlRejectsBadToken(t *testing.T) {
	_, c, stop := startTestServer(t)
	defer stop()
	bad := NewClient(c.base, "wrong-token")
	if _, err := bad.States(); err == nil {
		t.Error("bad token must be rejected")
	}
}

func TestControlEventsStream(t *testing.T) {
	f, c, stop := startTestServer(t)
	defer stop()

	got := make(chan publisher.Event, 4)
	stopEv, err := c.Events(func(ev publisher.Event) {
		select {
		case got <- ev:
		default:
		}
	})
	if err != nil {
		t.Fatal(err)
	}

	// Give the SSE handler a moment to subscribe, then emit an event.
	time.Sleep(150 * time.Millisecond)
	f.evCh <- publisher.Event{Type: publisher.EventCameraOnline, CameraID: "cam-1"}

	select {
	case ev := <-got:
		if ev.Type != publisher.EventCameraOnline || ev.CameraID != "cam-1" {
			t.Errorf("unexpected event: %+v", ev)
		}
	case <-time.After(3 * time.Second):
		stopEv()
		t.Fatal("no event received over SSE")
	}
	// Tear down the stream BEFORE the server so nothing blocks on shutdown.
	stopEv()
}

// mixedFake reports several cameras in different states for health/diagnostics.
type mixedFake struct{ fakeController }

func (m *mixedFake) States() []publisher.StateSnapshot {
	return []publisher.StateSnapshot{
		{CameraID: "a", Status: publisher.StatusOnline},
		{CameraID: "b", Status: publisher.StatusReconnecting},
		{CameraID: "c", Status: publisher.StatusStalled},
		{CameraID: "d", Status: publisher.StatusOffline},
	}
}
func (m *mixedFake) Histories() map[string]publisher.HistorySnapshot {
	return map[string]publisher.HistorySnapshot{"a": {}, "b": {}, "c": {}, "d": {}}
}

func TestStreamsEndpoint(t *testing.T) {
	c, stop := startMetaServer(t)
	defer stop()
	sl, err := c.Streams()
	if err != nil {
		t.Fatal(err)
	}
	if len(sl.Streams) != 4 {
		t.Fatalf("streams = %d, want 4", len(sl.Streams))
	}
	if sl.Agent != "1.2.3" || sl.Hostname != "test-host" {
		t.Errorf("stream list meta: %+v", sl)
	}
	// available must be true only for the ONLINE camera ("a").
	byID := map[string]Stream{}
	for _, s := range sl.Streams {
		byID[s.CameraID] = s
	}
	if !byID["a"].Available {
		t.Error("ONLINE camera 'a' should be available")
	}
	for _, id := range []string{"b", "c", "d"} {
		if byID[id].Available {
			t.Errorf("non-ONLINE camera %q must not be marked available", id)
		}
	}
}

// TestStreamsCarriesNoSecretFields is a structural guard: the Stream type must
// never gain an RTSP/credential/token/streamKey field. If someone adds one, the
// JSON will contain it and this test fails, flagging a portal-facing leak.
func TestStreamsCarriesNoSecretFields(t *testing.T) {
	// Structural guard: the Stream type must never gain an RTSP/credential/token/
	// streamKey/publish field. Marshalling a fully-populated Stream and scanning
	// its JSON keys fails loudly if a secret-bearing field is ever added.
	b, _ := json.Marshal(Stream{
		CameraID: "x", Name: "y", Group: "g", Status: "ONLINE", Available: true,
		HealthScore: 100, VideoCodec: "h264", Resolution: "1920x1080",
		ReconnectCount: 1, LastSeen: "2026-01-01T00:00:00Z",
	})
	s := strings.ToLower(string(b))
	for _, banned := range []string{"rtsp", "password", "token", "streamkey", "publish", "user:", "secret", "credential"} {
		if strings.Contains(s, banned) {
			t.Errorf("SECURITY: Stream JSON exposes %q — portal-facing payload must carry no secrets: %s", banned, b)
		}
	}
}

func startMetaServer(t *testing.T) (*Client, func()) {
	t.Helper()
	f := &mixedFake{fakeController{evCh: make(chan publisher.Event, 4)}}
	token := NewToken()
	meta := &Meta{AgentVersion: "1.2.3", SchemaVersion: 1, FFmpegVersion: "6.0", FFmpegPath: "/usr/bin/ffmpeg", OS: "linux", Arch: "amd64", Hostname: "test-host", StartedAt: time.Now().Add(-30 * time.Second)}
	srv, err := NewServerWithMeta(f, token, 0, meta)
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = srv.Serve() }()
	c := NewClient(srv.Addr(), token)
	for i := 0; i < 50; i++ {
		if c.Ping() {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	return c, func() { srv.Close() }
}

func TestHealthEndpoint(t *testing.T) {
	c, stop := startMetaServer(t)
	defer stop()
	h, err := c.Health()
	if err != nil {
		t.Fatal(err)
	}
	if h.Status != "degraded" {
		t.Errorf("status = %q, want degraded (offline+stalled present)", h.Status)
	}
	if h.Agent != "1.2.3" || h.SchemaVersion != 1 {
		t.Errorf("version fields: %+v", h)
	}
	if h.UptimeSeconds < 30 {
		t.Errorf("uptime = %d, want >=30", h.UptimeSeconds)
	}
	if h.Cameras.Total != 4 || h.Cameras.Online != 1 || h.Cameras.Reconnecting != 1 || h.Cameras.Stalled != 1 || h.Cameras.Offline != 1 {
		t.Errorf("camera counts: %+v", h.Cameras)
	}
}

func TestVersionEndpoint(t *testing.T) {
	c, stop := startMetaServer(t)
	defer stop()
	v, err := c.Version()
	if err != nil {
		t.Fatal(err)
	}
	if v.Agent != "1.2.3" || v.SchemaVersion != 1 || v.FFmpeg != "6.0" || v.OS != "linux" || v.Arch != "amd64" {
		t.Errorf("version: %+v", v)
	}
}

func TestDiagnosticsHistoryOptIn(t *testing.T) {
	c, stop := startMetaServer(t)
	defer stop()

	// Default: no history.
	d, err := c.Diagnostics(false)
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Cameras) != 4 {
		t.Errorf("cameras = %d, want 4", len(d.Cameras))
	}
	if d.History != nil {
		t.Errorf("history should be omitted by default, got %v", d.History)
	}

	// Opt-in: history present.
	d2, err := c.Diagnostics(true)
	if err != nil {
		t.Fatal(err)
	}
	if len(d2.History) != 4 {
		t.Errorf("history = %d entries, want 4", len(d2.History))
	}
}

func TestBundleEndpoint(t *testing.T) {
	f := &mixedFake{fakeController{evCh: make(chan publisher.Event, 4)}}
	token := NewToken()
	srv, err := NewServerWithMeta(f, token, 0, &Meta{AgentVersion: "1.0.0"})
	if err != nil {
		t.Fatal(err)
	}
	// Wire a bundle func that writes some bytes (contract test: endpoint streams
	// whatever the builder produces; redaction is tested in diagbundle/config).
	srv.SetBundleFunc(func(w io.Writer) error {
		_, err := w.Write([]byte("PK-fake-zip-bytes"))
		return err
	})
	go func() { _ = srv.Serve() }()
	defer srv.Close()
	c := NewClient(srv.Addr(), token)
	for i := 0; i < 50 && !c.Ping(); i++ {
		time.Sleep(10 * time.Millisecond)
	}

	var buf bytes.Buffer
	if err := c.DownloadBundle(&buf); err != nil {
		t.Fatal(err)
	}
	if buf.String() != "PK-fake-zip-bytes" {
		t.Errorf("bundle body: %q", buf.String())
	}
}

func TestBundleEndpointUnavailableWithoutFunc(t *testing.T) {
	c, stop := startMetaServer(t) // startMetaServer wires no bundle func
	defer stop()
	if err := c.DownloadBundle(&bytes.Buffer{}); err == nil {
		t.Error("expected error (501) when no bundle func is wired")
	}
}

func TestEndpointFileRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/control.json"
	ep := Endpoint{Addr: "127.0.0.1:1234", Token: "ctl_abc"}
	if err := WriteEndpoint(path, ep); err != nil {
		t.Fatal(err)
	}
	got, err := ReadEndpoint(path)
	if err != nil || got != ep {
		t.Errorf("round-trip: %v %+v", err, got)
	}
	RemoveEndpoint(path)
	if _, err := ReadEndpoint(path); err == nil {
		t.Error("endpoint should be gone after remove")
	}
}
