// Package config loads and validates the Edge Agent's YAML config — the only
// file an on-site operator edits. See docs/cctv/edge-agent.md.
package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config is the full agent configuration.
type Config struct {
	// CameraID is informational (which SParking camera this agent feeds).
	CameraID string `yaml:"cameraId"`

	Camera struct {
		Name string `yaml:"name"`
		// Source RTSP URL (may embed credentials). The camera on the LAN.
		RTSP string `yaml:"rtsp"`
	} `yaml:"camera"`

	Cloud struct {
		// HLS ingest endpoint the agent PUTs to, ending in .../index.m3u8.
		// e.g. https://app.example.com/api/edge/ingest/<streamKey>/index.m3u8
		Publish string `yaml:"publish"`
		// Per-camera Bearer token issued by POST /api/cameras/{id}/ingest-token.
		Token string `yaml:"token"`
	} `yaml:"cloud"`

	FFmpeg struct {
		Binary string `yaml:"binary"` // default "ffmpeg"
		// Probe is the ffprobe path; pinned at runtime after PATH resolution.
		// Not usually set by the operator (derived from Binary when empty).
		Probe string `yaml:"probe,omitempty"`
		// transcode: auto | copy | h264. auto = copy H.264, transcode H.265→H.264.
		Transcode string `yaml:"transcode"`
	} `yaml:"ffmpeg"`

	Log struct {
		Level string `yaml:"level"` // debug | info | warn | error
	} `yaml:"log"`
}

// Load reads, parses, defaults, and validates the config at path.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	var c Config
	if err := yaml.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	c.applyDefaults()
	if err := c.validate(); err != nil {
		return nil, err
	}
	return &c, nil
}

// Save writes the config to path (0600 — it contains an ingest token), creating
// parent directories as needed. Used by the GUI.
func Save(path string, c *Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	// 0600: the file holds a live ingest token.
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	return nil
}

// LoadOrDefault returns the config at path, or a defaulted empty config when the
// file does not exist yet (first GUI launch).
func LoadOrDefault(path string) *Config {
	if c, err := Load(path); err == nil {
		return c
	}
	c := &Config{}
	c.applyDefaults()
	return c
}

func (c *Config) applyDefaults() {
	if c.FFmpeg.Binary == "" {
		c.FFmpeg.Binary = "ffmpeg"
	}
	if c.FFmpeg.Transcode == "" {
		c.FFmpeg.Transcode = "auto"
	}
	if c.Log.Level == "" {
		c.Log.Level = "info"
	}
}

func (c *Config) validate() error {
	if strings.TrimSpace(c.Camera.RTSP) == "" {
		return fmt.Errorf("camera.rtsp is required")
	}
	if strings.TrimSpace(c.Cloud.Publish) == "" {
		return fmt.Errorf("cloud.publish is required")
	}
	u, err := url.Parse(c.Cloud.Publish)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return fmt.Errorf("cloud.publish must be an http(s) URL")
	}
	if !strings.HasSuffix(u.Path, ".m3u8") {
		return fmt.Errorf("cloud.publish should end in .../index.m3u8")
	}
	switch c.FFmpeg.Transcode {
	case "auto", "copy", "h264":
	default:
		return fmt.Errorf("ffmpeg.transcode must be auto|copy|h264 (got %q)", c.FFmpeg.Transcode)
	}
	return nil
}

// FFprobeBinary returns the ffprobe path that pairs with the configured ffmpeg
// binary. ffprobe always ships alongside ffmpeg, so when ffmpeg is an absolute
// path (a bundled copy, or a custom install) we look for ffprobe in the SAME
// directory; otherwise we fall back to resolving "ffprobe" on PATH.
//
// Without this, pointing ffmpeg.binary at a bundled ffmpeg would still leave
// ffprobe unresolvable.
func (c *Config) FFprobeBinary() string {
	// A path pinned at runtime (after PATH resolution) wins.
	if c.FFmpeg.Probe != "" {
		return c.FFmpeg.Probe
	}
	bin := c.FFmpeg.Binary
	if bin == "" || bin == "ffmpeg" || bin == "ffmpeg.exe" {
		return "ffprobe"
	}

	// Split on BOTH separators: a config written on Windows may be read by a
	// build running elsewhere, and filepath.Dir only understands the host's.
	idx := strings.LastIndexAny(bin, `/\`)
	if idx < 0 {
		// A bare command name (e.g. "ffmpeg7") — resolve ffprobe on PATH.
		return "ffprobe"
	}
	dir, sep := bin[:idx], bin[idx:idx+1]

	name := "ffprobe"
	if strings.HasSuffix(strings.ToLower(bin), ".exe") {
		name = "ffprobe.exe"
	}
	return dir + sep + name
}

// Redacted returns a URL safe for logs (credentials/token masked). The mask is
// kept human-readable (***:***) rather than URL-encoded.
func Redacted(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "<unparseable-url>"
	}
	hadUser := u.User != nil
	u.User = nil // drop credentials from the structured URL
	// Strip any token query param if present.
	if q := u.Query(); q.Get("token") != "" {
		q.Set("token", "***")
		u.RawQuery = q.Encode()
	}
	out := u.String()
	if hadUser {
		// Re-insert a readable mask after the scheme separator.
		out = strings.Replace(out, "//", "//***:***@", 1)
	}
	return out
}
