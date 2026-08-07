package control

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"os"
)

// Endpoint is what the worker publishes (0600 file) and the GUI reads to reach
// the control API: the bound address + the per-run token.
type Endpoint struct {
	Addr  string `json:"addr"`
	Token string `json:"token"`
}

// NewToken returns a fresh random control token.
func NewToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return "ctl_" + base64.RawURLEncoding.EncodeToString(b)
}

// WriteEndpoint writes the endpoint file (0600 — it holds the token). The worker
// calls this after binding; the GUI reads it to connect.
func WriteEndpoint(path string, ep Endpoint) error {
	data, err := json.Marshal(ep)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

// ReadEndpoint loads the endpoint file. Returns an error if the worker isn't
// running / hasn't published one.
func ReadEndpoint(path string) (Endpoint, error) {
	var ep Endpoint
	data, err := os.ReadFile(path)
	if err != nil {
		return ep, err
	}
	return ep, json.Unmarshal(data, &ep)
}

// RemoveEndpoint deletes the endpoint file (worker on shutdown).
func RemoveEndpoint(path string) { _ = os.Remove(path) }
