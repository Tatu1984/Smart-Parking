// Command edge-agent-gui is the SParking Edge Agent control panel.
//
// It is a thin CONTROL SURFACE over a separate background worker process:
// closing this window does not stop streaming — only the Stop button does.
// It writes the shared config the worker reads, starts/stops that worker, shows
// live status, tails the worker's log, and can register the worker to start
// automatically at login.
package main

import (
	"fmt"
	"os"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"github.com/sparking/edge-agent/internal/config"
	"github.com/sparking/edge-agent/internal/ffmpeg"
	"github.com/sparking/edge-agent/internal/service"
)

var version = "dev"

func main() {
	a := app.NewWithID("io.sparking.edgeagent")
	w := a.NewWindow("SParking Edge Agent")
	w.Resize(fyne.NewSize(680, 620))

	cfgPath, err := config.DefaultConfigPath()
	if err != nil {
		cfgPath = "config.yaml"
	}
	cfg := config.LoadOrDefault(cfgPath)

	// ---- Settings fields -------------------------------------------------
	cameraName := widget.NewEntry()
	cameraName.SetPlaceHolder("e.g. Main Gate Camera")
	cameraName.SetText(cfg.Camera.Name)

	rtsp := widget.NewEntry()
	rtsp.SetPlaceHolder("rtsp://user:password@192.168.1.100:554/Streaming/Channels/101")
	rtsp.SetText(cfg.Camera.RTSP)

	publish := widget.NewEntry()
	publish.SetPlaceHolder("https://your-portal/api/edge/ingest/<streamKey>/index.m3u8")
	publish.SetText(cfg.Cloud.Publish)

	token := widget.NewPasswordEntry()
	token.SetPlaceHolder("edge_… (from the SParking dashboard)")
	token.SetText(cfg.Cloud.Token)

	transcode := widget.NewSelect([]string{"auto", "copy", "h264"}, nil)
	if cfg.FFmpeg.Transcode == "" {
		transcode.SetSelected("auto")
	} else {
		transcode.SetSelected(cfg.FFmpeg.Transcode)
	}

	form := widget.NewForm(
		widget.NewFormItem("Camera name", cameraName),
		widget.NewFormItem("Camera RTSP URL", rtsp),
		widget.NewFormItem("Portal ingest URL", publish),
		widget.NewFormItem("Ingest token", token),
		widget.NewFormItem("Video mode", transcode),
	)

	// ---- FFmpeg availability banner --------------------------------------
	// The agent shells out to ffmpeg/ffprobe. If they're missing, Start would
	// fail with a message buried in the log, so surface it up front with the
	// exact fix command and a Recheck button.
	ffmpegBanner := widget.NewLabel("")
	ffmpegBanner.Wrapping = fyne.TextWrapWord
	ffmpegHint := widget.NewLabel("")
	ffmpegHint.Wrapping = fyne.TextWrapWord
	recheckBtn := widget.NewButtonWithIcon("Recheck", theme.ViewRefreshIcon(), nil)
	ffmpegBox := container.NewVBox(ffmpegBanner, ffmpegHint, recheckBtn)

	checkFFmpeg := func() bool {
		av := ffmpeg.Detect(cfg.FFmpeg.Binary, cfg.FFprobeBinary())
		if av.OK() {
			ffmpegBox.Hide()
			return true
		}
		missing := "ffmpeg and ffprobe are"
		switch {
		case av.FFmpegOK && !av.FFprobeOK:
			missing = "ffprobe is"
		case !av.FFmpegOK && av.FFprobeOK:
			missing = "ffmpeg is"
		}
		ffmpegBanner.SetText("⚠  FFmpeg is required but " + missing + " not available.\n" +
			"Streaming cannot start until it is installed.")
		ffmpegHint.SetText("Install it with:    " + ffmpeg.InstallHint())
		ffmpegBox.Show()
		return false
	}
	recheckBtn.OnTapped = func() {
		if checkFFmpeg() {
			dialog.ShowInformation("FFmpeg found", "FFmpeg is installed. You can start the agent.", w)
		}
	}

	// ---- Status ----------------------------------------------------------
	statusLabel := widget.NewLabelWithStyle("Checking…", fyne.TextAlignLeading,
		fyne.TextStyle{Bold: true})
	startBtn := widget.NewButtonWithIcon("Start", theme.MediaPlayIcon(), nil)
	stopBtn := widget.NewButtonWithIcon("Stop", theme.MediaStopIcon(), nil)

	autostart := widget.NewCheck("Start automatically when this computer starts", nil)
	autostart.SetChecked(service.AutostartEnabled())

	refreshStatus := func() {
		st := service.CurrentStatus()
		if st.Running {
			statusLabel.SetText(fmt.Sprintf("● Running  (streaming, PID %d)", st.PID))
			startBtn.Disable()
			stopBtn.Enable()
		} else {
			statusLabel.SetText("○ Stopped  (not streaming)")
			startBtn.Enable()
			stopBtn.Disable()
		}
	}

	saveConfig := func() error {
		cfg.Camera.Name = cameraName.Text
		cfg.Camera.RTSP = strings.TrimSpace(rtsp.Text)
		cfg.Cloud.Publish = strings.TrimSpace(publish.Text)
		cfg.Cloud.Token = strings.TrimSpace(token.Text)
		cfg.FFmpeg.Transcode = transcode.Selected
		if cfg.FFmpeg.Binary == "" {
			cfg.FFmpeg.Binary = "ffmpeg"
		}
		if cfg.Log.Level == "" {
			cfg.Log.Level = "info"
		}
		return config.Save(cfgPath, cfg)
	}

	saveBtn := widget.NewButtonWithIcon("Save settings", theme.DocumentSaveIcon(), func() {
		if err := saveConfig(); err != nil {
			dialog.ShowError(err, w)
			return
		}
		msg := "Settings saved."
		if service.CurrentStatus().Running {
			if err := service.Restart(); err != nil {
				dialog.ShowError(fmt.Errorf("saved, but restart failed: %w", err), w)
				return
			}
			msg = "Settings saved and the agent was restarted."
		}
		dialog.ShowInformation("Saved", msg, w)
		refreshStatus()
	})

	startBtn.OnTapped = func() {
		if err := saveConfig(); err != nil {
			dialog.ShowError(err, w)
			return
		}
		// Fail fast with a clear message rather than starting a worker that
		// will immediately die because ffmpeg/ffprobe are missing.
		if !checkFFmpeg() {
			dialog.ShowError(fmt.Errorf(
				"FFmpeg is not installed.\n\nInstall it with:\n  %s\n\nThen click Recheck.",
				ffmpeg.InstallHint()), w)
			return
		}
		if err := service.Start(); err != nil {
			dialog.ShowError(err, w)
		}
		refreshStatus()
	}

	stopBtn.OnTapped = func() {
		if err := service.Stop(); err != nil {
			dialog.ShowError(err, w)
		}
		refreshStatus()
	}

	autostart.OnChanged = func(on bool) {
		var err error
		if on {
			err = service.EnableAutostart()
		} else {
			err = service.DisableAutostart()
		}
		if err != nil {
			dialog.ShowError(err, w)
			autostart.SetChecked(service.AutostartEnabled())
		}
	}

	// ---- Log view --------------------------------------------------------
	logBox := widget.NewMultiLineEntry()
	logBox.Wrapping = fyne.TextWrapWord
	logBox.SetMinRowsVisible(10)
	logScroll := container.NewVScroll(logBox)
	logScroll.SetMinSize(fyne.NewSize(0, 200))

	refreshLog := func() {
		p, err := config.LogPath()
		if err != nil {
			return
		}
		data, err := os.ReadFile(p)
		if err != nil {
			logBox.SetText("(no log yet — start the agent)")
			return
		}
		logBox.SetText(tail(string(data), 200))
	}

	clearLogBtn := widget.NewButton("Clear log", func() {
		if p, err := config.LogPath(); err == nil {
			_ = os.WriteFile(p, nil, 0o600)
		}
		refreshLog()
	})

	// ---- Layout ----------------------------------------------------------
	controls := container.NewHBox(startBtn, stopBtn, saveBtn)
	header := container.NewVBox(
		widget.NewLabelWithStyle("SParking Edge Agent "+version, fyne.TextAlignLeading,
			fyne.TextStyle{Bold: true}),
		widget.NewLabel("Streams this site's CCTV to your SParking portal. "+
			"The agent keeps running in the background after you close this window."),
		ffmpegBox,
		widget.NewSeparator(),
		statusLabel,
		controls,
		autostart,
		widget.NewSeparator(),
	)

	content := container.NewBorder(
		header, nil, nil, nil,
		container.NewVBox(
			widget.NewLabelWithStyle("Settings", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
			form,
			widget.NewSeparator(),
			container.NewHBox(
				widget.NewLabelWithStyle("Activity log", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
				clearLogBtn,
			),
			logScroll,
		),
	)
	w.SetContent(content)

	// Poll status + log so the window reflects the background worker live.
	go func() {
		for {
			fyne.Do(func() {
				refreshStatus()
				refreshLog()
			})
			time.Sleep(2 * time.Second)
		}
	}()

	refreshStatus()
	refreshLog()
	checkFFmpeg() // surface a missing dependency before the user clicks Start
	w.ShowAndRun()
}

// tail returns the last n lines of s (the log view shows recent activity).
func tail(s string, n int) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	if len(lines) <= n {
		return strings.Join(lines, "\n")
	}
	return strings.Join(lines[len(lines)-n:], "\n")
}
