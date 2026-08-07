// Package diagbundle builds a support diagnostics bundle: a single zip containing
// the tail of the operational and audit logs, a REDACTED copy of the config, a
// current diagnostics snapshot, system info, and a manifest. It NEVER includes
// secrets — the config is redacted by the caller and this package does no other
// I/O that could pull in a token.
package diagbundle

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// BundleFormatVersion identifies the on-disk layout so a future reader can adapt.
const BundleFormatVersion = 1

// tailBytes is how much of each log to include (last N bytes). Keeps bundles
// small while retaining recent context.
const tailBytes = 256 * 1024 // 256 KB

// Manifest describes the bundle. It carries NO secrets.
type Manifest struct {
	BundleFormatVersion int    `json:"bundleFormatVersion"`
	AgentVersion        string `json:"agentVersion"`
	SchemaVersion       int    `json:"schemaVersion"`
	GeneratedAt         string `json:"generatedAt"` // RFC3339, supplied by caller (no clock here)
	OS                  string `json:"os"`
	Arch                string `json:"arch"`
	Hostname            string `json:"hostname"`
	Contents            []string `json:"contents"`
}

// Inputs are everything needed to build a bundle. The caller is responsible for
// redacting RedactedConfigYAML and DiagnosticsJSON before passing them.
type Inputs struct {
	Manifest            Manifest
	RedactedConfigYAML  []byte // MUST already be redacted
	DiagnosticsJSON     []byte // /diagnostics snapshot (no secrets in state)
	SystemInfo          []byte // freeform text: os/arch/uptime/ffmpeg, etc.
	AgentLogPath        string // tailed; missing file is skipped, not fatal
	AuditLogPath        string // tailed; missing file is skipped, not fatal
}

// Build writes a zip bundle to w. Missing log files are skipped (recorded in the
// manifest's Contents only when included). Returns an error only on write
// failure — never on a missing optional input.
func Build(w io.Writer, in Inputs) error {
	zw := zip.NewWriter(w)

	contents := []string{}
	add := func(name string, data []byte) error {
		f, err := zw.Create(name)
		if err != nil {
			return err
		}
		if _, err := f.Write(data); err != nil {
			return err
		}
		contents = append(contents, name)
		return nil
	}

	if len(in.RedactedConfigYAML) > 0 {
		if err := add("config.redacted.yaml", in.RedactedConfigYAML); err != nil {
			return err
		}
	}
	if len(in.DiagnosticsJSON) > 0 {
		if err := add("diagnostics.json", in.DiagnosticsJSON); err != nil {
			return err
		}
	}
	if len(in.SystemInfo) > 0 {
		if err := add("system-info.txt", in.SystemInfo); err != nil {
			return err
		}
	}
	if tail, ok := tailFile(in.AgentLogPath); ok {
		if err := add("agent.log", tail); err != nil {
			return err
		}
	}
	if tail, ok := tailFile(in.AuditLogPath); ok {
		if err := add("audit.log", tail); err != nil {
			return err
		}
	}

	// Manifest last so Contents reflects what was actually added.
	m := in.Manifest
	m.BundleFormatVersion = BundleFormatVersion
	m.Contents = contents
	mj, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	mf, err := zw.Create("manifest.json")
	if err != nil {
		return err
	}
	if _, err := mf.Write(mj); err != nil {
		return err
	}

	return zw.Close()
}

// tailFile returns the last tailBytes of path. ok is false if the file can't be
// read (missing/permission) — a missing log is not an error for a bundle.
func tailFile(path string) ([]byte, bool) {
	if path == "" {
		return nil, false
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, false
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil {
		return nil, false
	}
	size := fi.Size()
	if size == 0 {
		return nil, false
	}
	var buf bytes.Buffer
	if size > tailBytes {
		if _, err := f.Seek(size-tailBytes, io.SeekStart); err != nil {
			return nil, false
		}
		// Note that this file was truncated to the tail.
		fmt.Fprintf(&buf, "[... truncated to last %d KB ...]\n", tailBytes/1024)
	}
	if _, err := io.Copy(&buf, f); err != nil {
		return nil, false
	}
	return buf.Bytes(), true
}
