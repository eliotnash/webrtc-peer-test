#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CLI_DIR="$ROOT_DIR/cli"
OUTPUT_DIR="$ROOT_DIR/signaling/public/download"
CACHE_DIR="$ROOT_DIR/.go-cache"

mkdir -p "$OUTPUT_DIR" "$CACHE_DIR/mod" "$CACHE_DIR/build"

docker run --rm \
  -e GOPROXY="${GOPROXY:-https://goproxy.cn,direct}" \
  -e GOMODCACHE=/cache/mod \
  -e GOCACHE=/cache/build \
  -v "$CACHE_DIR:/cache" \
  -v "$CLI_DIR:/src" \
  -v "$OUTPUT_DIR:/out" \
  -w /src golang:1.24-alpine sh -c '
    go mod tidy
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/webrtc-test-linux-amd64 .
    CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o /out/webrtc-test-linux-arm64 .
    CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/webrtc-test-windows-amd64.exe .
    CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/webrtc-test-macos-amd64 .
    CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o /out/webrtc-test-macos-arm64 .
  '

echo "CLI 构建完成：$OUTPUT_DIR"
