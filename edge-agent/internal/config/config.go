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
	"runtime"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// CurrentSchemaVersion is the schema this build writes and understands.
// Bump the MAJOR when a change is not backward-compatible.
const CurrentSchemaVersion = 1

// CameraCapabilities declares OPTIONAL features a camera supports. These are
// hints provided by config/portal (not auto-detected in v1) so future features
// — PTZ control, audio, recording, AI pipelines — can be represented and gated
// without changing the core data model. All default false.
type CameraCapabilities struct {
	SupportsPTZ       bool `yaml:"supportsPtz,omitempty"`
	SupportsAudio     bool `yaml:"supportsAudio,omitempty"`
	SupportsRecording bool `yaml:"supportsRecording,omitempty"`
	SupportsAI        bool `yaml:"supportsAi,omitempty"`
}

// CameraConfig is one camera the agent publishes. Each is independent: its own
// source, ingest target, token, and (optionally) transcode override.
type CameraConfig struct {
	// CameraID is a STABLE, immutable identifier (assigned by the portal, e.g.
	// its Camera.id). Logs, metrics, and future APIs key off this — never the
	// display name, which the operator may rename freely.
	CameraID string `yaml:"cameraId"`

	// Name is the human-facing label (shown in the GUI/logs). Renamable.
	Name string `yaml:"name"`

	// Group is an optional logical grouping (e.g. "Entrance", "Basement") for
	// future Start/Stop/filter/AI/recording per group. Empty = ungrouped.
	Group string `yaml:"group,omitempty"`

	// Capabilities are optional feature hints (PTZ/audio/recording/AI).
	Capabilities CameraCapabilities `yaml:"capabilities,omitempty"`

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

	// Groups is an optional list of group names (for the GUI/filtering). Cameras
	// reference a group by name; a group need not be pre-declared here.
	Groups []string `yaml:"groups,omitempty"`

	Cameras []CameraConfig `yaml:"cameras"`

	FFmpeg struct {
		Binary    string `yaml:"binary"`             // default "ffmpeg"
		Probe     string `yaml:"probe,omitempty"`    // ffprobe path; pinned at runtime after PATH resolution
		Transcode string `yaml:"transcode"`          // default global transcode: auto|copy|h264
	} `yaml:"ffmpeg"`

	Log struct {
		Level      string `yaml:"level"`                // debug | info | warn | error
		MaxSizeMB  int    `yaml:"maxSizeMB,omitempty"`  // rotate when a log exceeds this (default 5)
		MaxBackups int    `yaml:"maxBackups,omitempty"` // rotated files to keep (default 3)
	} `yaml:"log"`

	// Watchdog restarts a camera whose ffmpeg is alive but produced no output
	// within StallSeconds. Default 30, clamped to [15,120].
	Watchdog struct {
		StallSeconds int `yaml:"stallSeconds,omitempty"`
	} `yaml:"watchdog"`

	// BackoffMaxSeconds caps the per-camera reconnect backoff (default 30).
	BackoffMaxSeconds int `yaml:"backoffMaxSeconds,omitempty"`

	// BackoffJitterPct adds +/- randomization to each reconnect delay so a fleet
	// of cameras that all lost the source (or the cloud) at the same instant do
	// NOT retry in lockstep and stampede the network/ingest on recovery. Value is
	// a percentage 0–100 of the computed delay. A pointer so we can tell "unset"
	// (→ default 20) from an explicit 0 (→ jitter disabled).
	BackoffJitterPct *int `yaml:"backoffJitterPct,omitempty"`

	// MaxConcurrentStarts bounds how many cameras may be performing their first
	// probe+ffmpeg launch simultaneously. It smooths the startup burst when a
	// large fleet comes up at once (avoids a thundering herd of ffprobe/ffmpeg
	// processes). Default is a multiple of CPU count; 0 = unbounded.
	MaxConcurrentStarts int `yaml:"maxConcurrentStarts,omitempty"`

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
	// ATOMIC + DURABLE: write to a temp file, fsync it, rename over the target,
	// then fsync the directory. A crash or power loss never leaves a half-written
	// or zero-length config.yaml (which would break the worker on next start).
	//   - fsync(tmp) before rename → the data blocks are on disk before we commit.
	//   - fsync(dir) after rename → the rename itself is durable.
	// On ANY failure (notably ENOSPC — disk full) the temp file is removed and the
	// EXISTING config is left byte-for-byte intact.
	// 0600: the file holds live ingest tokens.
	tmp := path + ".tmp"
	if err := writeFileSync(tmp, data, 0o600); err != nil {
		_ = os.Remove(tmp) // never leave a partial temp behind (disk-full etc.)
		return fmt.Errorf("write config: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("commit config: %w", err)
	}
	// Best-effort dir fsync so the rename survives power loss. Not fatal if it
	// fails (some filesystems don't support it); the rename already succeeded.
	_ = fsyncDir(filepath.Dir(path))
	return nil
}

// writeFileSync writes data to path and fsyncs it before returning. Unlike
// os.WriteFile it guarantees the bytes are flushed to disk on success, and it
// surfaces a disk-full (ENOSPC) error from EITHER the write OR the fsync — some
// filesystems defer the ENOSPC to fsync/close, so checking only Write can miss
// a full disk and report a false success.
func writeFileSync(path string, data []byte, perm os.FileMode) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil { // ENOSPC often shows up HERE, not at Write
		f.Close()
		return err
	}
	return f.Close()
}

// fsyncDir fsyncs a directory so a rename/create inside it is durable.
func fsyncDir(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

// ValidateBytes is a DRY-RUN: parse + validate a candidate config WITHOUT
// touching the live file. Returns the parsed config on success, or a clear
// error. The GUI/CLI calls this before applying a change so a bad edit can never
// take down a running fleet.
func ValidateBytes(data []byte) (*Config, error) {
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

// SaveValidated marshals + validates the config (dry-run) BEFORE the atomic
// write, so an invalid config is never committed.
func SaveValidated(path string, c *Config) error {
	c.SchemaVersion = CurrentSchemaVersion
	c.LegacyCamera = nil
	c.LegacyCloud = nil
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if _, err := ValidateBytes(data); err != nil {
		return fmt.Errorf("refusing to save invalid config: %w", err)
	}
	return Save(path, c)
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
	if c.Log.MaxSizeMB <= 0 {
		c.Log.MaxSizeMB = 5
	}
	if c.Log.MaxBackups <= 0 {
		c.Log.MaxBackups = 3
	}
	// Stall window: default 30s, clamp to [15,120].
	if c.Watchdog.StallSeconds == 0 {
		c.Watchdog.StallSeconds = 30
	}
	if c.Watchdog.StallSeconds < 15 {
		c.Watchdog.StallSeconds = 15
	}
	if c.Watchdog.StallSeconds > 120 {
		c.Watchdog.StallSeconds = 120
	}
	if c.BackoffMaxSeconds <= 0 {
		c.BackoffMaxSeconds = 30
	}
	// Jitter: unset → default 20%. An explicit value is clamped to [0,100]; an
	// explicit 0 disables jitter.
	if c.BackoffJitterPct == nil {
		v := 20
		c.BackoffJitterPct = &v
	} else {
		v := *c.BackoffJitterPct
		if v < 0 {
			v = 0
		}
		if v > 100 {
			v = 100
		}
		c.BackoffJitterPct = &v
	}
	// MaxConcurrentStarts: default to a modest multiple of CPU count so a big
	// fleet ramps up quickly but not all at once. 0 stays 0 only if set
	// explicitly negative? We reserve negative as "unbounded".
	if c.MaxConcurrentStarts == 0 {
		n := runtime.NumCPU() * 8
		if n < 16 {
			n = 16
		}
		c.MaxConcurrentStarts = n
	} else if c.MaxConcurrentStarts < 0 {
		c.MaxConcurrentStarts = 0 // explicit unbounded
	}
}

// StallWindow returns the configured stall watchdog window.
func (c *Config) StallWindow() time.Duration {
	return time.Duration(c.Watchdog.StallSeconds) * time.Second
}

// BackoffMax returns the configured max reconnect backoff.
func (c *Config) BackoffMax() time.Duration {
	return time.Duration(c.BackoffMaxSeconds) * time.Second
}

// BackoffJitter returns the configured jitter fraction (0.0–1.0) applied to
// reconnect delays. Unset is treated as the 20% default.
func (c *Config) BackoffJitter() float64 {
	if c.BackoffJitterPct == nil {
		return 0.20
	}
	return float64(*c.BackoffJitterPct) / 100.0
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

		// A token is required to authenticate to the ingest endpoint.
		if strings.TrimSpace(cam.Token) == "" {
			return fmt.Errorf("camera %q: token is required", label)
		}

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
