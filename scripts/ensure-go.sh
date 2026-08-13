#!/bin/bash
set -e

GO_BIN=$(which go 2>/dev/null || echo "")

if [ -z "$GO_BIN" ]; then
  if [ ! -f /tmp/go/bin/go ]; then
    echo "Downloading and installing Go binary..."
    mkdir -p /tmp
    curl -sSL "https://go.dev/dl/go1.22.5.linux-amd64.tar.gz" | tar -xz -C /tmp
  fi
  GO_BIN="/tmp/go/bin/go"
fi

mkdir -p dist
# Remove existing binary first to avoid "text file busy" when server is running
rm -f dist/go-server

cd server-go
"$GO_BIN" build -o ../dist/go-server .
echo "Go server built successfully at dist/go-server"
