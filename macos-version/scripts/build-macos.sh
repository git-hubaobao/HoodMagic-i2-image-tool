#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS installer builds should run on macOS. Current system: $(uname -s)"
  echo "This script will stop before packaging to avoid producing an invalid macOS installer."
  exit 1
fi

cd "${ROOT_DIR}"

pnpm install
pnpm --filter image-tool build
pnpm --filter image-tool exec electron-builder \
  --config ../../macos-version/electron-builder.macos.yml \
  --mac dmg zip \
  --universal \
  --publish never
