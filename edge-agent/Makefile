# SParking Edge Agent — build targets.
#
# Two binaries ship together:
#   edge-agent      the background worker (streams the camera)
#   edge-agent-gui  the control panel (Start/Stop/settings) — Fyne, needs cgo
#
# Desktop packages:
#   make windows    cross-compiled from Linux via mingw-w64  (see build/windows)
#   make macos      MUST be run on a Mac (Apple SDK)         (see build/macos)

BINARY := edge-agent
PKG    := ./cmd/edge-agent
GUIPKG := ./cmd/edge-agent-gui
VERSION ?= $(shell git describe --tags --always 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: build gui test vet clean cross windows macos

# Worker only (no cgo, builds anywhere).
build:
	CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY) $(PKG)

# GUI for the host OS. On Linux this needs X11 dev headers:
#   sudo apt install libgl1-mesa-dev xorg-dev libxxf86vm-dev
gui:
	go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-gui $(GUIPKG)

test:
	go test ./...

vet:
	go vet ./...

# Headless worker binaries for on-site Linux boxes (mini-PC, Raspberry Pi).
cross:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-linux-amd64 $(PKG)
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-linux-arm64 $(PKG)
	CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-linux-armv7 $(PKG)

# Full Windows desktop package (worker + GUI + installer).
windows:
	bash build/windows/build-windows.sh

# Full macOS desktop package (.app). RUN ON A MAC.
macos:
	bash build/macos/build-macos.sh

clean:
	rm -rf bin build/windows/dist build/macos/dist
