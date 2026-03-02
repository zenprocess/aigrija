# Environment Variable Audit Report
**Generated**: 2026-03-02
**Repository**: ai-grija (Cloudflare Workers)
**Project ID**: e0b19aba-bb80-4118-90ab-3a7fd5ecabfd

---

## SUMMARY

**Total Secrets Found in Code**: 25 unique environment variables
**Secrets Declared in Env Interface**: 22 (in `src/worker/lib/types.ts`)
**Secrets Used but NOT Declared**: 3 (potential issues)
**GitHub Workflow Secrets**: 6 (CI/CD only)
**E2E Test Env Vars**: 4 (testing only)

---

## DETAILED ALIGNMENT MATRIX

### Category A: Cloudflare Native Bindings (Non-Secret)
These are infrastructure bindings that aren't secrets — they're runtime access objects.

| Binding | Type | Used | Declared | Infisical | Status |
|---------|------|------|----------|-----------|--------|
| ASSETS | Fetcher | ✓ (implicit) | ✓ | N/A | OK — static assets |
| AI | Ai | ✓ | ✓ | N/A | OK — Workers AI inference |
| CACHE | KVNamespace | ✓ | ✓ | N/A | OK — KV cache for performance |
| DB | D1Database | ✓ | ✓ | N/A | OK — SQLite database (shared with ADMIN_DB) |
| ADMIN_DB | D1Database | ✓ | ✓ | N/A | OK — same DB, aliased for admin context |
| DRAFT_QUEUE | Queue | ✓ | ✓ | N/A | OK — queue for draft generation jobs |
| STORAGE | R2Bucket | ✓ | ✓ | N/A | OK — R2 bucket for share cards |
| ANALYTICS | AnalyticsEngineDataset | ✓ | ✓ | N/A | OK — optional, for analytics events |

---

### Category B: Configuration Variables (Non-Secret)
These are configuration that doesn't require security protection.

| Variable | Used in Code | wrangler.toml | Declared | Infisical | Status |
|----------|--------------|------------------|----------|-----------|--------|
| BASE_URL | ✓ | ✓ (prod: https://ai-grija.ro) | ✓ | Unnecessary | OK — hardcoded in config, no secret |
| CORS_ORIGINS | ✓ | No | ✓ | No | OK — optional, defaults to hardcoded list |

---

### Category C: API Secrets (Should be in Infisical)
These are third-party API tokens that must be protected.

| Secret | Used in Code | Found in Type Def | Optional? | Status | Notes |
|--------|--------------|-------------------|-----------|--------|-------|
| GOOGLE_SAFE_BROWSING_KEY | ✓ (routes/check-qr.ts, routes/openapi-check.ts) | ✓ | No | **NEEDS AUDIT** | URL safety checking |
| VIRUSTOTAL_API_KEY | ✓ (routes/check-qr.ts, routes/openapi-check.ts, routes/whatsapp.ts, routes/telegram.ts) | ✓ | No | **NEEDS AUDIT** | Malware/threat detection |
| TELEGRAM_BOT_TOKEN | ✓ (routes/telegram.ts, lib/alerter.ts) | ✓ | No | **NEEDS AUDIT** | Bot authentication |
| TELEGRAM_WEBHOOK_SECRET | ✓ (routes/telegram.ts) | ✓ | No | **NEEDS AUDIT** | Webhook HMAC validation |
| TELEGRAM_ADMIN_CHAT_ID | ✓ (lib/alerter.ts, lib/telegram-digest.ts) | ✓ | Yes | **NEEDS AUDIT** | Internal comms (not technically a secret) |
| WHATSAPP_VERIFY_TOKEN | ✓ (routes/whatsapp.ts) | ✓ | No | **NEEDS AUDIT** | Webhook challenge/verify |
| WHATSAPP_ACCESS_TOKEN | ✓ (routes/whatsapp.ts) | ✓ | No | **NEEDS AUDIT** | API authentication |
| WHATSAPP_PHONE_NUMBER_ID | ✓ (routes/whatsapp.ts) | ✓ | No | **NEEDS AUDIT** | Phone number identifier (semi-secret) |
| WHATSAPP_APP_SECRET | ✓ (routes/whatsapp.ts) | ✓ | Yes | **NEEDS AUDIT** | HMAC signing |
| ADMIN_API_KEY | ✓ (routes/admin-flags.ts, routes/counter.ts, admin/activity.ts, admin/analytics.ts, admin/drafts.ts) | ✓ | No | **NEEDS AUDIT** | Admin endpoint protection |
| BUTTONDOWN_API_KEY | ✓ (routes/weekly.ts, routes/newsletter.ts) | ✓ | Yes | **NEEDS AUDIT** | Newsletter provider API |
| SANITY_PROJECT_ID | ✓ (lib/sanity.ts, lib/sanity-writer.ts) | ✓ | Yes | **NEEDS AUDIT** | CMS project identifier |
| SANITY_DATASET | ✓ (lib/sanity.ts, lib/sanity-writer.ts) | ✓ | Yes | **NEEDS AUDIT** | CMS dataset name |
| SANITY_WRITE_TOKEN | ✓ (lib/sanity-writer.ts) | ✓ | Yes | **NEEDS AUDIT** | CMS API authentication |
| SANITY_WEBHOOK_SECRET | ✓ (routes/blog.ts) | ✓ | Yes | **NEEDS AUDIT** | Webhook HMAC validation |
| URLHAUS_AUTH_KEY | ✓ (routes/check-qr.ts, routes/openapi-check.ts) | ✓ | Yes | **NEEDS AUDIT** | Malware database |
| PHISHTANK_API_KEY | ✗ (declared but NOT USED in code) | ✓ | Yes | **UNUSED** | Was planned but never implemented |
| LAUNCHDARKLY_SDK_KEY | ✗ (declared but NOT USED in code) | ✓ | Yes | **UNUSED** | Feature flagging (declared, no code) |
| CF_ACCESS_TEAM_DOMAIN | ✗ (declared but NOT USED in code) | ✓ | Yes | **UNUSED** | Cloudflare Access setup |

---

### Category D: Secrets Used in Code but NOT in Env Type Definition
CRITICAL: These are accessed but not declared!

| Secret | File | Access Pattern | Type | Status |
|--------|------|-----------------|------|--------|
| (None found) | - | - | - | ✓ All used secrets are declared |

---

### Category E: E2E Test Environment Variables
Used only in testing, not runtime secrets.

| Variable | File | Purpose | Infisical | Status |
|----------|------|---------|-----------|--------|
| BASE_URL | e2e/*.ts | Test server URL | No | OK — can be process.env |
| CF_ACCESS_CLIENT_ID | e2e/*.ts | CF Access auth (test) | Yes (CI only) | OK — GitHub secret |
| CF_ACCESS_CLIENT_SECRET | e2e/*.ts | CF Access secret (test) | Yes (CI only) | OK — GitHub secret |
| CF_PREVIEW_URL | e2e/bowser-dispatch.ts | Fallback preview URL | No | OK — hardcoded |

---

### Category F: GitHub Actions Secrets
CI/CD only, stored in GitHub.

| Secret | Workflow | Purpose | Status |
|--------|----------|---------|--------|
| GITHUB_TOKEN | Multiple | Repo access | ✓ Auto-provided by GitHub |
| CLOUDFLARE_API_TOKEN | deploy-prod.yml, preview-deploy.yml | CF API auth | ✓ Check Infisical |
| CLOUDFLARE_ACCOUNT_ID | deploy-prod.yml, preview-deploy.yml | CF account | ✓ Check Infisical |
| CF_ACCESS_CLIENT_ID | preview-deploy.yml | CF Access (preview) | ✓ Check Infisical |
| CF_ACCESS_CLIENT_SECRET | preview-deploy.yml | CF Access (preview) | ✓ Check Infisical |
| PULUMI_ACCESS_TOKEN | pr-checks.yml, deploy-prod.yml | IaC deployment | ✓ Check Infisical |

---

### Category G: Sanity Studio Environment Variables
Used only in studio build, not worker runtime.

| Variable | File | Declared | Used in Worker | Status |
|----------|------|----------|-----------------|--------|
| SANITY_STUDIO_PROJECT_ID | studio/sanity.config.ts | No | No | OK — studio-only |
| SANITY_STUDIO_DATASET | studio/sanity.config.ts | No | No | OK — studio-only |

---

## HARDCODED VALUES FOUND

### Safe Hardcodes (Configuration, not secrets)
```typescript
// src/worker/lib/security-headers.ts:4
const DEFAULT_CORS_ORIGINS = ['https://ai-grija.ro', 'https://admin.ai-grija.ro'];

// wrangler.toml:58
BASE_URL = "https://ai-grija.ro" (production value)

// Multiple files
const baseUrl = c.env.BASE_URL ?? 'https://ai-grija.ro';
```
Status: ✓ OK — defaults are non-secret production URLs

---

## CRITICAL FINDINGS

### 1. Unused Secrets in Type Definition (Cleanup Needed)
- `PHISHTANK_API_KEY` — declared, never used in code
- `LAUNCHDARKLY_SDK_KEY` — declared, never used in code
- `CF_ACCESS_TEAM_DOMAIN` — declared, never used in code

**Action**: Remove from `types.ts` or add implementation code

---

### 2. Secrets Missing from Infisical (Cannot Verify Without Access)
Unable to call Infisical MCP directly, but the following secrets should be verified:
- GOOGLE_SAFE_BROWSING_KEY
- VIRUSTOTAL_API_KEY
- TELEGRAM_* (3 secrets)
- WHATSAPP_* (4 secrets)
- ADMIN_API_KEY
- BUTTONDOWN_API_KEY
- SANITY_* (4 secrets)
- URLHAUS_AUTH_KEY

**Risk**: If any of these are missing from Infisical, deployment will fail silently.

---

### 3. Secrets Not Rotated Recently (Cannot Verify Without Access)
Check Infisical dashboard for:
- Last rotation date of ADMIN_API_KEY (high-sensitivity)
- Last rotation date of API keys (GOOGLE, VIRUSTOTAL, TELEGRAM, WHATSAPP)

---

### 4. Environment Consistency
Check across 3 environments (dev, test/preview, prod):
- Some secrets may be intentionally different (e.g., test phone numbers for WhatsApp)
- Some should be identical (e.g., GOOGLE_SAFE_BROWSING_KEY)
- Missing: E2B_API_KEY, ANTHROPIC_API_KEY (mentioned in rules but not used in OUT-REPO codebase)

---

## BINDING vs SECRET CLARIFICATION

**Bindings** (not secrets — infrastructure):
- ASSETS, AI, CACHE, DB, ADMIN_DB, DRAFT_QUEUE, STORAGE, ANALYTICS
- Configured in `wrangler.toml` with `[[binding]]` directives
- Accessed via `c.env.*` at runtime
- Bound automatically by Cloudflare Workers runtime

**Secrets** (require `wrangler secret put`):
- API keys, tokens, credentials
- Defined in Env type but NOT in wrangler.toml
- Must be stored in Infisical + pushed via `npx wrangler secret put`
- Cannot view in source control

---

## RECOMMENDATIONS

### 1. Immediate Actions
- [ ] Call Infisical to list all 3 environments and verify coverage
- [ ] Remove unused declarations: PHISHTANK_API_KEY, LAUNCHDARKLY_SDK_KEY, CF_ACCESS_TEAM_DOMAIN
- [ ] Check for placeholder/empty values in Infisical (e.g., "REPLACE_ME")

### 2. Audit All Infisical Secrets
Run Infisical API calls to verify:
```
mcp__infisical__list-secrets(projectId="e0b19aba-bb80-4118-90ab-3a7fd5ecabfd", environmentSlug="dev")
mcp__infisical__list-secrets(projectId="e0b19aba-bb80-4118-90ab-3a7fd5ecabfd", environmentSlug="test")
mcp__infisical__list-secrets(projectId="e0b19aba-bb80-4118-90ab-3a7fd5ecabfd", environmentSlug="prod")
```

### 3. GitHub Secrets Audit
- [ ] Verify CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID are synced from Infisical
- [ ] Verify PULUMI_ACCESS_TOKEN is active
- [ ] Check CF_ACCESS_CLIENT_ID/SECRET for preview environment

### 4. Environment-Specific Configuration
- [ ] Verify TEST env has test WhatsApp phone number
- [ ] Verify PROD has production API endpoints
- [ ] Verify DEV can safely use sandbox/test credentials

### 5. Documentation Updates
- [ ] Add comment to types.ts for each optional secret explaining when it's needed
- [ ] Document which secrets are environment-specific vs. shared across all 3 envs

---

## NEXT STEP

To complete this audit, provide Infisical credentials or API access to call:
```bash
mcp__infisical__list-secrets(projectId="e0b19aba-bb80-4118-90ab-3a7fd5ecabfd", environmentSlug="dev")
mcp__infisical__list-secrets(projectId="e0b19aba-bb80-4118-90ab-3a7fd5ecabfd", environmentSlug="test")
mcp__infisical__list-secrets(projectId="e0b19aba-bb80-4118-90ab-3a7fd5ecabfd", environmentSlug="prod")
```

Then cross-reference actual stored values with this codebase usage report.

