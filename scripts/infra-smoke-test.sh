#!/usr/bin/env bash
set -euo pipefail

# Post-deploy infrastructure smoke tests
# Run after pulumi up + wrangler deploy

BASE_URL="${1:-https://ai-grija.ro}"
ADMIN_URL="${2:-https://admin.ai-grija.ro}"
ERRORS=0

echo "=== Infrastructure Smoke Tests ==="
echo "Base: $BASE_URL"
echo "Admin: $ADMIN_URL"
echo ""

# 1. Main site responds 200
echo -n "Main site health... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then echo "OK"; else echo "FAIL ($STATUS)"; ERRORS=$((ERRORS + 1)); fi

# 2. API endpoint responds (200 on live data, 500 on empty D1 preview - both acceptable)
echo -n "API /api/alerts... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/alerts" 2>/dev/null || echo "000")
if [ "$STATUS" \!= "000" ]; then echo "OK ($STATUS)"; else echo "FAIL (timeout/no response)"; ERRORS=$((ERRORS + 1)); fi

# 3. Admin requires CF Access (should 403 without cookie)
echo -n "Admin requires auth... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_URL/" 2>/dev/null || echo "000")
if [ "$STATUS" = "403" ] || [ "$STATUS" = "302" ]; then echo "OK ($STATUS)"; else echo "FAIL ($STATUS) — expected 403 or 302"; ERRORS=$((ERRORS + 1)); fi

# 4. No admin routes on main site (401 = auth middleware active, 404 = not routed; both safe)
echo -n "No admin leak on main... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/admin/campaigns" 2>/dev/null || echo "000")
if [ "$STATUS" = "404" ] || [ "$STATUS" = "401" ]; then echo "OK ($STATUS)"; else echo "FAIL ($STATUS) — expected 401 or 404"; ERRORS=$((ERRORS + 1)); fi

# 5. OpenAPI docs accessible
echo -n "OpenAPI docs... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/docs" 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then echo "OK"; else echo "WARN ($STATUS)"; fi

# 6. Static assets served (SPA)
echo -n "SPA fallback... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nonexistent-page" 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then echo "OK (SPA fallback)"; else echo "WARN ($STATUS)"; fi

# 7. Security headers present
echo -n "Security headers... "
HEADERS=$(curl -sI "$BASE_URL/alerte" 2>/dev/null || echo "")
if echo "$HEADERS" | grep -qi "content-security-policy"; then echo "OK"; else echo "WARN — CSP missing"; fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS smoke test errors"
  exit 1
fi
echo "ALL SMOKE TESTS PASSED"
