# Infisical Secrets Checklist for ai-grija.ro

## Quick Reference: What Should Be in Infisical

### Category 1: CRITICAL — Must Have (Used on Every Request)
These secrets are required for core functionality. Deployment will fail if missing.

```
[ ] ADMIN_API_KEY           — Admin endpoint protection
[ ] GOOGLE_SAFE_BROWSING_KEY — URL safety checking
[ ] VIRUSTOTAL_API_KEY      — Malware detection
```

### Category 2: IMPORTANT — Messaging/Alerts
These enable communication channels.

```
[ ] TELEGRAM_BOT_TOKEN      — Telegram bot auth
[ ] TELEGRAM_WEBHOOK_SECRET — Telegram webhook verification
[ ] TELEGRAM_ADMIN_CHAT_ID  — Internal alerts (semi-secret)
[ ] WHATSAPP_ACCESS_TOKEN   — WhatsApp API auth
[ ] WHATSAPP_VERIFY_TOKEN   — WhatsApp webhook verification
[ ] WHATSAPP_APP_SECRET     — WhatsApp webhook signing
[ ] WHATSAPP_PHONE_NUMBER_ID — WhatsApp bot phone
```

### Category 3: OPTIONAL BUT USED — Content & Email
These provide extended features. Missing one won't crash the app.

```
[ ] BUTTONDOWN_API_KEY      — Newsletter subscription
[ ] SANITY_PROJECT_ID       — CMS read/write
[ ] SANITY_DATASET          — CMS dataset name
[ ] SANITY_WRITE_TOKEN      — CMS content publishing
[ ] SANITY_WEBHOOK_SECRET   — CMS webhook verification
[ ] URLHAUS_AUTH_KEY        — Malware DB (optional fallback)
```

### Category 4: NOT USED — Cleanup Candidates
These are declared in code but never called. Should be removed.

```
[ ] PHISHTANK_API_KEY       — REMOVE from types.ts
[ ] LAUNCHDARKLY_SDK_KEY    — REMOVE from types.ts
[ ] CF_ACCESS_TEAM_DOMAIN   — REMOVE from types.ts
```

### Category 5: Non-Secrets — Don't Store in Infisical
These are configuration and safe to hardcode.

```
✓ BASE_URL = "https://ai-grija.ro"
✓ CORS_ORIGINS (defaults provided in code)
```

---

## Infisical Project Details

**Project ID**: e0b19aba-bb80-4118-90ab-3a7fd5ecabfd
**URL**: https://sec.zp.digital

**Environments to Check**:
1. `dev` — local development (can use sandbox/test credentials)
2. `test` (aka preview) — pre.ai-grija.ro (partial production data, test bots)
3. `prod` — ai-grija.ro (live production secrets)

---

## How to Verify Alignment

### Step 1: Check Infisical
List all secrets for each environment:
```bash
mcp__infisical__list-secrets(projectId="e0b19aba-bb80-4118-90ab-3a7fd5ecabfd", environmentSlug="prod")
```

### Step 2: Compare to Code
Code expects these (from `/Users/vvladescu/Desktop/aigrija/OUT-REPO/src/worker/lib/types.ts`):
- ADMIN_API_KEY
- GOOGLE_SAFE_BROWSING_KEY
- VIRUSTOTAL_API_KEY
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- TELEGRAM_ADMIN_CHAT_ID
- WHATSAPP_VERIFY_TOKEN
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_APP_SECRET
- BUTTONDOWN_API_KEY
- SANITY_PROJECT_ID
- SANITY_DATASET
- SANITY_WRITE_TOKEN
- SANITY_WEBHOOK_SECRET
- URLHAUS_AUTH_KEY

### Step 3: Fix Gaps
If a secret is missing from Infisical:
```bash
mcp__infisical__create-secret(
  secretName="SECRET_NAME",
  secretValue="actual_value_here",
  projectId="e0b19aba-bb80-4118-90ab-3a7fd5ecabfd",
  environment="prod"
)
```

Then push to Cloudflare:
```bash
npx wrangler secret put SECRET_NAME --env production
```

---

## Environment-Specific Notes

| Secret | dev | test/preview | prod | Notes |
|--------|-----|--------------|------|-------|
| ADMIN_API_KEY | test key | test key | production key | Different per environment |
| TELEGRAM_* | sandbox bot | sandbox bot | production bot | Different bots |
| WHATSAPP_* | sandbox phone | sandbox phone | production phone | Different accounts |
| GOOGLE_SAFE_BROWSING_KEY | can be same | can be same | must be same | API key works across envs |
| VIRUSTOTAL_API_KEY | can be same | can be same | must be same | API key works across envs |
| SANITY_* | test project | test project | production project | Different CMS projects |

---

## Red Flags to Check For

- [ ] Any secret with value `"REPLACE_ME"` or `"PLACEHOLDER"`
- [ ] Any secret that's empty string `""`
- [ ] Secrets that look truncated (too short for valid tokens)
- [ ] Secrets not rotated in >90 days (check Infisical audit log)
- [ ] Test secrets accidentally in production environment
- [ ] Production secrets accidentally in development environment

---

## Related Files

- **Type Definitions**: `/Users/vvladescu/Desktop/aigrija/OUT-REPO/src/worker/lib/types.ts`
- **Usage Examples**: 
  - Telegram: `/Users/vvladescu/Desktop/aigrija/OUT-REPO/src/worker/routes/telegram.ts`
  - WhatsApp: `/Users/vvladescu/Desktop/aigrija/OUT-REPO/src/worker/routes/whatsapp.ts`
  - Admin: `/Users/vvladescu/Desktop/aigrija/OUT-REPO/src/worker/routes/admin-flags.ts`
- **Full Audit Report**: `/Users/vvladescu/Desktop/aigrija/OUT-REPO/docs/INFISICAL_AUDIT.md`

