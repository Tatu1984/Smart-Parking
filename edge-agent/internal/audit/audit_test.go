package audit

import (
	"bytes"
	"strings"
	"testing"
)

func TestRecordWritesStructuredLine(t *testing.T) {
	var buf bytes.Buffer
	a := New(&buf)
	a.Camera(CameraStarted, "cam-1", "Gate")
	out := buf.String()
	for _, want := range []string{"action=camera.started", "cameraId=cam-1", `camera=Gate`} {
		if !strings.Contains(out, want) {
			t.Errorf("audit line missing %q: %s", want, out)
		}
	}
}

func TestNilLoggerIsSafe(t *testing.T) {
	var a *Logger
	a.Record(CameraStopped)         // must not panic
	a.Camera(CameraDeleted, "x", "") // must not panic
}

func TestDiscardWriter(t *testing.T) {
	a := New(nil) // nil → io.Discard
	a.Record(ConfigExported, "count", 3)
}
