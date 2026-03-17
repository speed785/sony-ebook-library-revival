#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_SVG="$ROOT_DIR/public/brand-mark.svg"
ICON_DIR="$ROOT_DIR/src-tauri/icons"
ICONSET_DIR="$ICON_DIR/icon.iconset"

if ! command -v qlmanage >/dev/null 2>&1; then
  echo "qlmanage is required to render the SVG icon." >&2
  exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
  echo "iconutil is required to build icon.icns." >&2
  exit 1
fi

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

render_icon() {
  local size="$1"
  qlmanage -t -s "$size" -o "$ICONSET_DIR" "$SOURCE_SVG" >/dev/null
  mv -f "$ICONSET_DIR/brand-mark.svg.png" "$ICONSET_DIR/icon_${size}x${size}.png"
}

render_icon 16
render_icon 32
render_icon 64
render_icon 128
render_icon 256
render_icon 512
render_icon 1024

cp "$ICONSET_DIR/icon_32x32.png" "$ICONSET_DIR/icon_16x16@2x.png"
cp "$ICONSET_DIR/icon_64x64.png" "$ICONSET_DIR/icon_32x32@2x.png"
cp "$ICONSET_DIR/icon_256x256.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$ICONSET_DIR/icon_512x512.png" "$ICONSET_DIR/icon_256x256@2x.png"
cp "$ICONSET_DIR/icon_1024x1024.png" "$ICONSET_DIR/icon_512x512@2x.png"

cp "$ICONSET_DIR/icon_512x512.png" "$ICON_DIR/icon.png"
iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon.icns"

echo "Generated macOS icons in $ICON_DIR"
