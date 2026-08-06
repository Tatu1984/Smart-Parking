// Package config loads and validates the Edge Agent's YAML config — the only
// file an on-site operator (or the GUI) edits. See docs/cctv/edge-config-format.md.
//
// The config is VERSIONED (schemaVersion). A version-aware loader migrates older
// or unversioned configs — including the original single-camera layout — into
// the current multi-camera schema, so existing installs never break on upgrade.
package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// CurrentSchemaVersion is the schema this build writes and understands.
// Bump the MAJOR when a change is not backward-compatible.
const CurrentSchemaVersion = 1

// CameraConfig is one camera the agent publishes. Each is independent: its own
// source, ingest target, token, and (optionally) transcode override.
type CameraConfig struct {
	// CameraID is a STABLE, immutable identifier (assigned by the portal, e.g.
	// its Camera.id). Logs, metrics, and future APIs key off this — never the
	// display name, which the operator may rename freely.
	CameraID string `yaml:"cameraId"`

	// Name is the human-facing label (shown in the GUI/logs). Renamable.
	Name string `yaml:"name"`

	// Source: either a full RTSP URL, OR channel/subtype used with the global
	// RTSP template (rtspTemplate) for NVR-style cameras. RTSP wins if set.
	RTSP    string `yaml:"rtsp,omitempty"`
	Channel *int   `yaml:"channel,omitempty"`
	Subtype *int   `yaml:"subtype,omitempty"`

	// Ingest target. StreamKey is authoritative (the portal owns it); Publish is
	// the full ingest URL. Either may be supplied — Publish wins if set,
	// otherwise it is built from the global portalBaseUrl + StreamKey.
	StreamKey string `yaml:"streamKey,omitempty"`
	Publish   string `yaml:"publish,omitempty"`

	// Token is the per-camera ingest Bearer token from the portal.
	Token string `yaml:"token"`

	// Transcode override for this camera (auto|copy|h264). Empty = use global.
	Transcode string `yaml:"transcode,omitempty"`

	// Enabled cameras are published; disabled ones are skipped (kept in config).
	Enabled bool `yaml:"enabled"`
}

// Config is the full agent configuration (multi-camera, versioned).
type Config struct {
	SchemaVersion int    `yaml:"schemaVersion"`
	AgentID       string `yaml:"agentId,omitempty"` // human label for this agent (not authenticated in v1)

	// PortalBaseUrl is used to build a camera's ingest URL from its StreamKey
	// when the camera does not carry a full Publish URL.
	PortalBaseUrl string `yaml:"portalBaseUrl,omitempty"`

	// RTSPTemplate builds a camera's RTSP URL from channel/subtype. It supports
	// {channel} and {subtype} placeholders, e.g.
	//   rtsp://user:pass@192.168.1.185:554/cam/realmonitor?channel={channel}&subtype={subtype}
	RTSPTemplate string `yaml:"rtspTemplate,omitempty"`

	Cameras []CameraConfig `yaml:"cameras"`

	FFmpeg struct {
		Binary    string `yaml:"binary"`             // default "ffmpeg"
		Probe     string `yaml:"probe,omitempty"`    // ffprobe path; pinned at runtime after PATH resolution
		Transcode string `yaml:"transcode"`          // default global transcode: auto|copy|h264
	} `yaml:"ffmpeg"`

	Log struct {
		Level string `yaml:"level"` // debug | info | warn | error
	} `yaml:"log"`

	// ---- Legacy single-camera fields (schema v0) ----
	// Retained ONLY so an old config still parses; migrate() folds them into
	// Cameras and then they are ignored. Not written by this build.
	LegacyCamera *struct {
		Name string `yaml:"name"`
		RTSP string `yaml:"rtsp"`
	} `yaml:"camera,omitempty"`
	LegacyCloud *struct {
		Publish string `yaml:"publish"`
		Token   string `yaml:"token"`
	} `yaml:"cloud,omitempty"`
}

// Load reads, parses, migrates, defaults, and validates the config at path.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	var c Config
	if err := yaml.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	if err := c.migrate(); err != nil {
		return nil, err
	}
	c.applyDefaults()
	if err := c.validate(); err != nil {
		return nil, err
	}
	return &c, nil
}

// migrate upgrades an older/unversioned config to CurrentSchemaVersion.
//
//   - schemaVersion 0/absent with a legacy camera:/cloud: block → fold into a
//     one-element Cameras list (the original single-camera layout keeps working).
//   - a NEWER major version than this build understands → refuse clearly rather
//     than silently mis-parse.
func (c *Config) migrate() error {
	if c.SchemaVersion > CurrentSchemaVersion {
		return fmt.Errorf(
			"config schemaVersion %d is newer than this agent supports (%d) — please update the Edge Agent",
			c.SchemaVersion, CurrentSchemaVersion)
	}

	// v0 (or unversioned): if a legacy single-camera block is present and no
	// cameras list was given, convert it.
	if len(c.Cameras) == 0 && (c.LegacyCamera != nil || c.LegacyCloud != nil) {
		cam := CameraConfig{Enabled: true}
		if c.LegacyCamera != nil {
			cam.Name = c.LegacyCamera.Name
			cam.RTSP = c.LegacyCamera.RTSP
		}
		if c.LegacyCloud != nil {
			cam.Publish = c.LegacyCloud.Publish
			cam.Token = c.LegacyCloud.Token
		}
		// No stable id in a legacy config; derive a placeholder so downstream
		// code (logs/metrics) always has a non-empty CameraID.
		if cam.CameraID == "" {
			cam.CameraID = "legacy-1"
		}
		c.Cameras = []CameraConfig{cam}
	}

	c.LegacyCamera = nil
	c.LegacyCloud = nil
	c.SchemaVersion = CurrentSchemaVersion
	return nil
}

// Save writes the config to path (0600 — it contains ingest tokens), creating
// parent directories as needed. Used by the GUI. Always stamps the current
// schema version and never writes the legacy fields.
func Save(path string, c *Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	c.SchemaVersion = CurrentSchemaVersion
	c.LegacyCamera = nil
	c.LegacyCloud = nil
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	// 0600: the file holds live ingest tokens.
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
	c := &Config{SchemaVersion: CurrentSchemaVersion}
	c.applyDefaults()
	return c
}

func (c *Config) applyDefaults() {
	if c.SchemaVersion == 0 {
		c.SchemaVersion = CurrentSchemaVersion
	}
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
	if len(c.EnabledCameras()) == 0 {
		return fmt.Errorf("no enabled cameras configured")
	}
	seen := map[string]bool{}
	for i := range c.Cameras {
		cam := &c.Cameras[i]
		if !cam.Enabled {
			continue
		}
		label := cam.label(i)

		// Resolve the effective RTSP + publish so validation matches runtime.
		rtsp, err := c.EffectiveRTSP(cam)
		if err != nil {
			return fmt.Errorf("camera %q: %w", label, err)
		}
		if strings.TrimSpace(rtsp) == "" {
			return fmt.Errorf("camera %q: rtsp (or channel/subtype + rtspTemplate) is required", label)
		}

		pub, err := c.EffectivePublish(cam)
		if err != nil {
			return fmt.Errorf("camera %q: %w", label, err)
		}
		u, perr := url.Parse(pub)
		if perr != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return fmt.Errorf("camera %q: publish must be an http(s) URL", label)
		}
		if !strings.HasSuffix(u.Path, ".m3u8") {
			return fmt.Errorf("camera %q: publish should end in .../index.m3u8", label)
		}

		if t := c.EffectiveTranscode(cam); t != "auto" && t != "copy" && t != "h264" {
			return fmt.Errorf("camera %q: transcode must be auto|copy|h264 (got %q)", label, t)
		}

		// Duplicate stream key/publish would mean two cameras clobbering one path.
		key := pub
		if seen[key] {
			return fmt.Errorf("camera %q: duplicate ingest target %q", label, config_redact(key))
		}
		seen[key] = true
	}
	return nil
}

// EnabledCameras returns only the cameras that should be published.
func (c *Config) EnabledCameras() []CameraConfig {
	out := make([]CameraConfig, 0, len(c.Cameras))
	for _, cam := range c.Cameras {
		if cam.Enabled {
			out = append(out, cam)
		}
	}
	return out
}

// EffectiveRTSP returns the camera's RTSP URL: an explicit rtsp wins, otherwise
// it is built from the global rtspTemplate + channel/subtype.
func (c *Config) EffectiveRTSP(cam *CameraConfig) (string, error) {
	if strings.TrimSpace(cam.RTSP) != "" {
		return cam.RTSP, nil
	}
	if cam.Channel == nil {
		return "", nil // no rtsp and no channel → caller reports "required"
	}
	if strings.TrimSpace(c.RTSPTemplate) == "" {
		return "", fmt.Errorf("channel set but no rtspTemplate configured")
	}
	sub := 0
	if cam.Subtype != nil {
		sub = *cam.Subtype
	}
	out := c.RTSPTemplate
	out = strings.ReplaceAll(out, "{channel}", itoa(*cam.Channel))
	out = strings.ReplaceAll(out, "{subtype}", itoa(sub))
	return out, nil
}

// EffectivePublish returns the camera's full ingest URL: an explicit publish
// wins, otherwise it is built from portalBaseUrl + streamKey.
func (c *Config) EffectivePublish(cam *CameraConfig) (string, error) {
	if strings.TrimSpace(cam.Publish) != "" {
		return cam.Publish, nil
	}
	if strings.TrimSpace(cam.StreamKey) == "" {
		return "", fmt.Errorf("publish or streamKey is required")
	}
	if strings.TrimSpace(c.PortalBaseUrl) == "" {
		return "", fmt.Errorf("streamKey set but no portalBaseUrl configured")
	}
	base := strings.TrimRight(c.PortalBaseUrl, "/")
	return fmt.Sprintf("%s/api/edge/ingest/%s/index.m3u8", base, url.PathEscape(cam.StreamKey)), nil
}

// EffectiveTranscode returns the camera override or the global default.
func (c *Config) EffectiveTranscode(cam *CameraConfig) string {
	if cam.Transcode != "" {
		return cam.Transcode
	}
	return c.FFmpeg.Transcode
}

func (cam *CameraConfig) label(i int) string {
	if cam.Name != "" {
		return cam.Name
	}
	if cam.CameraID != "" {
		return cam.CameraID
	}
	return fmt.Sprintf("camera[%d]", i)
}

// FFprobeBinary returns the ffprobe path that pairs with the configured ffmpeg
// binary (see the detailed rationale below).
func (c *Config) FFprobeBinary() string {
	if c.FFmpeg.Probe != "" {
		return c.FFmpeg.Probe
	}
	bin := c.FFmpeg.Binary
	if bin == "" || bin == "ffmpeg" || bin == "ffmpeg.exe" {
		return "ffprobe"
	}
	idx := strings.LastIndexAny(bin, `/\`)
	if idx < 0 {
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
	u.User = nil
	if q := u.Query(); q.Get("token") != "" {
		q.Set("token", "***")
		u.RawQuery = q.Encode()
	}
	out := u.String()
	if hadUser {
		out = strings.Replace(out, "//", "//***:***@", 1)
	}
	return out
}

// config_redact is a small internal alias so validate() can redact without
// exporting anything new.
func config_redact(raw string) string { return Redacted(raw) }

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
