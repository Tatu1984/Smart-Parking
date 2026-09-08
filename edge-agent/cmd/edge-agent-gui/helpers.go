package main

import (
	"errors"
	"image/color"
	"io"
	"path/filepath"

	"fyne.io/fyne/v2"

	"github.com/sparking/edge-agent/internal/publisher"
)

// errPortalURL is shown when the Portal Connection URL isn't http(s).
var errPortalURL = errors.New("Ingest URL must start with http:// or https://")

// readAll drains a Fyne URI reader.
func readAll(rc fyne.URIReadCloser) []byte {
	data, _ := io.ReadAll(rc)
	return data
}

// shortName is the base filename of a path (for the backup picker).
func shortName(p string) string { return filepath.Base(p) }

// statusColor maps a runtime status to its badge colour.
func statusColor(s publisher.Status) color.Color {
	switch s {
	case publisher.StatusOnline:
		return color.NRGBA{R: 0x22, G: 0xC5, B: 0x5E, A: 0xFF} // green
	case publisher.StatusConnecting:
		return color.NRGBA{R: 0x3B, G: 0x82, B: 0xF6, A: 0xFF} // blue
	case publisher.StatusReconnecting:
		return color.NRGBA{R: 0xF5, G: 0x9E, B: 0x0B, A: 0xFF} // amber
	case publisher.StatusOffline:
		return color.NRGBA{R: 0x9C, G: 0xA3, B: 0xAF, A: 0xFF} // grey
	case publisher.StatusFailed:
		return color.NRGBA{R: 0xEF, G: 0x44, B: 0x44, A: 0xFF} // red
	default:
		return color.NRGBA{R: 0xD1, G: 0xD5, B: 0xDB, A: 0xFF} // light grey (idle/stopped)
	}
}
