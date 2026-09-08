package config

import "testing"

func TestDefaultTokenInheritance(t *testing.T) {
	c := &Config{SchemaVersion: 1, DefaultToken: "portal-tok"}
	// camera with no token inherits the portal default
	cam := CameraConfig{CameraID: "a", Name: "A", RTSP: "rtsp://x/s", StreamKey: "k", Enabled: true}
	if got := c.EffectiveToken(&cam); got != "portal-tok" {
		t.Errorf("EffectiveToken with no cam token = %q, want portal-tok", got)
	}
	// per-camera token still wins
	cam.Token = "own-tok"
	if got := c.EffectiveToken(&cam); got != "own-tok" {
		t.Errorf("per-camera token should win, got %q", got)
	}
}

func TestValidateAcceptsPortalToken(t *testing.T) {
	// A camera with NO token is valid IF a portal DefaultToken is set.
	c := &Config{SchemaVersion: 1, PortalBaseUrl: "https://p.example.com", DefaultToken: "tok"}
	c.applyDefaults()
	c.Cameras = []CameraConfig{{CameraID: "a", Name: "A", RTSP: "rtsp://x/s", StreamKey: "k", Enabled: true}}
	if err := c.validate(); err != nil {
		t.Errorf("expected valid with portal token, got: %v", err)
	}
	// Without any token anywhere → invalid.
	c2 := &Config{SchemaVersion: 1}
	c2.applyDefaults()
	c2.Cameras = []CameraConfig{{CameraID: "a", Name: "A", RTSP: "rtsp://x/s", StreamKey: "k", Enabled: true}}
	if err := c2.validate(); err == nil {
		t.Error("expected invalid when no token anywhere")
	}
}
