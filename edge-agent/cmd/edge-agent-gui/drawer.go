package main

import (
	"fmt"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"github.com/sparking/edge-agent/internal/publisher"
)

// detailsDrawer is the per-camera side panel. It is built as a stack of labelled
// SECTIONS so future sections (Recording, AI, PTZ) can be added without
// redesigning the layout — each section is an accordion item that can start
// hidden/empty.
type detailsDrawer struct {
	root       *fyne.Container
	title      *widget.Label
	info       *widget.Form
	connection *widget.Form
	metrics    *widget.Form
	health     *widget.Label
	events     *widget.Label

	// Placeholder sections for future capabilities (hidden until relevant).
	recording *widget.Label
	ai        *widget.Label
	ptz       *widget.Label
	acc       *widget.Accordion

	currentID string
	onEdit    func(cameraID string)
	onDelete  func(cameraID string)
}

func newDetailsDrawer() *detailsDrawer {
	d := &detailsDrawer{
		title:      widget.NewLabelWithStyle("Select a camera", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		info:       widget.NewForm(),
		connection: widget.NewForm(),
		metrics:    widget.NewForm(),
		health:     widget.NewLabel(""),
		events:     widget.NewLabel(""),
		recording:  widget.NewLabel("Not available"),
		ai:         widget.NewLabel("Not available"),
		ptz:        widget.NewLabel("Not available"),
	}
	d.events.Wrapping = fyne.TextWrapWord

	d.acc = widget.NewAccordion(
		widget.NewAccordionItem("Camera Information", d.info),
		widget.NewAccordionItem("Connection", d.connection),
		widget.NewAccordionItem("Runtime Metrics", d.metrics),
		widget.NewAccordionItem("Health", d.health),
		widget.NewAccordionItem("Recent Events", d.events),
		// Future sections — present but collapsed/empty so adding real content
		// later needs no layout change.
		widget.NewAccordionItem("Recording (future)", d.recording),
		widget.NewAccordionItem("AI Analytics (future)", d.ai),
		widget.NewAccordionItem("PTZ Controls (future)", d.ptz),
	)
	d.acc.Open(0)
	d.acc.Open(2)
	d.acc.Open(3)

	editBtn := widget.NewButtonWithIcon("Edit", theme.DocumentCreateIcon(), func() {
		if d.currentID != "" && d.onEdit != nil {
			d.onEdit(d.currentID)
		}
	})
	delBtn := widget.NewButtonWithIcon("Delete", theme.DeleteIcon(), func() {
		if d.currentID != "" && d.onDelete != nil {
			d.onDelete(d.currentID)
		}
	})
	actions := container.NewHBox(editBtn, delBtn)

	top := container.NewVBox(d.title, actions)
	d.root = container.NewBorder(top, nil, nil, nil, container.NewVScroll(d.acc))
	d.root.Hide()
	return d
}

// show populates the drawer from a camera's snapshot + history.
func (d *detailsDrawer) show(s publisher.StateSnapshot, hist publisher.HistorySnapshot) {
	d.currentID = s.CameraID
	d.title.SetText(s.Name)

	d.info.Items = nil
	d.info.Append("Camera ID", widget.NewLabel(s.CameraID))
	d.info.Append("Name", widget.NewLabel(s.Name))
	d.info.Append("Group", widget.NewLabel(orDash(s.Group)))
	d.info.Append("Capabilities", widget.NewLabel(capsString(s.Capabilities)))
	d.info.Refresh()

	d.connection.Items = nil
	d.connection.Append("Status", widget.NewLabel(string(s.Status)))
	d.connection.Append("Codec", widget.NewLabel(orDash(s.VideoCodec)))
	d.connection.Append("Resolution", widget.NewLabel(orDash(s.Resolution)))
	d.connection.Append("Last error", widget.NewLabel(orDash(s.LastError)))
	d.connection.Refresh()

	d.metrics.Items = nil
	d.metrics.Append("Reconnects", widget.NewLabel(fmt.Sprintf("%d", s.ReconnectCount)))
	d.metrics.Append("Last seen", widget.NewLabel(relTime(s.LastSeenAt)))
	d.metrics.Append("FPS", widget.NewLabel(orZeroF(s.FPS)))
	d.metrics.Append("Bitrate", widget.NewLabel(orZero(s.BitrateKbps, "kbps")))
	d.metrics.Refresh()

	d.health.SetText(fmt.Sprintf("Health score: %d / 100", s.HealthScore))

	d.events.SetText(formatEvents(hist))

	d.recording.SetText(capOrNA(s.Capabilities.SupportsRecording, "Supported (not yet implemented)"))
	d.ai.SetText(capOrNA(s.Capabilities.SupportsAI, "Supported (not yet implemented)"))
	d.ptz.SetText(capOrNA(s.Capabilities.SupportsPTZ, "Supported (not yet implemented)"))

	d.root.Show()
}

func (d *detailsDrawer) hide() { d.root.Hide() }

// --- formatting helpers ---

func orDash(s string) string {
	if s == "" {
		return "—"
	}
	return s
}
func orZero(n int, unit string) string {
	if n == 0 {
		return "—"
	}
	return fmt.Sprintf("%d %s", n, unit)
}
func orZeroF(f float64) string {
	if f == 0 {
		return "—"
	}
	return fmt.Sprintf("%.1f", f)
}
func relTime(t time.Time) string {
	if t.IsZero() {
		return "never"
	}
	d := time.Since(t)
	if d < time.Minute {
		return fmt.Sprintf("%ds ago", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	}
	return t.Format("15:04:05")
}
func capsString(c publisher.Capabilities) string {
	out := ""
	add := func(ok bool, name string) {
		if ok {
			if out != "" {
				out += ", "
			}
			out += name
		}
	}
	add(c.SupportsPTZ, "PTZ")
	add(c.SupportsAudio, "Audio")
	add(c.SupportsRecording, "Recording")
	add(c.SupportsAI, "AI")
	if out == "" {
		return "—"
	}
	return out
}
func capOrNA(ok bool, yes string) string {
	if ok {
		return yes
	}
	return "Not available"
}
func formatEvents(h publisher.HistorySnapshot) string {
	if len(h.Transitions) == 0 {
		return "No recent activity."
	}
	out := ""
	// newest first
	for i := len(h.Transitions) - 1; i >= 0; i-- {
		t := h.Transitions[i]
		out += fmt.Sprintf("%s  %s → %s  %s\n", t.At.Format("15:04:05"), t.From, t.To, t.Detail)
	}
	return out
}
