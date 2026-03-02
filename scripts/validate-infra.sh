#!/usr/bin/env bash
set -euo pipefail

WRANGLER="wrangler.toml"
ERRORS=0

# Check all cron triggers in code have matching wrangler.toml entries
CRON_HANDLERS=$(grep -cE "if.*event\.cron.*===" src/worker/lib/cron-handler.ts 2>/dev/null || echo 0)
CRON_CONFIG=$(grep -oP "\"[0-9]+ [0-9]+ [*0-9]+ [*0-9]+ [*0-9]+\"" "$WRANGLER" | wc -l | xargs)
if [ "$CRON_HANDLERS" -gt "$CRON_CONFIG" ]; then
  echo "ERROR: cron-handler.ts has $CRON_HANDLERS schedules but wrangler.toml only has $CRON_CONFIG"
  ERRORS=$((ERRORS + 1))
fi

# Check required bindings exist
for BINDING in CACHE STORAGE DB ADMIN_DB AI DRAFT_QUEUE ANALYTICS; do
  if ! grep -q "binding = \"$BINDING\"" "$WRANGLER"; then
    echo "ERROR: Missing binding $BINDING in wrangler.toml"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check preview env mirrors prod bindings
for BINDING in CACHE STORAGE DB ADMIN_DB AI DRAFT_QUEUE ANALYTICS; do
  if ! grep -A2 'env.preview' "$WRANGLER" | grep -q "$BINDING" && ! grep -q "env.preview.*$BINDING" "$WRANGLER"; then
    # More thorough check
    if ! grep -c "binding = \"$BINDING\"" "$WRANGLER" | grep -q "2"; then
      echo "WARN: Binding $BINDING may be missing in preview env"
    fi
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS infrastructure validation errors"
  exit 1
fi

echo "OK: Infrastructure validation passed"
