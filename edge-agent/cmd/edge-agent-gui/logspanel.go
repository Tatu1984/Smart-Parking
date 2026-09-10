package main

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

// logsPanel is a live, in-memory activity log the operator can read to see what
// the agent is doing (connections, reconnects, errors). It is DELIBERATELY not
// persisted — lines live only while the app is open and are gone when it closes.
//
// It is fed from two sources the GUI already has:
//   - the worker's runtime Events stream (camera online/offline/reconnect/…), and
//   - per-camera state changes noticed during the status poll (with the detail /
//     error hint), which is exactly what explains "why is my camera OFFLINE".
type logsPanel struct {
	mu    sync.Mutex
	lines []string // bounded ring of formatted log lines
	max   int

	list    *widget.List
	root    fyne.CanvasObject
	lastKey map[string]string // cameraID → last "status|detail" seen (dedupe)
}

func newLogsPanel() *logsPanel {
	lp := &logsPanel{max: 500, lastKey: map[string]string{}}
	lp.list = widget.NewList(
		func() int { lp.mu.Lock(); defer lp.mu.Unlock(); return len(lp.lines) },
		func() fyne.CanvasObject {
			l := widget.NewLabel("")
			l.TextStyle = fyne.TextStyle{Monospace: true}
			l.Truncation = fyne.TextTruncateEllipsis
			return l
		},
		func(i widget.ListItemID, o fyne.CanvasObject) {
			lp.mu.Lock()
			defer lp.mu.Unlock()
			if i >= 0 && i < len(lp.lines) {
				o.(*widget.Label).SetText(lp.lines[i])
			}
		},
	)

	clearBtn := widget.NewButtonWithIcon("Clear", theme.DeleteIcon(), func() { lp.clear() })
	header := container.NewHBox(
		widget.NewLabelWithStyle("Activity log (this session only)", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		clearBtn,
	)
	// A fixed-height scroll area so the log doesn't push the rest of the UI around.
	scroll := container.NewVScroll(lp.list)
	scroll.SetMinSize(fyne.NewSize(0, 150))
	lp.root = container.NewBorder(header, nil, nil, nil, scroll)
	return lp
}

// add appends one timestamped line and trims to the ring size, then refreshes
// the list and auto-scrolls to the newest entry.
func (lp *logsPanel) add(line string) {
	ts := time.Now().Format("15:04:05")
	formatted := ts + "  " + line

	lp.mu.Lock()
	lp.lines = append(lp.lines, formatted)
	if len(lp.lines) > lp.max {
		lp.lines = lp.lines[len(lp.lines)-lp.max:]
	}
	n := len(lp.lines)
	lp.mu.Unlock()

	// UI updates must run on the Fyne thread.
	fyne.Do(func() {
		lp.list.Refresh()
		if n > 0 {
			lp.list.ScrollTo(n - 1)
		}
	})
}

func (lp *logsPanel) clear() {
	lp.mu.Lock()
	lp.lines = nil
	lp.lastKey = map[string]string{}
	lp.mu.Unlock()
	fyne.Do(func() { lp.list.Refresh() })
}

// noteEvent logs a runtime event from the worker's Events stream.
func (lp *logsPanel) noteEvent(camera, name, typ, detail string) {
	label := name
	if label == "" {
		label = camera
	}
	msg := fmt.Sprintf("[%s] %s", label, strings.TrimPrefix(typ, "camera."))
	if detail != "" {
		msg += " — " + detail
	}
	lp.add(msg)
}

// noteState logs a per-camera state observed during a poll, but only when it
// CHANGED since last time (so the log isn't spammed every poll). This is where
// the useful "OFFLINE — <reason> (hint: …)" lines come from.
func (lp *logsPanel) noteState(cameraID, name, status, detail, errClass, hint string) {
	key := status + "|" + detail
	lp.mu.Lock()
	prev := lp.lastKey[cameraID]
	lp.lastKey[cameraID] = key
	lp.mu.Unlock()
	if key == prev {
		return // unchanged — don't repeat
	}
	label := name
	if label == "" {
		label = cameraID
	}
	msg := fmt.Sprintf("[%s] %s", label, status)
	if detail != "" {
		msg += " — " + detail
	}
	if errClass != "" && errClass != "unknown" {
		msg += "  (" + errClass + ")"
	}
	if hint != "" {
		msg += "\n          ↳ " + hint
	}
	lp.add(msg)
}

// info logs a plain informational line (operator actions, worker start/stop).
func (lp *logsPanel) info(msg string) { lp.add(msg) }
