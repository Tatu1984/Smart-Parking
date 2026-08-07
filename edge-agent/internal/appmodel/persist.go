package appmodel

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/sparking/edge-agent/internal/config"
)

// lockTimeout bounds how long Save waits for the config lock before reporting
// that another operation is in progress (rather than freezing).
const lockTimeout = 10 * time.Second

// maxBackups is how many timestamped config backups to retain.
const maxBackups = 5

// Save writes the model's config to path, first rotating the existing file into
// a timestamped backup (config.yaml.<stamp>.bak), keeping the last maxBackups.
// stamp is passed in (the agent has no wall clock helper in tests); callers use
// a real timestamp like "20260807-153000".
func (m *Model) Save(path, stamp string) error {
	// Serialize with any other writer (GUI/CLI) so applies never race/corrupt.
	lock, err := config.AcquireLock(path, lockTimeout)
	if err != nil {
		return err // clear "another operation in progress" message
	}
	defer lock.Release()

	// Back up the current file if it exists.
	if _, err := os.Stat(path); err == nil {
		bak := fmt.Sprintf("%s.%s.bak", path, stamp)
		if data, rerr := os.ReadFile(path); rerr == nil {
			_ = os.WriteFile(bak, data, 0o600)
			pruneBackups(path)
		}
	}
	// Validate (dry-run) then atomic write — an invalid config is never committed.
	return config.SaveValidated(path, m.cfg)
}

// Backups lists existing backup files for path, newest first.
func Backups(path string) []string {
	list := backupList(path)
	// backupList returns oldest→newest by name; reverse for newest-first.
	for i, j := 0, len(list)-1; i < j; i, j = i+1, j-1 {
		list[i], list[j] = list[j], list[i]
	}
	return list
}

// Restore loads a backup file and returns a fresh model from it (does not write;
// the caller decides whether to Save it as the live config).
func Restore(backupPath string) (*Model, error) {
	cfg, err := config.Load(backupPath)
	if err != nil {
		return nil, err
	}
	return New(cfg), nil
}

func backupList(path string) []string {
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []string
	prefix := base + "."
	for _, e := range entries {
		n := e.Name()
		if len(n) > len(prefix) && n[:len(prefix)] == prefix && filepath.Ext(n) == ".bak" {
			out = append(out, filepath.Join(dir, n))
		}
	}
	sort.Strings(out) // timestamp in the name → lexical == chronological
	return out
}

// pruneBackups keeps only the newest maxBackups backups.
func pruneBackups(path string) {
	list := backupList(path) // oldest→newest
	for len(list) > maxBackups {
		_ = os.Remove(list[0])
		list = list[1:]
	}
}
