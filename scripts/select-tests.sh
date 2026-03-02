#!/usr/bin/env bash
# Determines which test tags to run based on changed files.
# Reads path-to-tag mappings from .github/test-mapping.yml.
# Usage: scripts/select-tests.sh <base-sha>
# Output: comma-separated tags (empty string = run all)
set -euo pipefail

BASE_SHA="${1:-HEAD~1}"
MAPPING_FILE="$(dirname "$0")/../.github/test-mapping.yml"

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

# Require yq for YAML parsing
if ! command -v yq &>/dev/null; then
  echo "ERROR: yq is required (https://github.com/mikefarah/yq)" >&2
  exit 1
fi

# Count mappings
MAPPING_COUNT=$(yq '.mappings | length' "$MAPPING_FILE")

TAGS=""
RUN_ALL=0

while IFS= read -r file; do
  [ -z "$file" ] && continue

  for i in $(seq 0 $((MAPPING_COUNT - 1))); do
    PATTERN_COUNT=$(yq ".mappings[$i].paths | length" "$MAPPING_FILE")

    for j in $(seq 0 $((PATTERN_COUNT - 1))); do
      PATTERN=$(yq -r ".mappings[$i].paths[$j]" "$MAPPING_FILE")

      # shellcheck disable=SC2254
      if [[ "$file" == $PATTERN ]]; then
        TAG_COUNT=$(yq ".mappings[$i].tags | length" "$MAPPING_FILE")
        if [ "$TAG_COUNT" -eq 0 ]; then
          RUN_ALL=1
          break 2
        fi
        for k in $(seq 0 $((TAG_COUNT - 1))); do
          TAG=$(yq -r ".mappings[$i].tags[$k]" "$MAPPING_FILE")
          TAGS="$TAGS,$TAG"
        done
        break
      fi
    done
  done
done <<< "$CHANGED_FILES"

if [ "$RUN_ALL" -eq 1 ]; then
  echo ""
  exit 0
fi

# Always include smoke
TAGS="smoke,$TAGS"

# Deduplicate and clean
TAGS=$(echo "$TAGS" | tr ',' '\n' | sort -u | grep -v '^$' | tr '\n' ',' | sed 's/,$//')

echo "$TAGS"
