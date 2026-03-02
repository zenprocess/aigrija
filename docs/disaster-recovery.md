# Disaster Recovery Runbook — ai-grija.ro

## 1. Infrastructure Overview

| Component | Provider | Backup Strategy |
|-----------|----------|-----------------|
| Worker code | Cloudflare Workers | Git repo (zenprocess/aigrija) |
| KV (cache, flags, rate limits) | Cloudflare KV | Ephemeral — rebuilt on deploy |
| R2 (share cards, images) | Cloudflare R2 | Cross-region replication (auto) |
| D1 (analytics, activity log) | Cloudflare D1 | Daily export via wrangler d1 export |
| Secrets | Infisical | Infisical manages versioning |
| DNS | Cloudflare | Managed via dashboard/API |

## 2. Backup Procedures

### D1 Database (Daily)

```bash
npx wrangler d1 export aigrija-db --output=backups/d1-$(date +%Y%m%d).sql
sqlite3 :memory: < backups/d1-$(date +%Y%m%d).sql ".tables"
```

### R2 Objects (Weekly)

```bash
npx wrangler r2 object list aigrija-storage --prefix="" | \
  jq -r '.[] | .key' | \
  xargs -I{} npx wrangler r2 object get aigrija-storage/{} --file=backups/r2/{}
```

## 3. Incident Response

| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| P1 | Service down | 15 min | Worker crash, DNS failure |
| P2 | Degraded | 1 hour | AI model timeout, R2 unavailable |
| P3 | Minor issue | 4 hours | Slow responses, stale cache |
| P4 | Cosmetic | Next sprint | OG image rendering glitch |

### P1 — Full Outage

1. Verify: `curl -s https://ai-grija.ro/api/health | jq .status`
2. Check Cloudflare Status: https://www.cloudflarestatus.com/
3. Check Worker logs: `npx wrangler tail --format=json`
4. Rollback: `npx wrangler deployments list` then `npx wrangler rollback <id>`

### Secret Leak Detected

1. Rotate immediately
2. Revoke old credential at provider
3. Store new: `mcp__infisical__create-secret`
4. Bind: `npx wrangler secret put KEY_NAME`
5. Scrub history: `bfg --replace-text passwords.txt`

## 4. Restore Procedures

### D1: `npx wrangler d1 execute aigrija-db --file=backups/d1-YYYYMMDD.sql`

### Full Redeploy

```bash
git clone git@github.com:zenprocess/aigrija.git
cd aigrija/OUT-REPO && npm install
npx vitest run && npx wrangler deploy
```

## 5. Testing

| Test | Frequency |
|------|-----------|
| D1 backup/restore | Monthly |
| Worker rollback | Quarterly |
| Secret rotation | On each rotation |
| Health endpoint | Continuous |
