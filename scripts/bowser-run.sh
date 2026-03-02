#!/usr/bin/env bash
# Bowser Layer 1 — Playwright CLI wrapper
# Usage: bash scripts/bowser-run.sh [--spec NAME] [--story NAME] [--base-url URL] [--viewport mobile|tablet|desktop] [--headed]
# Exit codes: 0=pass, 1=fail, 2=error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SPEC=""
STORY=""
BASE_URL=""
VIEWPORT="desktop"
HEADED=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --spec)   SPEC="$2"; shift 2 ;;
    --story)  STORY="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    --viewport) VIEWPORT="$2"; shift 2 ;;
    --headed) HEADED="--headed"; shift ;;
    *) echo "[bowser] Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -n "$SPEC" && -n "$STORY" ]]; then
  echo "[bowser] ERROR: --spec and --story are mutually exclusive" >&2
  exit 2
fi

if [[ -z "$BASE_URL" ]]; then
  if [[ -n "${CF_ACCESS_CLIENT_ID:-}" ]]; then
    BASE_URL="${CF_PREVIEW_URL:-https://preview.aigrija.ro}"
  else
    BASE_URL="http://localhost:8787"
  fi
fi

export BASE_URL

if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  export PLAYWRIGHT_EXTRA_HTTP_HEADERS='{"CF-Access-Client-Id":"'"${CF_ACCESS_CLIENT_ID}"'","CF-Access-Client-Secret":"'"${CF_ACCESS_CLIENT_SECRET}"'"}'
fi

case "$VIEWPORT" in
  mobile|tablet) PROJECT_FLAG="--project=mobile" ;;
  desktop)       PROJECT_FLAG="--project=chromium" ;;
  *) echo "[bowser] Unknown viewport: $VIEWPORT (use mobile|tablet|desktop)" >&2; exit 2 ;;
esac

cd "${REPO_ROOT}"

if [[ -n "$STORY" ]]; then
  echo "[bowser] Running story: ${STORY} against ${BASE_URL}"
  npx tsx e2e/run-stories.ts "--story=${STORY}"
  exit $?
elif [[ -n "$SPEC" ]]; then
  echo "[bowser] Running spec: ${SPEC} against ${BASE_URL}"
  SPEC_PATH="e2e/${SPEC}"
  [[ ! -f "$SPEC_PATH" ]] && SPEC_PATH="e2e/${SPEC}.spec.ts"
  if [[ ! -f "$SPEC_PATH" ]]; then
    echo "[bowser] ERROR: spec file not found: ${SPEC}" >&2
    exit 2
  fi
  npx playwright test "${SPEC_PATH}" ${PROJECT_FLAG} ${HEADED} --reporter=json 2>&1
  exit $?
else
  echo "[bowser] Running all specs against ${BASE_URL}"
  npx playwright test ${PROJECT_FLAG} ${HEADED} --reporter=json 2>&1
  exit $?
fi
