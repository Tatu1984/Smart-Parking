package main

import (
	"fmt"
	"strconv"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"github.com/sparking/edge-agent/internal/config"
)

// showCameraDialog opens the add/edit form. `existing` is nil for Add. `template`
// is the global RTSP template (for the template mode preview). onSave receives
// the built CameraConfig; the caller persists it.
func showCameraDialog(w fyne.Window, existing *config.CameraConfig, template string, onSave func(config.CameraConfig) error) {
	editing := existing != nil
	cam := config.CameraConfig{Enabled: true}
	if editing {
		cam = *existing
	}

	id := widget.NewEntry()
	id.SetText(cam.CameraID)
	if editing {
		id.Disable() // cameraId is immutable once set
	}
	name := widget.NewEntry()
	name.SetText(cam.Name)
	group := widget.NewEntry()
	group.SetText(cam.Group)

	// --- source: Full URL vs Template(channel/subtype) ---
	rtsp := widget.NewEntry()
	rtsp.SetText(cam.RTSP)
	channel := widget.NewEntry()
	subtype := widget.NewEntry()
	if cam.Channel != nil {
		channel.SetText(strconv.Itoa(*cam.Channel))
	}
	if cam.Subtype != nil {
		subtype.SetText(strconv.Itoa(*cam.Subtype))
	}
	preview := widget.NewLabel("")
	preview.Wrapping = fyne.TextWrapWord

	sourceMode := widget.NewRadioGroup([]string{"Full RTSP URL", "Template + channel/subtype"}, nil)
	if cam.Channel != nil && cam.RTSP == "" {
		sourceMode.SetSelected("Template + channel/subtype")
	} else {
		sourceMode.SetSelected("Full RTSP URL")
	}

	streamKey := widget.NewEntry()
	streamKey.SetText(cam.StreamKey)
	publish := widget.NewEntry()
	publish.SetText(cam.Publish)
	token := widget.NewPasswordEntry()
	token.SetText(cam.Token)
	transcode := widget.NewSelect([]string{"", "auto", "copy", "h264"}, nil)
	transcode.SetSelected(cam.Transcode)
	enabled := widget.NewCheck("Enabled", nil)
	enabled.SetChecked(cam.Enabled)

	updatePreview := func() {
		if sourceMode.Selected == "Full RTSP URL" {
			preview.SetText("Source: " + config.Redacted(strings.TrimSpace(rtsp.Text)))
			return
		}
		ch, _ := strconv.Atoi(strings.TrimSpace(channel.Text))
		sub, _ := strconv.Atoi(strings.TrimSpace(subtype.Text))
		if template == "" {
			preview.SetText("⚠ No global RTSP template set — configure it first, or use Full URL.")
			return
		}
		built := strings.ReplaceAll(template, "{channel}", strconv.Itoa(ch))
		built = strings.ReplaceAll(built, "{subtype}", strconv.Itoa(sub))
		preview.SetText("Preview: " + config.Redacted(built))
	}
	rtsp.OnChanged = func(string) { updatePreview() }
	channel.OnChanged = func(string) { updatePreview() }
	subtype.OnChanged = func(string) { updatePreview() }
	sourceMode.OnChanged = func(string) { updatePreview() }
	updatePreview()

	form := widget.NewForm(
		widget.NewFormItem("Camera ID", id),
		widget.NewFormItem("Name", name),
		widget.NewFormItem("Group", group),
		widget.NewFormItem("Source", sourceMode),
		widget.NewFormItem("Full RTSP URL", rtsp),
		widget.NewFormItem("Channel", channel),
		widget.NewFormItem("Subtype", subtype),
		widget.NewFormItem("Preview", preview),
		widget.NewFormItem("Stream key", streamKey),
		widget.NewFormItem("Portal publish URL", publish),
		widget.NewFormItem("Ingest token", token),
		widget.NewFormItem("Video mode", transcode),
		widget.NewFormItem("", enabled),
	)

	content := container.NewVScroll(form)
	content.SetMinSize(fyne.NewSize(520, 460))

	titleText := "Add camera"
	if editing {
		titleText = "Edit camera"
	}
	d := dialog.NewCustomConfirm(titleText, "Save", "Cancel", content, func(ok bool) {
		if !ok {
			return
		}
		out := config.CameraConfig{
			CameraID:  strings.TrimSpace(id.Text),
			Name:      strings.TrimSpace(name.Text),
			Group:     strings.TrimSpace(group.Text),
			StreamKey: strings.TrimSpace(streamKey.Text),
			Publish:   strings.TrimSpace(publish.Text),
			Token:     strings.TrimSpace(token.Text),
			Transcode: transcode.Selected,
			Enabled:   enabled.Checked,
			// preserve capabilities from the existing camera
			Capabilities: cam.Capabilities,
		}
		if sourceMode.Selected == "Full RTSP URL" {
			out.RTSP = strings.TrimSpace(rtsp.Text)
		} else {
			if v, err := strconv.Atoi(strings.TrimSpace(channel.Text)); err == nil {
				out.Channel = &v
			}
			if v, err := strconv.Atoi(strings.TrimSpace(subtype.Text)); err == nil {
				out.Subtype = &v
			}
		}
		if err := validateCamera(out); err != nil {
			dialog.ShowError(err, w)
			return
		}
		if err := onSave(out); err != nil {
			dialog.ShowError(err, w)
		}
	}, w)
	d.Resize(fyne.NewSize(560, 560))
	d.Show()
}

// validateCamera checks the operator's input before save.
func validateCamera(c config.CameraConfig) error {
	if c.CameraID == "" {
		return fmt.Errorf("Camera ID is required")
	}
	if c.Token == "" {
		return fmt.Errorf("Ingest token is required")
	}
	if strings.TrimSpace(c.RTSP) == "" && c.Channel == nil {
		return fmt.Errorf("provide a Full RTSP URL, or a Channel (with the global template)")
	}
	if strings.TrimSpace(c.Publish) == "" && strings.TrimSpace(c.StreamKey) == "" {
		return fmt.Errorf("provide a Portal publish URL or a Stream key")
	}
	return nil
}
