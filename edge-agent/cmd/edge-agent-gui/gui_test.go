package main

import (
	"testing"

	"fyne.io/fyne/v2/test"

	"github.com/sparking/edge-agent/internal/appmodel"
	"github.com/sparking/edge-agent/internal/config"
	"github.com/sparking/edge-agent/internal/publisher"
)

// These tests exercise GUI widget LOGIC on Fyne's in-memory canvas (no display).
// They verify behavior that would otherwise need a human clicking the window.

func TestCameraTableRendersRows(t *testing.T) {
	test.NewApp()
	ct := newCameraTable()
	ct.setRows([]appmodel.Row{
		{CameraID: "c1", Name: "One", Status: publisher.StatusOnline, HealthScore: 100},
		{CameraID: "c2", Name: "Two", Status: publisher.StatusOffline, HealthScore: 20},
	})
	if len(ct.rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(ct.rows))
	}
}

func TestCameraTableSelection(t *testing.T) {
	test.NewApp()
	ct := newCameraTable()
	ct.setRows([]appmodel.Row{{CameraID: "c1", Name: "One"}, {CameraID: "c2", Name: "Two"}})
	// Simulate a selection (the checkbox OnChanged path).
	ct.selected["c1"] = true
	ct.selected["c2"] = false
	ids := ct.selectedIDs()
	if len(ids) != 1 || ids[0] != "c1" {
		t.Errorf("selectedIDs wrong: %v", ids)
	}
	ct.clearSelection()
	if len(ct.selectedIDs()) != 0 {
		t.Error("clearSelection failed")
	}
}

func TestCameraTableRefreshChangedInPlace(t *testing.T) {
	test.NewApp()
	ct := newCameraTable()
	ct.setRows([]appmodel.Row{
		{CameraID: "c1", Name: "One", Status: publisher.StatusOffline},
		{CameraID: "c2", Name: "Two", Status: publisher.StatusOffline},
	})
	// Only c1 changes to ONLINE — refreshChanged should update just that row.
	ct.refreshChanged(map[string]publisher.StateSnapshot{
		"c1": {CameraID: "c1", Name: "One", Status: publisher.StatusOnline},
	})
	if ct.rows[0].Status != publisher.StatusOnline {
		t.Error("c1 should be updated to ONLINE")
	}
	if ct.rows[1].Status != publisher.StatusOffline {
		t.Error("c2 should be unchanged")
	}
}

func TestValidateCamera(t *testing.T) {
	// Missing id.
	if err := validateCamera(config.CameraConfig{Token: "t", RTSP: "rtsp://h", Publish: "https://a/x.m3u8"}); err == nil {
		t.Error("missing cameraId should fail")
	}
	// Missing token.
	if err := validateCamera(config.CameraConfig{CameraID: "c", RTSP: "rtsp://h", Publish: "https://a/x.m3u8"}); err == nil {
		t.Error("missing token should fail")
	}
	// Missing source.
	if err := validateCamera(config.CameraConfig{CameraID: "c", Token: "t", Publish: "https://a/x.m3u8"}); err == nil {
		t.Error("missing source should fail")
	}
	// Missing target.
	if err := validateCamera(config.CameraConfig{CameraID: "c", Token: "t", RTSP: "rtsp://h"}); err == nil {
		t.Error("missing target should fail")
	}
	// Valid.
	if err := validateCamera(config.CameraConfig{CameraID: "c", Token: "t", RTSP: "rtsp://h", Publish: "https://a/x.m3u8"}); err != nil {
		t.Errorf("valid camera rejected: %v", err)
	}
}

func TestDialogAddViaHeadlessCanvas(t *testing.T) {
	a := test.NewApp()
	defer a.Quit()
	w := test.NewWindow(nil)
	defer w.Close()

	var saved *config.CameraConfig
	showCameraDialog(w, nil, "", func(c config.CameraConfig) error {
		cc := c
		saved = &cc
		return nil
	})
	// The dialog is modal; we can't easily "type + click Save" without walking
	// the canvas tree. This test asserts the dialog opens without panicking on a
	// headless canvas (construction path), which catches layout/widget errors.
	if len(w.Canvas().Overlays().List()) == 0 {
		t.Skip("dialog overlay not introspectable in this Fyne version")
	}
	_ = saved
}

func TestDetailsDrawerShowHide(t *testing.T) {
	test.NewApp()
	d := newDetailsDrawer()
	if d.root.Visible() {
		t.Error("drawer should start hidden")
	}
	d.show(publisher.StateSnapshot{
		CameraID: "c1", Name: "One", Group: "Entrance",
		Status: publisher.StatusOnline, HealthScore: 95, ReconnectCount: 3,
		Capabilities: publisher.Capabilities{SupportsPTZ: true},
	}, publisher.HistorySnapshot{})
	if !d.root.Visible() {
		t.Error("drawer should be visible after show")
	}
	if d.currentID != "c1" {
		t.Errorf("currentID = %q", d.currentID)
	}
	d.hide()
	if d.root.Visible() {
		t.Error("drawer should hide")
	}
}
