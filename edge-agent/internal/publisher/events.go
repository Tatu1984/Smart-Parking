package publisher

import (
	"sync"
	"time"
)

// EventType enumerates supervisor runtime events.
type EventType string

const (
	EventCameraStarted   EventType = "camera.started"
	EventCameraStopped   EventType = "camera.stopped"
	EventCameraOnline    EventType = "camera.online"
	EventCameraOffline   EventType = "camera.offline"
	EventCameraReconnect EventType = "camera.reconnect"
	EventCameraFailed    EventType = "camera.failed"
)

// Event is one runtime event emitted by the supervisor.
type Event struct {
	Type     EventType
	CameraID string
	Name     string
	At       time.Time
	Detail   string
}

// eventFromStatus maps a status transition to an event type (or "" to skip).
func eventFromStatus(to Status) EventType {
	switch to {
	case StatusOnline:
		return EventCameraOnline
	case StatusOffline:
		return EventCameraOffline
	case StatusReconnecting, StatusStalled:
		return EventCameraReconnect
	case StatusFailed:
		return EventCameraFailed
	default:
		return "" // IDLE/CONNECTING/STOPPED aren't broadcast as their own events
	}
}

// eventBus is a non-blocking broadcast. Subscribers get a BUFFERED channel; if a
// subscriber is slow and its buffer fills, the OLDEST event is dropped rather
// than blocking the publisher. This guarantees event delivery can NEVER stall
// streaming — the core safety property of Events().
type eventBus struct {
	mu   sync.Mutex
	subs map[int]chan Event
	next int
}

func newEventBus() *eventBus { return &eventBus{subs: make(map[int]chan Event)} }

// subscribe returns a receive-only channel and an unsubscribe func. bufSize is
// the per-subscriber buffer; when full, oldest events are dropped.
func (b *eventBus) subscribe(bufSize int) (<-chan Event, func()) {
	if bufSize < 1 {
		bufSize = 64
	}
	ch := make(chan Event, bufSize)
	b.mu.Lock()
	id := b.next
	b.next++
	b.subs[id] = ch
	b.mu.Unlock()
	return ch, func() {
		b.mu.Lock()
		if c, ok := b.subs[id]; ok {
			delete(b.subs, id)
			close(c)
		}
		b.mu.Unlock()
	}
}

// publish delivers ev to every subscriber without ever blocking. If a
// subscriber's buffer is full, drop its oldest queued event and enqueue the new
// one (best-effort, newest-wins).
func (b *eventBus) publish(ev Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, ch := range b.subs {
		select {
		case ch <- ev:
		default:
			// Buffer full: drop the oldest, then try once more (still non-blocking).
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- ev:
			default:
			}
		}
	}
}
