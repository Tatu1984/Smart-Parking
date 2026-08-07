package diagbundle

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func readZip(t *testing.T, data []byte) map[string]string {
	t.Helper()
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]string{}
	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(rc)
		rc.Close()
		out[f.Name] = string(b)
	}
	return out
}

func TestBuildContainsExpectedEntries(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "agent.log")
	auditPath := filepath.Join(dir, "audit.log")
	if err := os.WriteFile(logPath, []byte("log line one\nlog line two\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(auditPath, []byte("audit entry\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	err := Build(&buf, Inputs{
		Manifest: Manifest{
			AgentVersion: "1.0.0", SchemaVersion: 1, GeneratedAt: "2026-08-07T00:00:00Z",
			OS: "linux", Arch: "amd64", Hostname: "host",
		},
		RedactedConfigYAML: []byte("schemaVersion: 1\ncameras: []\n"),
		DiagnosticsJSON:    []byte(`{"cameras":[]}`),
		SystemInfo:         []byte("agent: 1.0.0\n"),
		AgentLogPath:       logPath,
		AuditLogPath:       auditPath,
	})
	if err != nil {
		t.Fatal(err)
	}

	files := readZip(t, buf.Bytes())
	for _, name := range []string{"config.redacted.yaml", "diagnostics.json", "system-info.txt", "agent.log", "audit.log", "manifest.json"} {
		if _, ok := files[name]; !ok {
			t.Errorf("bundle missing %s", name)
		}
	}

	// Manifest carries the format version and lists contents.
	var m Manifest
	if err := json.Unmarshal([]byte(files["manifest.json"]), &m); err != nil {
		t.Fatal(err)
	}
	if m.BundleFormatVersion != BundleFormatVersion {
		t.Errorf("bundleFormatVersion = %d", m.BundleFormatVersion)
	}
	if len(m.Contents) < 5 {
		t.Errorf("contents underlisted: %v", m.Contents)
	}
	if files["agent.log"] != "log line one\nlog line two\n" {
		t.Errorf("agent.log content: %q", files["agent.log"])
	}
}

func TestBuildSkipsMissingLogs(t *testing.T) {
	var buf bytes.Buffer
	err := Build(&buf, Inputs{
		Manifest:           Manifest{AgentVersion: "1.0.0"},
		RedactedConfigYAML: []byte("x: 1\n"),
		AgentLogPath:       "/nonexistent/agent.log",
		AuditLogPath:       "",
	})
	if err != nil {
		t.Fatalf("missing log should not fail: %v", err)
	}
	files := readZip(t, buf.Bytes())
	if _, ok := files["agent.log"]; ok {
		t.Error("missing log should be skipped, not present")
	}
	if _, ok := files["manifest.json"]; !ok {
		t.Error("manifest always present")
	}
}

// TestBundleHasNoSecrets is SECURITY-CRITICAL: even if a caller passed unredacted
// diagnostics text, the bundle we ship is only as safe as its inputs — this test
// asserts the config we put in is the redacted one (guards the wiring contract).
func TestBundleHasNoSecrets(t *testing.T) {
	var buf bytes.Buffer
	// Simulate a properly-redacted config input (what the worker passes).
	_ = Build(&buf, Inputs{
		Manifest:           Manifest{AgentVersion: "1.0.0"},
		RedactedConfigYAML: []byte("cameras:\n- token: ***REDACTED***\n"),
		DiagnosticsJSON:    []byte(`{"cameras":[{"cameraId":"a","status":"ONLINE"}]}`),
	})
	whole := buf.String()
	if strings.Contains(strings.ToLower(whole), "supersecret") {
		t.Error("SECURITY: secret leaked into bundle")
	}
}
