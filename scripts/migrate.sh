#!/usr/bin/env bash
# migrate.sh — Run D1 migrations for ai-grija.ro
#
# Usage:
#   ./scripts/migrate.sh [--env preview] [--down <NNNN>] [--dry-run]
#
# Options:
#   --env preview    Target preview D1 database (default: production)
#   --down NNNN      Apply rollback for migration number NNNN (e.g. --down 0003)
#   --dry-run        Print commands without executing
#
# Examples:
#   ./scripts/migrate.sh
#   ./scripts/migrate.sh --env preview
#   ./scripts/migrate.sh --down 0004
#   ./scripts/migrate.sh --dry-run

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
DB_NAME="ai-grija-admin"
ENV_FLAG=""
DOWN_VERSION=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)      ENV_FLAG="--env $2"; shift 2 ;;
    --down)     DOWN_VERSION="$2";   shift 2 ;;
    --dry-run)  DRY_RUN=true;        shift   ;;
    *)          echo "Unknown argument: $1"; exit 1 ;;
  esac
done

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    echo "+ $*"
    "$@"
  fi
}

# Rollback mode
if [[ -n "$DOWN_VERSION" ]]; then
  PATTERN="$MIGRATIONS_DIR/${DOWN_VERSION}_*.down.sql"
  MATCHES=($PATTERN)
  if [[ ${#MATCHES[@]} -eq 0 ]] || [[ ! -f "${MATCHES[0]}" ]]; then
    echo "ERROR: no .down.sql found for version $DOWN_VERSION in $MIGRATIONS_DIR"
    exit 1
  fi
  ROLLBACK_FILE="${MATCHES[0]}"
  echo "Rolling back: $ROLLBACK_FILE"
  run npx wrangler d1 execute "$DB_NAME" $ENV_FLAG --file="$ROLLBACK_FILE"
  echo "Rollback complete."
  exit 0
fi

# Forward migration mode
mapfile -t UP_FILES < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '[0-9][0-9][0-9][0-9]_*.sql' ! -name '*.down.sql' | sort)

if [[ ${#UP_FILES[@]} -eq 0 ]]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

for FILE in "${UP_FILES[@]}"; do
  echo "Applying: $(basename "$FILE")"
  run npx wrangler d1 execute "$DB_NAME" $ENV_FLAG --file="$FILE"
done

echo "All migrations applied."
