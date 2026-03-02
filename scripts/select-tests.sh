#!/usr/bin/env bash
# Determines which test tags to run based on changed files.
# Usage: scripts/select-tests.sh <base-sha>
# Output: comma-separated tags (empty string = run all)
set -euo pipefail

BASE_SHA="${1:-HEAD~1}"

# Try three-dot diff, then two-dot, then fall back to run all tests
if git cat-file -e "$BASE_SHA" 2>/dev/null; then
  CHANGED_FILES=$(git diff --name-only "$BASE_SHA"...HEAD 2>/dev/null || git diff --name-only "$BASE_SHA" HEAD 2>/dev/null || true)
else
  echo ""
  exit 0
fi
FILE_COUNT=$(echo "$CHANGED_FILES" | grep -c . || true)

# If >5 files changed, run everything
if [ "$FILE_COUNT" -gt 5 ]; then
  echo ""
  exit 0
fi

TAGS=""

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    src/worker/routes/*|src/worker/middleware/*) TAGS="$TAGS,api" ;;
    src/ui/*) TAGS="$TAGS,smoke,a11y" ;;
    src/worker/admin/*) TAGS="$TAGS,admin" ;;
    src/worker/lib/*) TAGS="$TAGS,critical,api" ;;
    e2e/*|playwright.config.ts) echo ""; exit 0 ;;  # test infra = run all
    wrangler.toml|infra/*) TAGS="$TAGS,smoke,api" ;;
  esac
done <<< "$CHANGED_FILES"

# Always include smoke
TAGS="smoke,$TAGS"

# Deduplicate and clean
TAGS=$(echo "$TAGS" | tr ',' '
' | sort -u | grep -v '^$' | tr '
' ',' | sed 's/,$//')

echo "$TAGS"
