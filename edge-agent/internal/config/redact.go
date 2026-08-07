package config

import (
	"net/url"
	"strings"

	"gopkg.in/yaml.v3"
)

// redactedMark replaces any removed secret so a reader sees the field WAS set
// (useful for support) without exposing the value.
const redactedMark = "***REDACTED***"

// Redacted returns a deep copy of the config with every secret masked, safe to
// include in a diagnostics bundle or share for support. It removes:
//   - per-camera ingest Token
//   - per-camera StreamKey (grants ingest)
//   - credentials embedded in RTSP / Publish URLs (rtsp://user:pass@host)
//   - credentials embedded in the global RTSPTemplate
//
// Redaction is conservative: when in doubt a field is masked. The copy is
// independent — the live config is never mutated.
func (c *Config) Redacted() *Config {
	// Deep-copy via a YAML round-trip so nested slices/pointers are independent.
	data, err := yaml.Marshal(c)
	if err != nil {
		return c // extremely unlikely; never return the ORIGINAL for editing
	}
	var out Config
	if err := yaml.Unmarshal(data, &out); err != nil {
		return c
	}

	out.RTSPTemplate = redactURLCreds(out.RTSPTemplate)
	for i := range out.Cameras {
		cam := &out.Cameras[i]
		if strings.TrimSpace(cam.Token) != "" {
			cam.Token = redactedMark
		}
		if strings.TrimSpace(cam.StreamKey) != "" {
			cam.StreamKey = redactedMark
		}
		cam.RTSP = redactURLCreds(cam.RTSP)
		cam.Publish = redactURLCreds(cam.Publish)
	}
	if out.LegacyCloud != nil && strings.TrimSpace(out.LegacyCloud.Token) != "" {
		out.LegacyCloud.Token = redactedMark
	}
	if out.LegacyCloud != nil {
		out.LegacyCloud.Publish = redactURLCreds(out.LegacyCloud.Publish)
	}
	if out.LegacyCamera != nil {
		out.LegacyCamera.RTSP = redactURLCreds(out.LegacyCamera.RTSP)
	}
	return &out
}

// RedactedYAML returns the redacted config marshalled to YAML.
func (c *Config) RedactedYAML() ([]byte, error) {
	return yaml.Marshal(c.Redacted())
}

// redactURLCreds masks userinfo (user:pass@) in a URL while keeping host/path so
// the target is still identifiable. Non-URL strings are returned unchanged
// except that a bare "user:pass@host"-looking template still gets masked.
func redactURLCreds(raw string) string {
	if raw == "" {
		return raw
	}
	if u, err := url.Parse(raw); err == nil && u.User != nil {
		u.User = url.User(redactedMark)
		return u.String()
	}
	// Fallback for template strings url.Parse won't treat as having userinfo
	// (e.g. contains {channel}); mask an "…://user:pass@" prefix textually.
	if i := strings.Index(raw, "://"); i >= 0 {
		rest := raw[i+3:]
		if at := strings.Index(rest, "@"); at >= 0 {
			// Only if the userinfo segment has no path slash before the '@'.
			if slash := strings.Index(rest, "/"); slash == -1 || at < slash {
				return raw[:i+3] + redactedMark + "@" + rest[at+1:]
			}
		}
	}
	return raw
}
