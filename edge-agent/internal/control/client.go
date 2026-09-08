package control

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/sparking/edge-agent/internal/publisher"
)

// Client calls the worker's local control API (used by the GUI).
type Client struct {
	base   string // http://127.0.0.1:PORT
	token  string
	http   *http.Client
}

// NewClient builds a client for base (host:port) + token.
func NewClient(addr, token string) *Client {
	base := addr
	if !strings.HasPrefix(base, "http") {
		base = "http://" + addr
	}
	return &Client{
		base:  strings.TrimRight(base, "/"),
		token: token,
		http:  &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *Client) req(method, path string) (*http.Request, error) {
	r, err := http.NewRequest(method, c.base+path, nil)
	if err != nil {
		return nil, err
	}
	r.Header.Set("Authorization", "Bearer "+c.token)
	return r, nil
}

// States fetches the current runtime snapshot of all cameras.
func (c *Client) States() ([]publisher.StateSnapshot, error) {
	r, err := c.req(http.MethodGet, "/states")
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("states: %s", resp.Status)
	}
	var out []publisher.StateSnapshot
	return out, json.NewDecoder(resp.Body).Decode(&out)
}

// Health fetches the structured operational summary (GET /health).
func (c *Client) Health() (*Health, error) {
	var h Health
	if err := c.getJSON("/health", &h); err != nil {
		return nil, err
	}
	return &h, nil
}

// Streams fetches the credential-free portal discovery list (GET /streams).
func (c *Client) Streams() (*StreamList, error) {
	var sl StreamList
	if err := c.getJSON("/streams", &sl); err != nil {
		return nil, err
	}
	return &sl, nil
}

// Version fetches agent/schema/ffmpeg version info (GET /version).
func (c *Client) Version() (*Version, error) {
	var v Version
	if err := c.getJSON("/version", &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// Diagnostics fetches the diagnostics snapshot. withHistory adds ?history=true.
func (c *Client) Diagnostics(withHistory bool) (*Diagnostics, error) {
	path := "/diagnostics"
	if withHistory {
		path += "?history=true"
	}
	var d Diagnostics
	if err := c.getJSON(path, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

// DownloadBundle fetches the support diagnostics zip and writes it to w.
func (c *Client) DownloadBundle(w io.Writer) error {
	r, err := c.req(http.MethodGet, "/diagnostics/bundle")
	if err != nil {
		return err
	}
	// The bundle can take a moment (log tails, zip); use a generous timeout.
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bundle: %s", resp.Status)
	}
	_, err = io.Copy(w, resp.Body)
	return err
}

func (c *Client) getJSON(path string, out any) error {
	r, err := c.req(http.MethodGet, path)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: %s", path, resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *Client) do(method, path string) error {
	r, err := c.req(method, path)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s %s: %s", method, path, resp.Status)
	}
	return nil
}

func (c *Client) StartCamera(id string) error { return c.do(http.MethodPost, "/camera/"+id+"/start") }
func (c *Client) StopCamera(id string) error  { return c.do(http.MethodPost, "/camera/"+id+"/stop") }
func (c *Client) StartAll() error             { return c.do(http.MethodPost, "/start-all") }
func (c *Client) StopAll() error              { return c.do(http.MethodPost, "/stop-all") }

// Ping reports whether the worker control API is reachable.
func (c *Client) Ping() bool {
	_, err := c.States()
	return err == nil
}

// Events opens the SSE stream and delivers events to handler until the returned
// stop func is called or the stream errors. Runs handler on its own goroutine.
func (c *Client) Events(handler func(publisher.Event)) (stop func(), err error) {
	r, err := c.req(http.MethodGet, "/events")
	if err != nil {
		return nil, err
	}
	// No client timeout for the streaming connection.
	streamClient := &http.Client{}
	resp, err := streamClient.Do(r)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("events: %s", resp.Status)
	}
	done := make(chan struct{})
	go func() {
		defer resp.Body.Close()
		sc := bufio.NewScanner(resp.Body)
		for sc.Scan() {
			select {
			case <-done:
				return
			default:
			}
			line := sc.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			var ev publisher.Event
			if json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &ev) == nil {
				handler(ev)
			}
		}
	}()
	return func() { close(done); resp.Body.Close() }, nil
}
