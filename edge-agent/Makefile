# SParking Edge Agent — build targets.
# Produces a static binary; cross-compile for on-site hardware (amd64 / ARM).

BINARY := edge-agent
PKG    := ./cmd/edge-agent
VERSION ?= $(shell git describe --tags --always 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: build test vet clean cross

build:
	CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY) $(PKG)

test:
	go test ./...

vet:
	go vet ./...

# Cross-compile for common on-site targets (mini-PC amd64, Raspberry Pi arm64/arm).
cross:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-linux-amd64 $(PKG)
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-linux-arm64 $(PKG)
	CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-linux-armv7 $(PKG)

clean:
	rm -rf bin
