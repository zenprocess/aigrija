# ADR-0014: Strict Environment Isolation

## Status
Accepted

## Date
2026-03-02

## Context
During development, a local session accidentally executed D1 queries against the production database using `wrangler d1 execute --remote`. This is dangerous — local development must never touch production resources.

## Decision
**Environments are strictly isolated. Local development NEVER touches production.**

### Rules
1. `wrangler dev` runs with **local** bindings only (D1, KV, R2 are local simulators)
2. `wrangler d1 execute --remote` is **forbidden** from local machines — only CI/CD may run remote migrations
3. `wrangler deploy` is the **only** way code reaches production — via CI/CD pipeline
4. Cron jobs are tested locally via `/cdn-cgi/handler/scheduled` against local D1
5. To test with real AI, use `[ai] remote = true` in wrangler.toml (AI is stateless, safe to call remotely)
6. Production data access is via the admin dashboard (admin.ai-grija.ro) only, behind CF Access

### Environment Matrix
| Environment | D1 | KV | R2 | AI | Access |
|-------------|----|----|----|----|--------|
| Local (`wrangler dev`) | local | local | local | remote | localhost |
| Preview (`--env preview`) | preview DB | preview KV | preview R2 | remote | pre.ai-grija.ro |
| Production | prod DB | prod KV | prod R2 | remote | ai-grija.ro |

## Consequences
- Developers must run migrations locally first, then via CI/CD for preview/prod
- No shortcuts: if you need prod data for debugging, export via admin dashboard
- CI/CD workflows use `CLOUDFLARE_API_TOKEN` secret scoped per environment
