package config

import (
	"strings"
	"testing"
)

// TestRedactedRemovesAllSecrets is SECURITY-CRITICAL: a diagnostics bundle must
// never leak a token, stream key, or embedded URL credential.
func TestRedactedRemovesAllSecrets(t *testing.T) {
	c := &Config{
		SchemaVersion: 1,
		RTSPTemplate:  "rtsp://admin:SuperSecret1@192.168.1.10:554/cam?channel={channel}&subtype={subtype}",
		Cameras: []CameraConfig{
			{
				CameraID:  "cam-1",
				Name:      "Front",
				RTSP:      "rtsp://user:hunter2@10.0.0.5:554/stream1",
				Publish:   "https://ingest:pw@portal.example.com/api/edge/ingest/streamkeyXYZ/index.m3u8",
				StreamKey: "STREAMKEY-abc123",
				Token:     "TOKEN-verysecret-987",
				Enabled:   true,
			},
		},
	}

	out, err := c.RedactedYAML()
	if err != nil {
		t.Fatal(err)
	}
	s := string(out)

	// Every secret literal must be gone.
	for _, secret := range []string{
		"SuperSecret1", "hunter2", "STREAMKEY-abc123", "TOKEN-verysecret-987",
		"ingest:pw", "admin:SuperSecret1", "user:hunter2",
	} {
		if strings.Contains(s, secret) {
			t.Errorf("SECURITY: redacted config still contains secret %q\n%s", secret, s)
		}
	}

	// The redaction marker must be present (so support sees fields WERE set).
	if !strings.Contains(s, redactedMark) {
		t.Errorf("expected redaction marker in output:\n%s", s)
	}

	// Non-secret host/path context should survive for diagnosability.
	if !strings.Contains(s, "192.168.1.10") || !strings.Contains(s, "portal.example.com") {
		t.Errorf("host context should be preserved:\n%s", s)
	}

	// The original config must NOT be mutated.
	if c.Cameras[0].Token != "TOKEN-verysecret-987" {
		t.Errorf("Redacted mutated the live config token")
	}
	if c.Cameras[0].RTSP != "rtsp://user:hunter2@10.0.0.5:554/stream1" {
		t.Errorf("Redacted mutated the live config RTSP")
	}
}

func TestRedactURLCredsKeepsHostAndPath(t *testing.T) {
	got := redactURLCreds("rtsp://bob:pass@host:554/path?x=1")
	if strings.Contains(got, "bob") || strings.Contains(got, "pass") {
		t.Errorf("creds leaked: %s", got)
	}
	if !strings.Contains(got, "host:554/path") {
		t.Errorf("host/path lost: %s", got)
	}
	// No-userinfo URL is unchanged.
	if got := redactURLCreds("rtsp://host:554/path"); got != "rtsp://host:554/path" {
		t.Errorf("unexpected change: %s", got)
	}
	// Empty stays empty.
	if got := redactURLCreds(""); got != "" {
		t.Errorf("empty changed: %q", got)
	}
}
