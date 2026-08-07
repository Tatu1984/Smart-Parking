package publisher

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestEventBusDeliversToSubscribers(t *testing.T) {
	b := newEventBus()
	ch, unsub := b.subscribe(8)
	defer unsub()

	b.publish(Event{Type: EventCameraOnline, CameraID: "c1"})
	select {
	case ev := <-ch:
		if ev.Type != EventCameraOnline || ev.CameraID != "c1" {
			t.Errorf("unexpected event: %+v", ev)
		}
	case <-time.After(time.Second):
		t.Fatal("no event received")
	}
}

func TestEventBusNeverBlocksOnFullSubscriber(t *testing.T) {
	// A subscriber that never drains must NOT block publish (the core guarantee:
	// event delivery cannot stall the engine). Fill past the buffer and ensure
	// publish returns promptly every time.
	b := newEventBus()
	_, unsub := b.subscribe(4) // never read from this channel
	defer unsub()

	done := make(chan struct{})
	go func() {
		for i := 0; i < 10000; i++ {
			b.publish(Event{Type: EventCameraReconnect, CameraID: "c1"})
		}
		close(done)
	}()
	select {
	case <-done: // completed without blocking → drop-oldest works
	case <-time.After(3 * time.Second):
		t.Fatal("publish blocked on a full/slow subscriber (must never happen)")
	}
}

func TestEventBusDropsOldestNewestWins(t *testing.T) {
	b := newEventBus()
	ch, unsub := b.subscribe(2)
	defer unsub()

	// Publish 3 into a buffer of 2 with no reader → oldest dropped.
	b.publish(Event{Type: EventCameraOnline, CameraID: "1"})
	b.publish(Event{Type: EventCameraOnline, CameraID: "2"})
	b.publish(Event{Type: EventCameraOnline, CameraID: "3"})

	got := []string{}
	for len(ch) > 0 {
		got = append(got, (<-ch).CameraID)
	}
	// The newest must be present; the oldest ("1") should have been dropped.
	if len(got) == 0 || got[len(got)-1] != "3" {
		t.Errorf("expected newest event '3' retained, got %v", got)
	}
	for _, id := range got {
		if id == "1" {
			t.Errorf("oldest event should have been dropped, got %v", got)
		}
	}
}

func TestEventBusConcurrentPublishSubscribe(t *testing.T) {
	// Race-oriented: many publishers + subscribe/unsubscribe churn.
	b := newEventBus()
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 500; j++ {
				b.publish(Event{Type: EventCameraOnline, CameraID: "x"})
			}
		}()
	}
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ch, unsub := b.subscribe(16)
			for j := 0; j < 100; j++ {
				select {
				case <-ch:
				default:
				}
			}
			unsub()
		}()
	}
	wg.Wait()
}

func TestSupervisorEventsOnLifecycle(t *testing.T) {
	s := NewSupervisor(multiCamConfig(), quietLogger(), nil)
	evs, unsub := s.Events(64)
	defer unsub()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	waitFor(t, 3*time.Second, func() bool { return s.IsRunning("cam-a") })

	// Collect events for a moment; expect at least an offline/reconnect for the
	// unreachable cameras (they can't connect to 127.0.0.1:1).
	seen := map[EventType]bool{}
	deadline := time.After(4 * time.Second)
loop:
	for {
		select {
		case ev := <-evs:
			seen[ev.Type] = true
			if seen[EventCameraOffline] || seen[EventCameraReconnect] {
				break loop
			}
		case <-deadline:
			break loop
		}
	}
	if !seen[EventCameraOffline] && !seen[EventCameraReconnect] {
		t.Errorf("expected offline/reconnect events for unreachable cameras, saw %v", seen)
	}

	cancel()
	waitClosed(t, done, 15*time.Second)
}
