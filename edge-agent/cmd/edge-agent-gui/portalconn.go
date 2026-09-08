package main

import (
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

// portalConnPanel builds the "Portal Connection" section: the operator pastes the
// target portal's ingest base URL + token once, and the whole agent publishes
// there. This is how the agent is linked to ANY portal — point it at a different
// portal by pasting that portal's URL + token and saving.
//
// It maps to config.PortalBaseUrl + config.DefaultToken. Per-camera publish URLs
// / tokens still override when set, so mixed setups keep working.
func (u *appUI) portalConnPanel() fyne.CanvasObject {
	baseURL, token := u.model.PortalConnection()

	urlEntry := widget.NewEntry()
	urlEntry.SetPlaceHolder("https://your-portal.example.com")
	urlEntry.SetText(baseURL)

	tokenEntry := widget.NewPasswordEntry()
	tokenEntry.SetPlaceHolder("Portal ingest token")
	tokenEntry.SetText(token)

	status := widget.NewLabel("")
	setStatus := func() {
		b, _ := u.model.PortalConnection()
		if strings.TrimSpace(b) == "" {
			status.SetText("Not linked — the agent has no portal to publish to yet.")
		} else {
			status.SetText("Linked to: " + b)
		}
	}
	setStatus()

	save := widget.NewButtonWithIcon("Save connection", theme.ConfirmIcon(), func() {
		url := strings.TrimSpace(urlEntry.Text)
		if url != "" && !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
			dialog.ShowError(errPortalURL, u.win)
			return
		}
		u.model.SetPortalConnection(url, tokenEntry.Text)
		u.persist("updated portal connection")
		setStatus()
		dialog.ShowInformation("Portal Connection",
			"Saved. Cameras without their own publish URL/token now use this portal.", u.win)
	})

	form := container.NewBorder(nil, nil,
		widget.NewLabelWithStyle("Portal", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		save,
		container.NewGridWithColumns(2,
			container.NewBorder(nil, nil, widget.NewLabel("Ingest URL"), nil, urlEntry),
			container.NewBorder(nil, nil, widget.NewLabel("Token"), nil, tokenEntry),
		),
	)

	return container.NewVBox(form, status)
}
