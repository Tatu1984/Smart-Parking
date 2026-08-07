package appmodel

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/sparking/edge-agent/internal/config"
)

// InterchangeVersion is the JSON export format version (independent of the
// agent's config schemaVersion). Bump MAJOR on incompatible changes.
const InterchangeVersion = "2.0"

// Export is the versioned interchange document (dashboard ⇄ agent). See
// docs/cctv/edge-config-format.md.
type Export struct {
	Version       string                `json:"version"`
	GeneratedAt   string                `json:"generatedAt"`
	AgentVersion  string                `json:"agentVersion"`
	Hostname      string                `json:"hostname"`
	Platform      string                `json:"platform"`
	CameraCount   int                   `json:"cameraCount"`
	ConfigChecksum string               `json:"configChecksum"`
	PortalBaseUrl string                `json:"portalBaseUrl,omitempty"`
	RTSPTemplate  string                `json:"rtspTemplate,omitempty"`
	Groups        []string              `json:"groups,omitempty"`
	Cameras       []config.CameraConfig `json:"cameras"`
}

// ExportMeta carries environment facts stamped into an export.
type ExportMeta struct {
	AgentVersion string
	Hostname     string
	Platform     string
	Now          time.Time
}

// ToJSON serializes the model to a versioned export with metadata.
func (m *Model) ToJSON(meta ExportMeta) ([]byte, error) {
	exp := Export{
		Version:       InterchangeVersion,
		GeneratedAt:   meta.Now.UTC().Format(time.RFC3339),
		AgentVersion:  meta.AgentVersion,
		Hostname:      meta.Hostname,
		Platform:      meta.Platform,
		CameraCount:   len(m.cfg.Cameras),
		PortalBaseUrl: m.cfg.PortalBaseUrl,
		RTSPTemplate:  m.cfg.RTSPTemplate,
		Groups:        m.cfg.Groups,
		Cameras:       m.cfg.Cameras,
	}
	exp.ConfigChecksum = checksumCameras(m.cfg.Cameras)
	return json.MarshalIndent(exp, "", "  ")
}

// ImportMode selects how an import is applied.
type ImportMode int

const (
	// Replace swaps the entire camera list with the imported one.
	Replace ImportMode = iota
	// Merge adds imported cameras that don't already exist (by cameraId);
	// existing ids are reported as conflicts and skipped.
	Merge
)

// ImportResult reports exactly what happened — imports are never partially/
// ambiguously applied without the caller seeing why.
type ImportResult struct {
	Added    int
	Replaced int
	Skipped  []ImportConflict // rows not applied, with reasons
	Warnings []string         // applied, but noteworthy (e.g. duplicate RTSP)
}

// ImportConflict is one rejected/skipped row.
type ImportConflict struct {
	CameraID string
	Reason   string
}

// ParseExport validates the interchange envelope (version, structure) before
// any application. A newer MAJOR version is refused clearly.
func ParseExport(data []byte) (*Export, error) {
	var exp Export
	if err := json.Unmarshal(data, &exp); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	if strings.TrimSpace(exp.Version) == "" {
		return nil, fmt.Errorf("missing version field")
	}
	major := majorOf(exp.Version)
	cur := majorOf(InterchangeVersion)
	if major > cur {
		return nil, fmt.Errorf("export version %s is newer than this agent supports (%s) — please update the Edge Agent", exp.Version, InterchangeVersion)
	}
	return &exp, nil
}

// ApplyImport applies a parsed export deterministically. Conflict rules:
//   - duplicate cameraId WITHIN the import  → whole import rejected (error)
//   - duplicate streamKey/publish WITHIN the import → whole import rejected
//   - missing required fields (id/token/source/target) → that row skipped+reported
//   - (Merge) cameraId already in the model → that row skipped+reported
//   - duplicate RTSP across cameras → WARN, allowed (legitimate: shared NVR)
//
// Nothing is mutated until validation passes, so the model is never left in a
// partially-applied state.
func (m *Model) ApplyImport(exp *Export, mode ImportMode) (ImportResult, error) {
	res := ImportResult{}

	// 1. Reject duplicate identities/targets WITHIN the import (hard errors).
	seenID := map[string]bool{}
	seenTarget := map[string]bool{}
	for _, cam := range exp.Cameras {
		if cam.CameraID != "" {
			if seenID[cam.CameraID] {
				return res, fmt.Errorf("import contains duplicate cameraId %q", cam.CameraID)
			}
			seenID[cam.CameraID] = true
		}
		if tgt := targetKey(cam); tgt != "" {
			if seenTarget[tgt] {
				return res, fmt.Errorf("import contains duplicate ingest target (%s)", config.Redacted(tgt))
			}
			seenTarget[tgt] = true
		}
	}

	// 2. Build the accepted set (skip invalid rows / merge conflicts), collect warnings.
	rtspSeen := map[string]bool{}
	for i := range exp.Cameras {
		rtspSeen[strings.ToLower(strings.TrimSpace(exp.Cameras[i].RTSP))] = true
	}

	var accepted []config.CameraConfig
	rtspCount := map[string]int{}
	for _, cam := range exp.Cameras {
		if reason := missingFields(cam); reason != "" {
			res.Skipped = append(res.Skipped, ImportConflict{CameraID: cam.CameraID, Reason: reason})
			continue
		}
		if mode == Merge && m.FindIndex(cam.CameraID) >= 0 {
			res.Skipped = append(res.Skipped, ImportConflict{CameraID: cam.CameraID, Reason: "already exists (merge skips existing)"})
			continue
		}
		if r := strings.ToLower(strings.TrimSpace(cam.RTSP)); r != "" {
			rtspCount[r]++
		}
		accepted = append(accepted, cam)
	}
	for r, n := range rtspCount {
		if n > 1 {
			res.Warnings = append(res.Warnings, fmt.Sprintf("%d cameras share the same RTSP URL (%s) — allowed", n, config.Redacted(r)))
		}
	}

	// 3. Apply (only now do we mutate).
	if exp.PortalBaseUrl != "" {
		m.cfg.PortalBaseUrl = exp.PortalBaseUrl
	}
	if exp.RTSPTemplate != "" {
		m.cfg.RTSPTemplate = exp.RTSPTemplate
	}
	for _, g := range exp.Groups {
		m.registerGroup(g)
	}

	switch mode {
	case Replace:
		m.cfg.Cameras = accepted
		res.Replaced = len(accepted)
	case Merge:
		m.cfg.Cameras = append(m.cfg.Cameras, accepted...)
		res.Added = len(accepted)
	}
	return res, nil
}

func missingFields(cam config.CameraConfig) string {
	if strings.TrimSpace(cam.CameraID) == "" {
		return "missing cameraId"
	}
	if strings.TrimSpace(cam.Token) == "" {
		return "missing token"
	}
	if strings.TrimSpace(cam.RTSP) == "" && cam.Channel == nil {
		return "missing source (rtsp or channel)"
	}
	if strings.TrimSpace(cam.Publish) == "" && strings.TrimSpace(cam.StreamKey) == "" {
		return "missing ingest target (publish or streamKey)"
	}
	return ""
}

func targetKey(cam config.CameraConfig) string {
	if cam.Publish != "" {
		return cam.Publish
	}
	return cam.StreamKey
}

func checksumCameras(cams []config.CameraConfig) string {
	ids := make([]string, 0, len(cams))
	for _, c := range cams {
		ids = append(ids, c.CameraID+"|"+targetKey(c))
	}
	sort.Strings(ids)
	sum := sha256.Sum256([]byte(strings.Join(ids, "\n")))
	return hex.EncodeToString(sum[:8]) // short, stable
}

func majorOf(v string) int {
	part := strings.SplitN(strings.TrimSpace(v), ".", 2)[0]
	n := 0
	for _, r := range part {
		if r < '0' || r > '9' {
			break
		}
		n = n*10 + int(r-'0')
	}
	return n
}
