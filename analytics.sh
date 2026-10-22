#!/bin/sh
set -eu

# Resolve the checkout so this command also works from another directory.
repo_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cd "$repo_dir"

case "${1:-}" in
  -h|--help)
    printf '%s\n' \
      'Usage: ./analytics.sh [dashboards|traffic|collections] [--print] [--notes PATH]' \
      'Opens the dashboard list by default, or the selected report in your browser.' \
      'Reads dashboard links from the private operations note. Requires npm install first.'
    exit 0
    ;;
  ''|-*) set -- dashboards "$@" ;;
esac

exec node --import tsx scripts/open-analytics.ts "$@"
