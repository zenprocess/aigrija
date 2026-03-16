# ADR-0019: Latency Budgets Per Route

**Status**: accepted
**Date**: 2026-03-14
**Decision Makers**: zenprocess

## Context

ai-grija.ro serves 30+ routes with varying computational costs — from simple KV reads (health check, counter) to AI inference (phishing check, image analysis). Without documented latency budgets, performance regressions go undetected until users complain.

## Decision

Define **p95 latency budgets** per route tier. Routes are classified by computational cost.

### Route Tiers

| Tier | p95 Budget | Examples |
|------|-----------|----------|
| **Fast** (KV read, static) | 50ms | /health, /api/counter, /api/feed/latest, /api/badges, /api/stats |
| **Medium** (KV write, D1 query) | 200ms | /api/reports, /api/reports/:id/vote, /api/newsletter/subscribe, /api/digest/subscribe |
| **Slow** (AI inference) | 5000ms | /api/check, /api/check/image, /api/check-qr |
| **External** (3rd party API) | 10000ms | /webhook/telegram, /webhook/whatsapp (depends on upstream) |
| **SSR** (template render) | 500ms | /blog/:slug, /alerte/:slug, /og/:hash, /card/:hash |

### Monitoring

1. `duration_ms` is logged in every response via structured logging middleware (`chain.ts`)
2. Cloudflare Analytics Engine (`ANALYTICS` binding) records per-route latency
3. Health endpoint (`/health/deep`) tests KV/R2/D1/Queue latency individually

### Alerting Thresholds

- **Warning**: p95 > 2x budget for 5 minutes
- **Critical**: p95 > 5x budget for 1 minute
- Implementation: Cloudflare Notifications + Analytics Engine alerting (future)

## Consequences

- Teams can detect regressions by comparing against documented budgets
- AI inference routes have explicit 5s budget — users see a loading spinner
- Fast routes that exceed 50ms signal infrastructure issues (KV slowness)
- Budget violations should trigger investigation before deployment

## Constraints

- Budgets are p95, not p50 — occasional spikes are acceptable
- External tier budgets are advisory only (we don't control upstream latency)
- Budgets apply to production only — dev/preview may be slower
- Cron jobs (`scheduled` handler) are exempt from latency budgets
