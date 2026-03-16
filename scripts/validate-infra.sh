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
for BINDING in CACHE STORAGE DB AI DRAFT_QUEUE ANALYTICS; do
  if ! grep -q "binding = \"$BINDING\"" "$WRANGLER"; then
    echo "ERROR: Missing binding $BINDING in wrangler.toml"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check preview env mirrors prod bindings
for BINDING in CACHE STORAGE DB AI DRAFT_QUEUE ANALYTICS; do
  if ! grep -A2 'env.preview' "$WRANGLER" | grep -q "$BINDING" && ! grep -q "env.preview.*$BINDING" "$WRANGLER"; then
    # More thorough check
    if ! grep -c "binding = \"$BINDING\"" "$WRANGLER" | grep -q "2"; then
      echo "WARN: Binding $BINDING may be missing in preview env"
    fi
  fi
done

# ---------------------------------------------------------------------------
# R2 state bucket versioning check
# Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID env vars.
# Skips gracefully if credentials are absent (local dev without API token).
# ---------------------------------------------------------------------------
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo -n "R2 state bucket versioning... "
  VERSIONING_STATE=$(curl -sf \
    "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/ai-grija-pulumi-state/versioning" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    2>/dev/null | jq -r '.result.state // "unknown"' 2>/dev/null || echo "api-error")
  if [ "$VERSIONING_STATE" = "enabled" ]; then
    echo "OK (enabled)"
  else
    echo "WARN: versioning state='$VERSIONING_STATE' — enable it via CF Dashboard → R2 → ai-grija-pulumi-state → Settings → Versioning"
    echo "      See docs/runbook-pulumi-state.md for step-by-step instructions."
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "SKIP: R2 versioning check (set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to enable)"
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS infrastructure validation errors"
  exit 1
fi

echo "OK: Infrastructure validation passed"
