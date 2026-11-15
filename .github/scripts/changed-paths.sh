#!/usr/bin/env bash
# Decides which parts of CI a change needs. Reads changed file paths on stdin, one per line, and prints
#   extension=true|false   build both browsers and run the end-to-end tests
#   site=true|false        build and check the website
# Format, lint, types and unit tests always run (they are quick and prettier checks every file), so they are not decided here.
#
#   git diff --name-only "$BASE" HEAD | .github/scripts/changed-paths.sh >> "$GITHUB_OUTPUT"
#
# Tested by scripts/changed-paths.test.mjs. Anything under .github/ turns everything on, because a changed
# workflow or script can break either part.
set -euo pipefail

extension=false
site=false

while IFS= read -r path || [ -n "$path" ]; do
  case "$path" in
    '') ;;
    .github/*) extension=true; site=true ;;
    # The version in package.json feeds the website's structured data and llms.txt.
    package.json) extension=true; site=true ;;
    site/*) site=true ;;
    components/* | lib/* | entrypoints/* | public/* | styles/* | e2e/* | scripts/*) extension=true ;;
    wxt.config.ts | pnpm-lock.yaml | tsconfig.json | vitest.config.ts | .nvmrc) extension=true ;;
  esac
done

echo "extension=$extension"
echo "site=$site"
