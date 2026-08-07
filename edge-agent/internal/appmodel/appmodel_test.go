package appmodel

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/sparking/edge-agent/internal/config"
)

func cam(id, name string) config.CameraConfig {
	return config.CameraConfig{
		CameraID: id, Name: name,
		RTSP:    "rtsp://h/" + id,
		Publish: "https://app/api/edge/ingest/" + id + "/index.m3u8",
		Token:   "tok-" + id, Enabled: true,
	}
}

func TestAddUpdateDeleteEnable(t *testing.T) {
	m := New(nil)
	if err := m.Add(cam("c1", "One")); err != nil {
		t.Fatal(err)
	}
	if err := m.Add(cam("c1", "dup")); err == nil {
		t.Error("duplicate cameraId should be rejected")
	}
	c := cam("c1", "One-renamed")
	if err := m.Update(c); err != nil {
		t.Fatal(err)
	}
	if m.Cameras()[0].Name != "One-renamed" {
		t.Error("update failed")
	}
	m.SetEnabled("c1", false)
	if m.Cameras()[0].Enabled {
		t.Error("disable failed")
	}
	m.Delete("c1")
	if len(m.Cameras()) != 0 {
		t.Error("delete failed")
	}
}

func TestBulkOps(t *testing.T) {
	m := New(nil)
	for _, id := range []string{"a", "b", "c"} {
		_ = m.Add(cam(id, id))
	}
	m.SetEnabledBulk([]string{"a", "c"}, false)
	got := map[string]bool{}
	for _, c := range m.Cameras() {
		got[c.CameraID] = c.Enabled
	}
	if got["a"] || got["c"] || !got["b"] {
		t.Errorf("bulk disable wrong: %v", got)
	}
	m.DeleteBulk([]string{"a", "b"})
	if len(m.Cameras()) != 1 || m.Cameras()[0].CameraID != "c" {
		t.Errorf("bulk delete wrong: %+v", m.Cameras())
	}
}

func TestExportRoundTrip(t *testing.T) {
	m := New(nil)
	_ = m.Add(cam("c1", "One"))
	data, err := m.ToJSON(ExportMeta{AgentVersion: "1.2.3", Hostname: "box", Platform: "linux", Now: time.Unix(0, 0)})
	if err != nil {
		t.Fatal(err)
	}
	exp, err := ParseExport(data)
	if err != nil {
		t.Fatal(err)
	}
	if exp.Version != InterchangeVersion || exp.CameraCount != 1 || exp.AgentVersion != "1.2.3" {
		t.Errorf("export metadata wrong: %+v", exp)
	}
	if exp.ConfigChecksum == "" {
		t.Error("missing checksum")
	}
}

func TestParseRejectsNewerVersion(t *testing.T) {
	_, err := ParseExport([]byte(`{"version":"99.0","cameras":[]}`))
	if err == nil {
		t.Error("newer major version must be rejected")
	}
}

func TestImportReplace(t *testing.T) {
	m := New(nil)
	_ = m.Add(cam("old", "Old"))
	exp := &Export{Version: InterchangeVersion, Cameras: []config.CameraConfig{cam("n1", "N1"), cam("n2", "N2")}}
	res, err := m.ApplyImport(exp, Replace)
	if err != nil {
		t.Fatal(err)
	}
	if res.Replaced != 2 || len(m.Cameras()) != 2 {
		t.Errorf("replace wrong: res=%+v cams=%d", res, len(m.Cameras()))
	}
	if m.FindIndex("old") >= 0 {
		t.Error("replace should have removed the old camera")
	}
}

func TestImportMergeSkipsExisting(t *testing.T) {
	m := New(nil)
	_ = m.Add(cam("c1", "keep"))
	exp := &Export{Version: InterchangeVersion, Cameras: []config.CameraConfig{cam("c1", "dupe"), cam("c2", "new")}}
	res, err := m.ApplyImport(exp, Merge)
	if err != nil {
		t.Fatal(err)
	}
	if res.Added != 1 || len(res.Skipped) != 1 || res.Skipped[0].CameraID != "c1" {
		t.Errorf("merge conflict handling wrong: %+v", res)
	}
	if len(m.Cameras()) != 2 {
		t.Errorf("expected 2 cameras after merge, got %d", len(m.Cameras()))
	}
}

func TestImportRejectsDuplicateIdWithinFile(t *testing.T) {
	m := New(nil)
	exp := &Export{Version: InterchangeVersion, Cameras: []config.CameraConfig{cam("x", "1"), cam("x", "2")}}
	if _, err := m.ApplyImport(exp, Replace); err == nil {
		t.Error("duplicate cameraId within import must be a hard error")
	}
	// Model must be untouched (nothing partially applied).
	if len(m.Cameras()) != 0 {
		t.Error("failed import must not mutate the model")
	}
}

func TestImportRejectsDuplicateTargetWithinFile(t *testing.T) {
	m := New(nil)
	a := cam("a", "A")
	b := cam("b", "B")
	b.Publish = a.Publish // same ingest target
	exp := &Export{Version: InterchangeVersion, Cameras: []config.CameraConfig{a, b}}
	if _, err := m.ApplyImport(exp, Replace); err == nil {
		t.Error("duplicate ingest target within import must be a hard error")
	}
}

func TestImportSkipsMissingFields_WarnsDuplicateRTSP(t *testing.T) {
	m := New(nil)
	good1 := cam("g1", "G1")
	good2 := cam("g2", "G2")
	good2.RTSP = good1.RTSP // duplicate RTSP → allowed, warned
	bad := config.CameraConfig{CameraID: "bad", Enabled: true} // missing token/source/target
	exp := &Export{Version: InterchangeVersion, Cameras: []config.CameraConfig{good1, good2, bad}}
	res, err := m.ApplyImport(exp, Replace)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Skipped) != 1 || res.Skipped[0].CameraID != "bad" {
		t.Errorf("bad row should be skipped+reported: %+v", res.Skipped)
	}
	if len(res.Warnings) != 1 {
		t.Errorf("duplicate RTSP should warn (not reject): %+v", res.Warnings)
	}
	if len(m.Cameras()) != 2 {
		t.Errorf("2 good cameras should be applied, got %d", len(m.Cameras()))
	}
}

func TestBackupRotationKeepsLast5(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	m := New(nil)
	_ = m.Add(cam("c1", "One"))

	// Save 8 times with increasing stamps → only 5 newest backups kept.
	for i := 1; i <= 8; i++ {
		stamp := time.Date(2026, 1, 1, 0, 0, i, 0, time.UTC).Format("20060102-150405")
		if err := m.Save(path, stamp); err != nil {
			t.Fatal(err)
		}
	}
	baks := Backups(path)
	if len(baks) != maxBackups {
		t.Errorf("expected %d backups, got %d", maxBackups, len(baks))
	}
	// Restore the newest backup and confirm it loads.
	if len(baks) > 0 {
		rm, err := Restore(baks[0])
		if err != nil {
			t.Fatalf("restore: %v", err)
		}
		if len(rm.Cameras()) != 1 {
			t.Error("restored model wrong")
		}
	}
	// The live config must exist.
	if _, err := os.Stat(path); err != nil {
		t.Error("live config missing after saves")
	}
}
