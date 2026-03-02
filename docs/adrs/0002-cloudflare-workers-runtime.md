# ADR-0002: Cloudflare Workers as Sole Runtime

**Status**: accepted  
**Date**: 2026-02-15  
**Deciders**: @vvladescu  

## Context

ai-grija.ro needed a serverless platform for a Romanian anti-phishing tool with sub-100ms response times in Europe, built-in AI inference, and minimal operational overhead.

## Options Considered

1. **Cloudflare Workers** — Edge runtime, Workers AI, KV/R2/D1/Queues built-in
2. **AWS Lambda + API Gateway** — Mature, but cold starts, complex IAM, no edge AI
3. **Vercel Functions** — Good DX, but no built-in AI, limited storage primitives
4. **Self-hosted (VPS)** — Full control, but operational burden

## Decision

**Cloudflare Workers** — all compute, storage, and AI on one platform.

### Rationale

1. **Workers AI**: Llama 3.1 8B inference at the edge, no external API calls needed
2. **Sub-50ms P95**: No cold starts, always-warm isolates
3. **Integrated storage**: KV (cache), R2 (share cards), D1 (admin DB), Queues (async)
4. **European edge**: Low latency for Romanian users
5. **Zero Trust**: Built-in access control for admin panel
6. **Cost**: Free tier covers MVP; pay-per-request scales linearly

## Consequences

- Locked into CF ecosystem for storage primitives
- Workers runtime limitations (no Node.js fs, limited CPU time)
- Hono chosen as router (Workers-native, lightweight)
- Static assets served via Workers `[assets]` binding (not CF Pages — deprecated)
