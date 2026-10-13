#!/usr/bin/env bash
# Explicit CI bootstrap; authoring/release never install or update software.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ "$(uname -sm)" != "Linux x86_64" ]]; then
  echo 'This installer supports Linux x86_64 CI only; see docs/asset-release-design.md.' >&2
  exit 1
fi
version=$(node -p 'require("./core/aws-cli-version.json").tested')
checksum=$(node -p 'require("./core/aws-cli-version.json").linuxX64Sha256')
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl --fail --location --silent --show-error --retry 3 \
  "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-${version}.zip" -o "$work/aws.zip"
echo "$checksum  $work/aws.zip" | sha256sum --check --status
unzip -q "$work/aws.zip" -d "$work"
"$work/aws/install" --install-dir "$PWD/.cache/aws-cli" --bin-dir "$PWD/.cache/aws-cli-bin" --update
if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "$PWD/.cache/aws-cli-bin" >> "$GITHUB_PATH"
fi
"$PWD/.cache/aws-cli-bin/aws" --version
