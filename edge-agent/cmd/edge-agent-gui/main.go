// Command edge-agent-gui is the SParking Edge Agent control panel — a multi-
// camera management surface over the SEPARATE background worker process.
//
// Separation of concerns (Phase-2 principle):
//   - ConfigModel (appmodel.Model) = desired state the operator edits + persists.
//   - RuntimeView  = read-only view of live state from the worker's control API.
// The GUI never owns runtime state; it reads States()/Events() and issues
// commands (start/stop) via the control client. Closing the window keeps
// streaming; the worker runs independently.
package main

import (
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"github.com/sparking/edge-agent/internal/appmodel"
	"github.com/sparking/edge-agent/internal/audit"
	"github.com/sparking/edge-agent/internal/config"
	"github.com/sparking/edge-agent/internal/control"
	"github.com/sparking/edge-agent/internal/ffmpeg"
	"github.com/sparking/edge-agent/internal/publisher"
	"github.com/sparking/edge-agent/internal/service"
)

var version = "dev"

func main() {
	a := app.NewWithID("io.sparking.edgeagent")
	w := a.NewWindow("SParking Edge Agent")
	w.Resize(fyne.NewSize(980, 680))

	cfgPath, _ := config.DefaultConfigPath()
	if cfgPath == "" {
		cfgPath = "config.yaml"
	}
	model := appmodel.New(config.LoadOrDefault(cfgPath))

	ui := newAppUI(a, w, model, cfgPath)
	ui.build()

	ui.startPolling()
	ui.checkFFmpeg()
	w.ShowAndRun()
}

// appUI holds the whole control panel.
type appUI struct {
	app     fyne.App
	win     fyne.Window
	model   *appmodel.Model
	cfgPath string

	table   *cameraTable
	drawer  *detailsDrawer
	rtview  *appmodel.RuntimeView

	// toolbar state
	search      *widget.Entry
	statusFltr  *widget.Select
	groupFltr   *widget.Select
	sortSel     *widget.Select
	sortAsc     bool

	// worker status / ffmpeg banner
	statusLabel *widget.Label
	ffmpegBox   *fyne.Container
	ffmpegBanner *widget.Label
	ffmpegHint  *widget.Label

	control *control.Client // nil until the worker publishes its endpoint
	audit   *audit.Logger
}

func newAppUI(a fyne.App, w fyne.Window, m *appmodel.Model, cfgPath string) *appUI {
	// Operator actions are recorded to the same append-only audit.log the worker
	// uses (add/edit/delete/start/stop/import/export/restore).
	auditFile, _ := config.AuditPath()
	aud, _ := audit.Open(auditFile)
	return &appUI{
		app: a, win: w, model: m, cfgPath: cfgPath,
		table:  newCameraTable(),
		drawer: newDetailsDrawer(),
		rtview: appmodel.NewRuntimeView(),
		sortAsc: true,
		audit:  aud,
	}
}

func (u *appUI) build() {
	u.table.onSelect = u.showDetails
	u.table.onStartStop = u.startStopCamera
	u.drawer.onEdit = u.editSelected
	u.drawer.onDelete = func(id string) {
		dialog.ShowConfirm("Delete camera", "Delete this camera?", func(ok bool) {
			if !ok {
				return
			}
			u.model.Delete(id)
			u.drawer.hide()
			u.persist("deleted camera " + id)
		}, u.win)
	}

	// ---- toolbar ----
	u.search = widget.NewEntry()
	u.search.SetPlaceHolder("Search name / id / group…")
	u.search.OnChanged = func(string) { u.refreshTable() }

	u.statusFltr = widget.NewSelect([]string{"All", "ONLINE", "OFFLINE", "RECONNECTING", "FAILED", "STOPPED", "IDLE"}, func(string) { u.refreshTable() })
	u.statusFltr.SetSelected("All")
	u.groupFltr = widget.NewSelect(append([]string{"All groups"}, u.model.Groups()...), func(string) { u.refreshTable() })
	u.groupFltr.SetSelected("All groups")
	u.sortSel = widget.NewSelect([]string{"Name", "Status", "Health", "Reconnects", "Last seen", "Group"}, func(string) { u.refreshTable() })
	u.sortSel.SetSelected("Name")
	sortDir := widget.NewButtonWithIcon("", theme.MoveUpIcon(), nil)
	sortDir.OnTapped = func() {
		u.sortAsc = !u.sortAsc
		if u.sortAsc {
			sortDir.SetIcon(theme.MoveUpIcon())
		} else {
			sortDir.SetIcon(theme.MoveDownIcon())
		}
		u.refreshTable()
	}

	addBtn := widget.NewButtonWithIcon("Add camera", theme.ContentAddIcon(), u.addCamera)

	toolbar := container.NewBorder(nil, nil,
		container.NewHBox(addBtn),
		container.NewHBox(widget.NewLabel("Sort:"), u.sortSel, sortDir),
		container.NewGridWithColumns(3, u.search, u.statusFltr, u.groupFltr),
	)

	// ---- bulk actions ----
	bulk := container.NewHBox(
		widget.NewLabel("Selected:"),
		widget.NewButton("Start", func() { u.bulk("start") }),
		widget.NewButton("Stop", func() { u.bulk("stop") }),
		widget.NewButton("Enable", func() { u.bulk("enable") }),
		widget.NewButton("Disable", func() { u.bulk("disable") }),
		widget.NewButtonWithIcon("Delete", theme.DeleteIcon(), func() { u.bulk("delete") }),
	)

	// ---- global controls ----
	global := container.NewHBox(
		widget.NewButtonWithIcon("Start All", theme.MediaPlayIcon(), func() { u.allCameras(true) }),
		widget.NewButtonWithIcon("Stop All", theme.MediaStopIcon(), func() { u.allCameras(false) }),
		widget.NewSeparator(),
		widget.NewButtonWithIcon("Import…", theme.FolderOpenIcon(), u.importConfig),
		widget.NewButtonWithIcon("Export…", theme.DocumentSaveIcon(), u.exportConfig),
		widget.NewButtonWithIcon("Backups…", theme.HistoryIcon(), u.showBackups),
	)

	// ---- worker status + ffmpeg banner ----
	u.statusLabel = widget.NewLabelWithStyle("Checking worker…", fyne.TextAlignLeading, fyne.TextStyle{Bold: true})
	u.ffmpegBanner = widget.NewLabel("")
	u.ffmpegBanner.Wrapping = fyne.TextWrapWord
	u.ffmpegHint = widget.NewLabel("")
	recheck := widget.NewButtonWithIcon("Recheck", theme.ViewRefreshIcon(), func() { u.checkFFmpeg() })
	u.ffmpegBox = container.NewVBox(u.ffmpegBanner, u.ffmpegHint, recheck)

	workerBtns := container.NewHBox(
		widget.NewButtonWithIcon("Start worker", theme.MediaPlayIcon(), u.startWorker),
		widget.NewButtonWithIcon("Stop worker", theme.MediaStopIcon(), u.stopWorker),
	)
	autostart := widget.NewCheck("Start automatically at login", func(on bool) {
		var err error
		if on {
			err = service.EnableAutostart()
		} else {
			err = service.DisableAutostart()
		}
		if err != nil {
			dialog.ShowError(err, u.win)
		}
	})
	autostart.SetChecked(service.AutostartEnabled())

	header := container.NewVBox(
		widget.NewLabelWithStyle("SParking Edge Agent "+version, fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		u.ffmpegBox,
		u.statusLabel,
		container.NewHBox(workerBtns, autostart),
		widget.NewSeparator(),
		toolbar,
		bulk,
	)

	// table (left) + details drawer (right)
	split := container.NewHSplit(
		container.NewBorder(nil, global, nil, nil, u.table.object()),
		u.drawer.root,
	)
	split.SetOffset(0.66)

	u.win.SetContent(container.NewBorder(header, nil, nil, nil, split))
	u.refreshTable()
}

// ---- table rendering (config-driven rows merged with runtime snapshots) ----

// currentRows builds display rows: one per configured camera, merged with its
// runtime snapshot (status/health) when the worker reports it.
func (u *appUI) currentRows(runtime map[string]publisher.StateSnapshot) []appmodel.Row {
	rows := make([]appmodel.Row, 0, len(u.model.Cameras()))
	for _, c := range u.model.Cameras() {
		if s, ok := runtime[c.CameraID]; ok {
			// runtime snapshot carries name/group too, but prefer config's
			// (operator may have edited without a restart).
			s.Name, s.Group = c.Name, c.Group
			rows = append(rows, s)
			continue
		}
		// No runtime info (worker down or camera not started): synthesize a row.
		st := publisher.StatusStopped
		if !c.Enabled {
			st = publisher.StatusIdle
		}
		rows = append(rows, appmodel.Row{CameraID: c.CameraID, Name: c.Name, Group: c.Group, Status: st})
	}
	return rows
}

func (u *appUI) refreshTable() {
	runtimeMap := u.fetchStates()
	rows := u.currentRows(runtimeMap)
	rows = appmodel.ApplyFilter(rows, u.currentFilter())
	appmodel.SortRows(rows, u.currentSortKey(), u.sortAsc)
	u.table.setRows(rows)
}

func (u *appUI) currentFilter() appmodel.Filter {
	f := appmodel.Filter{Text: u.search.Text}
	if u.statusFltr.Selected != "All" {
		f.Status = publisher.Status(u.statusFltr.Selected)
	}
	if u.groupFltr.Selected != "All groups" {
		f.Group = u.groupFltr.Selected
	}
	return f
}

func (u *appUI) currentSortKey() appmodel.SortKey {
	switch u.sortSel.Selected {
	case "Status":
		return appmodel.SortByStatus
	case "Health":
		return appmodel.SortByHealth
	case "Reconnects":
		return appmodel.SortByReconnects
	case "Last seen":
		return appmodel.SortByLastSeen
	case "Group":
		return appmodel.SortByGroup
	default:
		return appmodel.SortByName
	}
}

// ---- runtime (control client) ----

// ensureControl lazily connects to the worker's control API via its endpoint file.
func (u *appUI) ensureControl() *control.Client {
	if u.control != nil && u.control.Ping() {
		return u.control
	}
	epPath, err := config.ControlEndpointPath()
	if err != nil {
		return nil
	}
	ep, err := control.ReadEndpoint(epPath)
	if err != nil {
		u.control = nil
		return nil
	}
	c := control.NewClient(ep.Addr, ep.Token)
	if !c.Ping() {
		u.control = nil
		return nil
	}
	u.control = c
	return c
}

func (u *appUI) fetchStates() map[string]publisher.StateSnapshot {
	out := map[string]publisher.StateSnapshot{}
	c := u.ensureControl()
	if c == nil {
		return out
	}
	states, err := c.States()
	if err != nil {
		return out
	}
	for _, s := range states {
		out[s.CameraID] = s
	}
	return out
}

// ---- actions ----

func (u *appUI) showDetails(cameraID string) {
	states := u.fetchStates()
	s, ok := states[cameraID]
	if !ok {
		// Synthesize from config so the drawer still opens when the worker is down.
		i := u.model.FindIndex(cameraID)
		if i < 0 {
			return
		}
		c := u.model.Cameras()[i]
		s = publisher.StateSnapshot{CameraID: c.CameraID, Name: c.Name, Group: c.Group, Status: publisher.StatusStopped}
	}
	// History only available from the running engine; empty is fine.
	u.drawer.show(s, publisher.HistorySnapshot{})
}

func (u *appUI) startStopCamera(cameraID string, start bool) {
	c := u.ensureControl()
	if c == nil {
		dialog.ShowInformation("Worker not running",
			"Start the worker first to control individual cameras.", u.win)
		return
	}
	var err error
	if start {
		err = c.StartCamera(cameraID)
		u.audit.Camera(audit.CameraStarted, cameraID, "")
	} else {
		err = c.StopCamera(cameraID)
		u.audit.Camera(audit.CameraStopped, cameraID, "")
	}
	if err != nil {
		dialog.ShowError(err, u.win)
	}
	u.refreshTable()
}

func (u *appUI) allCameras(start bool) {
	c := u.ensureControl()
	if c == nil {
		dialog.ShowInformation("Worker not running", "Start the worker first.", u.win)
		return
	}
	var err error
	if start {
		err = c.StartAll()
		u.audit.Record(audit.StartedAll)
	} else {
		err = c.StopAll()
		u.audit.Record(audit.StoppedAll)
	}
	if err != nil {
		dialog.ShowError(err, u.win)
	}
	u.refreshTable()
}

func (u *appUI) bulk(action string) {
	ids := u.table.selectedIDs()
	if len(ids) == 0 {
		dialog.ShowInformation("No selection", "Select one or more cameras first.", u.win)
		return
	}
	switch action {
	case "enable":
		u.model.SetEnabledBulk(ids, true)
		u.persist("enabled selected")
	case "disable":
		u.model.SetEnabledBulk(ids, false)
		u.persist("disabled selected")
	case "delete":
		dialog.ShowConfirm("Delete cameras", fmt.Sprintf("Delete %d selected camera(s)?", len(ids)), func(ok bool) {
			if !ok {
				return
			}
			u.model.DeleteBulk(ids)
			u.table.clearSelection()
			u.persist("deleted selected")
		}, u.win)
		return
	case "start", "stop":
		c := u.ensureControl()
		if c == nil {
			dialog.ShowInformation("Worker not running", "Start the worker first.", u.win)
			return
		}
		for _, id := range ids {
			if action == "start" {
				_ = c.StartCamera(id)
			} else {
				_ = c.StopCamera(id)
			}
		}
	}
	u.refreshTable()
}

func (u *appUI) addCamera() {
	showCameraDialog(u.win, nil, u.model.Config().RTSPTemplate, func(cam config.CameraConfig) error {
		if err := u.model.Add(cam); err != nil {
			return err
		}
		u.rebuildGroupFilter()
		u.persist("added camera " + cam.CameraID)
		return nil
	})
}

func (u *appUI) editSelected(cameraID string) {
	i := u.model.FindIndex(cameraID)
	if i < 0 {
		return
	}
	c := u.model.Cameras()[i]
	showCameraDialog(u.win, &c, u.model.Config().RTSPTemplate, func(cam config.CameraConfig) error {
		if err := u.model.Update(cam); err != nil {
			return err
		}
		u.rebuildGroupFilter()
		u.persist("edited camera " + cam.CameraID)
		return nil
	})
}

// ---- config persistence + import/export/backup ----

func (u *appUI) persist(action string) {
	stamp := time.Now().Format("20060102-150405")
	if err := u.model.Save(u.cfgPath, stamp); err != nil {
		dialog.ShowError(err, u.win)
		return
	}
	u.audit.Record(audit.ConfigSaved, "detail", action)
	// If the worker is running, tell it to re-read (restart process — restart-on-save).
	if service.CurrentStatus().Running {
		_ = service.Restart()
	}
	u.refreshTable()
}

func (u *appUI) importConfig() {
	dialog.ShowFileOpen(func(rc fyne.URIReadCloser, err error) {
		if err != nil || rc == nil {
			return
		}
		defer rc.Close()
		data := readAll(rc)
		exp, perr := appmodel.ParseExport(data)
		if perr != nil {
			dialog.ShowError(perr, u.win)
			return
		}
		// Ask Merge vs Replace.
		dialog.ShowCustomConfirm("Import", "Merge", "Replace",
			widget.NewLabel(fmt.Sprintf("Import %d camera(s)?\n\nMerge = add new (keep existing)\nReplace = replace the whole list", len(exp.Cameras))),
			func(merge bool) {
				mode := appmodel.Replace
				if merge {
					mode = appmodel.Merge
				}
				res, aerr := u.model.ApplyImport(exp, mode)
				if aerr != nil {
					dialog.ShowError(aerr, u.win)
					return
				}
				u.rebuildGroupFilter()
				u.audit.Record(audit.ConfigImported, "added", res.Added, "replaced", res.Replaced, "skipped", len(res.Skipped))
				u.persist("imported config")
				u.reportImport(res)
			}, u.win)
	}, u.win)
}

func (u *appUI) reportImport(res appmodel.ImportResult) {
	var b strings.Builder
	fmt.Fprintf(&b, "Added: %d   Replaced: %d\n", res.Added, res.Replaced)
	if len(res.Skipped) > 0 {
		b.WriteString("\nSkipped:\n")
		for _, s := range res.Skipped {
			fmt.Fprintf(&b, "  • %s — %s\n", s.CameraID, s.Reason)
		}
	}
	if len(res.Warnings) > 0 {
		b.WriteString("\nWarnings:\n")
		for _, wn := range res.Warnings {
			fmt.Fprintf(&b, "  • %s\n", wn)
		}
	}
	dialog.ShowInformation("Import complete", b.String(), u.win)
}

func (u *appUI) exportConfig() {
	dialog.ShowFileSave(func(wc fyne.URIWriteCloser, err error) {
		if err != nil || wc == nil {
			return
		}
		defer wc.Close()
		host, _ := os.Hostname()
		data, merr := u.model.ToJSON(appmodel.ExportMeta{
			AgentVersion: version, Hostname: host,
			Platform: runtime.GOOS + "/" + runtime.GOARCH, Now: time.Now(),
		})
		if merr != nil {
			dialog.ShowError(merr, u.win)
			return
		}
		if _, werr := wc.Write(data); werr != nil {
			dialog.ShowError(werr, u.win)
			return
		}
		u.audit.Record(audit.ConfigExported, "cameras", len(u.model.Cameras()))
	}, u.win)
}

func (u *appUI) showBackups() {
	baks := appmodel.Backups(u.cfgPath)
	if len(baks) == 0 {
		dialog.ShowInformation("Backups", "No backups yet.", u.win)
		return
	}
	names := make([]string, len(baks))
	for i, b := range baks {
		names[i] = shortName(b)
	}
	sel := widget.NewSelect(names, nil)
	sel.SetSelectedIndex(0)
	dialog.ShowCustomConfirm("Restore backup", "Restore", "Cancel",
		container.NewVBox(widget.NewLabel("Restore which backup? (current config is backed up first)"), sel),
		func(ok bool) {
			if !ok || sel.SelectedIndex() < 0 {
				return
			}
			rm, rerr := appmodel.Restore(baks[sel.SelectedIndex()])
			if rerr != nil {
				dialog.ShowError(rerr, u.win)
				return
			}
			u.model = rm
			u.rebuildGroupFilter()
			u.persist("restored backup")
			dialog.ShowInformation("Restored", "Backup restored.", u.win)
		}, u.win)
}

func (u *appUI) rebuildGroupFilter() {
	sel := u.groupFltr.Selected
	u.groupFltr.Options = append([]string{"All groups"}, u.model.Groups()...)
	u.groupFltr.SetSelected(sel)
	u.groupFltr.Refresh()
}

// ---- worker process control + ffmpeg ----

func (u *appUI) checkFFmpeg() bool {
	av := ffmpeg.Detect(u.model.Config().FFmpeg.Binary, u.model.Config().FFprobeBinary())
	if av.OK() {
		u.ffmpegBox.Hide()
		return true
	}
	u.ffmpegBanner.SetText("⚠  FFmpeg is required but not available. Streaming cannot start until it is installed.")
	u.ffmpegHint.SetText("Install it with:  " + ffmpeg.InstallHint())
	u.ffmpegBox.Show()
	return false
}

func (u *appUI) startWorker() {
	if !u.checkFFmpeg() {
		dialog.ShowError(fmt.Errorf("FFmpeg is not installed.\n\nInstall it with:\n  %s\n\nThen click Recheck.", ffmpeg.InstallHint()), u.win)
		return
	}
	if len(u.model.Cameras()) == 0 {
		dialog.ShowInformation("No cameras", "Add at least one camera first.", u.win)
		return
	}
	if err := service.Start(); err != nil {
		dialog.ShowError(err, u.win)
	}
	u.refreshStatus()
}

func (u *appUI) stopWorker() {
	if err := service.Stop(); err != nil {
		dialog.ShowError(err, u.win)
	}
	u.control = nil
	u.refreshStatus()
}

func (u *appUI) refreshStatus() {
	st := service.CurrentStatus()
	if st.Running {
		u.statusLabel.SetText(fmt.Sprintf("● Worker running (PID %d)", st.PID))
	} else {
		u.statusLabel.SetText("○ Worker stopped")
	}
}

// startPolling refreshes status + table on a 2s cadence. For the live poll it
// uses ROW-DIFFING: only cameras whose visible state changed are repainted,
// keeping the table responsive at 100–200 cameras. A full rebuild happens only
// when the set/order of rows changes (added/removed camera) or on a user action
// (filter/sort/edit) via refreshTable().
func (u *appUI) startPolling() {
	go func() {
		for {
			states := u.fetchStates()
			diff := u.rtview.Diff(mapValues(states))
			fyne.Do(func() {
				u.refreshStatus()
				if diff.OrderChanged || len(diff.Removed) > 0 {
					u.refreshTable() // set changed → full rebuild (respects filter/sort)
				} else if len(diff.Changed) > 0 {
					changed := make(map[string]publisher.StateSnapshot, len(diff.Changed))
					for _, rc := range diff.Changed {
						changed[rc.CameraID] = rc.Snapshot
					}
					u.table.refreshChanged(changed) // only changed rows repaint
				}
			})
			time.Sleep(2 * time.Second)
		}
	}()
}

func mapValues(m map[string]publisher.StateSnapshot) []publisher.StateSnapshot {
	out := make([]publisher.StateSnapshot, 0, len(m))
	for _, v := range m {
		out = append(out, v)
	}
	return out
}
