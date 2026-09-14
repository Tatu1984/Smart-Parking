package publisher

import (
	"runtime"
	"sync"
)

// transcodeBudget is how many simultaneous H.265→H.264 transcodes this machine
// can be expected to sustain in realtime.
//
// Measured against the cameras this is built for — 2MP H.265 at 960x1080, 15fps,
// through the exact encoder settings in ffmpeg.Args — one pipeline costs roughly
// half a core (decode included; ffmpeg is asked for neither hardware decoding
// nor hardware encoding). Six such streams held realtime on four cores at about
// 55% utilisation, so roughly 1.5 cameras per core is the honest line, and this
// leaves a margin below it for the operating system, the GUI, and a browser
// watching the wall.
//
// Bigger frames cost proportionally more: true 1920x1080 is about twice this,
// 4MP about four times. The threshold cannot see resolution, so it is set for
// the common case and deliberately generous — a warning that cries wolf gets
// ignored, and this one needs to be believed when it fires.
//
// It is a warning threshold only. Nothing is refused or queued — a camera the
// operator enabled keeps running, because a picture arriving late is still
// better than no picture, and only the operator knows which camera matters.
func transcodeBudget() int {
	n := runtime.NumCPU() + runtime.NumCPU()/2 // ~1.5 per core
	if n < 2 {
		n = 2
	}
	return n
}

/*
transcodeLoad counts how many cameras are transcoding right now, and says so
once when that number passes what the machine can carry.

Why this exists: a starved transcode does not crash. ffmpeg keeps emitting
progress, so the stall watchdog sees a live process and leaves it alone; it
simply produces segments slower than real time, the playlist falls behind the
live edge, and the viewer sees stalls and gaps. There is no error anywhere to
read. This turns that silent degradation into one plain line in the log naming
the cause and the fix.

The warning fires on the transition past the budget, not on every camera start,
so a six-camera site logs it once rather than repeatedly. It re-arms when the
count drops back to the budget, so a genuine change in the fleet is reported
again.
*/
type transcodeLoad struct {
	mu     sync.Mutex
	active int
	warned bool
}

// begin records that a camera has started transcoding. It returns the number
// now active, the budget, and whether this is the moment the budget was
// exceeded (true exactly once per excursion) so the caller can log it.
func (t *transcodeLoad) begin() (active, budget int, exceeded bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.active++
	budget = transcodeBudget()
	if t.active > budget && !t.warned {
		t.warned = true
		return t.active, budget, true
	}
	return t.active, budget, false
}

// end records that a camera has stopped transcoding, re-arming the warning once
// the fleet is back within budget.
func (t *transcodeLoad) end() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.active > 0 {
		t.active--
	}
	if t.active <= transcodeBudget() {
		t.warned = false
	}
}
