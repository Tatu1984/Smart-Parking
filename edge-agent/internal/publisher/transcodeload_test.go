package publisher

import (
	"sync"
	"testing"
)

func TestTranscodeLoadWarnsOnceWhenBudgetExceeded(t *testing.T) {
	var l transcodeLoad
	budget := transcodeBudget()

	// Everything up to and including the budget is silent.
	for i := 1; i <= budget; i++ {
		if _, _, exceeded := l.begin(); exceeded {
			t.Fatalf("warned at %d transcodes, which is within the budget of %d", i, budget)
		}
	}

	// The first camera past the budget warns.
	active, got, exceeded := l.begin()
	if !exceeded {
		t.Fatalf("expected a warning at %d transcodes with a budget of %d", active, budget)
	}
	if got != budget {
		t.Errorf("reported budget %d, want %d", got, budget)
	}
	if active != budget+1 {
		t.Errorf("reported %d active, want %d", active, budget+1)
	}

	// Further cameras past the budget stay quiet — one warning per excursion,
	// so a site running six cameras does not log six times.
	if _, _, again := l.begin(); again {
		t.Error("warned a second time during the same excursion")
	}
}

func TestTranscodeLoadRearmsAfterDroppingBackWithinBudget(t *testing.T) {
	var l transcodeLoad
	budget := transcodeBudget()

	for i := 0; i <= budget; i++ { // one past the budget
		l.begin()
	}
	// Drop back inside the budget …
	for i := 0; i <= budget; i++ {
		l.end()
	}
	// … and a fresh excursion warns again.
	for i := 1; i <= budget; i++ {
		l.begin()
	}
	if _, _, exceeded := l.begin(); !exceeded {
		t.Error("expected the warning to re-arm after the fleet returned within budget")
	}
}

func TestTranscodeLoadEndNeverGoesNegative(t *testing.T) {
	var l transcodeLoad
	l.end() // end without a matching begin (defensive: a run that never counted)
	if l.active != 0 {
		t.Errorf("active = %d, want 0", l.active)
	}
}

func TestTranscodeLoadIsRaceFree(t *testing.T) {
	var l transcodeLoad
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			l.begin()
			l.end()
		}()
	}
	wg.Wait()
	if l.active != 0 {
		t.Errorf("active = %d after balanced begin/end, want 0", l.active)
	}
}
