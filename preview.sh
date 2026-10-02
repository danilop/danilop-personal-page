#!/usr/bin/env bash
set -e

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

required_node="v$(tr -d '[:space:]' < .nvmrc)"
if [[ "$(node --version 2>/dev/null || true)" != "$required_node" ]]; then
  nvm_script="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ -s "$nvm_script" ]]; then
    # shellcheck source=/dev/null
    source "$nvm_script" --no-use
  fi
  if command -v nvm >/dev/null 2>&1; then
    nvm use
  fi
fi

if [[ "$(node --version 2>/dev/null || true)" != "$required_node" ]]; then
  printf 'Preview requires Node %s (see .nvmrc). Install it with nvm install, then try again.\n' "$required_node" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  printf 'npm is missing. Follow the development setup in README.md, then try again.\n' >&2
  exit 1
fi

exec npm run preview -- --watch --open "$@"
