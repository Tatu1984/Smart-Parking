package main

import (
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"github.com/sparking/edge-agent/internal/appmodel"
	"github.com/sparking/edge-agent/internal/publisher"
)

// cameraTable renders the camera list. It binds to a slice of display rows
// (already filtered+sorted by the caller) and supports multi-select. It updates
// only CHANGED rows on refresh (row-diff) rather than rebuilding, so it stays
// responsive with 100–200 cameras.
type cameraTable struct {
	list     *widget.List
	rows     []appmodel.Row // current display rows (filtered+sorted)
	selected map[string]bool

	onSelect      func(cameraID string)      // row tapped → show details
	onToggle      func(cameraID string, sel bool) // checkbox toggled
	onStartStop   func(cameraID string, start bool)
}

func newCameraTable() *cameraTable {
	ct := &cameraTable{selected: map[string]bool{}}
	ct.list = widget.NewList(
		func() int { return len(ct.rows) },
		func() fyne.CanvasObject { return newRowTemplate() },
		func(i widget.ListItemID, o fyne.CanvasObject) {
			if i < 0 || i >= len(ct.rows) {
				return
			}
			ct.bindRow(o.(*rowWidget), ct.rows[i])
		},
	)
	ct.list.OnSelected = func(id widget.ListItemID) {
		if id >= 0 && id < len(ct.rows) && ct.onSelect != nil {
			ct.onSelect(ct.rows[id].CameraID)
		}
	}
	return ct
}

// setRows replaces the display rows and refreshes.
func (ct *cameraTable) setRows(rows []appmodel.Row) {
	ct.rows = rows
	ct.list.Refresh()
}

// refreshChanged repaints only the rows whose cameraId appears in changed.
// (Fyne's List reuses item widgets; refreshing the whole list is cheap because
// only visible items re-bind, but we still avoid a full data rebuild by only
// swapping the changed snapshots in place.)
func (ct *cameraTable) refreshChanged(changed map[string]publisher.StateSnapshot) {
	for i := range ct.rows {
		if s, ok := changed[ct.rows[i].CameraID]; ok {
			ct.rows[i] = s
		}
	}
	ct.list.Refresh()
}

// selectedIDs returns the checked camera ids.
func (ct *cameraTable) selectedIDs() []string {
	out := make([]string, 0, len(ct.selected))
	for id, ok := range ct.selected {
		if ok {
			out = append(out, id)
		}
	}
	return out
}

func (ct *cameraTable) clearSelection() {
	ct.selected = map[string]bool{}
	ct.list.Refresh()
}

func (ct *cameraTable) object() fyne.CanvasObject { return ct.list }

func (ct *cameraTable) bindRow(rw *rowWidget, s appmodel.Row) {
	rw.check.OnChanged = nil
	rw.check.SetChecked(ct.selected[s.CameraID])
	rw.check.OnChanged = func(b bool) {
		ct.selected[s.CameraID] = b
		if ct.onToggle != nil {
			ct.onToggle(s.CameraID, b)
		}
	}
	rw.name.SetText(s.Name)
	rw.group.SetText(orDash(s.Group))
	rw.status.SetText(string(s.Status))
	rw.dot.FillColor = statusColor(s.Status)
	rw.dot.Refresh()
	rw.health.SetText(fmt.Sprintf("%d", s.HealthScore))
	rw.reconnects.SetText(fmt.Sprintf("%d", s.ReconnectCount))
	rw.lastSeen.SetText(relTime(s.LastSeenAt))

	running := s.Status == publisher.StatusOnline || s.Status == publisher.StatusConnecting || s.Status == publisher.StatusReconnecting
	rw.startStop.SetText(map[bool]string{true: "Stop", false: "Start"}[running])
	rw.startStop.OnTapped = func() {
		if ct.onStartStop != nil {
			ct.onStartStop(s.CameraID, !running)
		}
	}
}

// --- row template widget ---

type rowWidget struct {
	widget.BaseWidget
	check      *widget.Check
	dot        *canvas.Circle
	name       *widget.Label
	group      *widget.Label
	status     *widget.Label
	health     *widget.Label
	reconnects *widget.Label
	lastSeen   *widget.Label
	startStop  *widget.Button
	container  *fyne.Container
}

func newRowTemplate() *rowWidget {
	r := &rowWidget{
		check:      widget.NewCheck("", nil),
		dot:        canvas.NewCircle(theme.Color(theme.ColorNameDisabled)),
		name:       widget.NewLabel("name"),
		group:      widget.NewLabel("group"),
		status:     widget.NewLabel("status"),
		health:     widget.NewLabel("0"),
		reconnects: widget.NewLabel("0"),
		lastSeen:   widget.NewLabel("never"),
		startStop:  widget.NewButton("Start", nil),
	}
	r.dot.Resize(fyne.NewSize(12, 12))
	dotBox := container.NewWithoutLayout(r.dot)
	dotBox.Resize(fyne.NewSize(14, 14))
	r.container = container.NewHBox(
		r.check,
		dotBox,
		fixedW(r.name, 160),
		fixedW(r.group, 90),
		fixedW(r.status, 100),
		fixedW(r.health, 40),
		fixedW(r.reconnects, 40),
		fixedW(r.lastSeen, 90),
		r.startStop,
	)
	r.ExtendBaseWidget(r)
	return r
}

func (r *rowWidget) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(r.container)
}

func fixedW(o fyne.CanvasObject, w float32) fyne.CanvasObject {
	return container.New(&fixedWidthLayout{w: w}, o)
}

type fixedWidthLayout struct{ w float32 }

func (l *fixedWidthLayout) MinSize(objs []fyne.CanvasObject) fyne.Size {
	h := float32(0)
	for _, o := range objs {
		if s := o.MinSize(); s.Height > h {
			h = s.Height
		}
	}
	return fyne.NewSize(l.w, h)
}
func (l *fixedWidthLayout) Layout(objs []fyne.CanvasObject, size fyne.Size) {
	for _, o := range objs {
		o.Resize(fyne.NewSize(l.w, size.Height))
		o.Move(fyne.NewPos(0, 0))
	}
}
