#!/usr/bin/env bash
# Vercel's "Ignored Build Step" (see ignoreCommand in vercel.json). Exit 0 skips the build, exit 1 builds.
# It skips only when it can prove nothing the site depends on changed since the last build: the site folder,
# and the root package.json (its version appears in the site's metadata). Anything doubtful builds.
# Vercel runs it from the project's root directory, site/.
set -u

base="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  echo "No earlier build to compare with: building."
  exit 1
fi

if git diff --quiet "$base" HEAD -- . ../package.json; then
  echo "Nothing the site depends on changed since ${base}: skipping the build."
  exit 0
fi

echo "Site files changed since ${base}: building."
exit 1
