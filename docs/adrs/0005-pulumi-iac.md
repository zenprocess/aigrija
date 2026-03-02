# ADR-0005: Pulumi for Infrastructure as Code

**Status**: accepted  
**Date**: 2026-02-27  
**Deciders**: @vvladescu  

## Context

ai-grija.ro has 41 Cloudflare resources (KV, R2, D1, Queues, DNS, Zero Trust, Worker secrets). Needed reproducible infrastructure management.

## Options Considered

1. **Pulumi (TypeScript)** — Imperative IaC, same language as app code
2. **Terraform** — Declarative HCL, mature CF provider
3. **Wrangler CLI only** — Manual resource creation, no state management

## Decision

**Pulumi with TypeScript** — infrastructure defined in `infra/index.ts`.

### Rationale

1. **Same language**: TypeScript for both app and infra, shared types possible
2. **State management**: Pulumi Cloud tracks all 41 resources
3. **CF provider**: Full Cloudflare resource coverage (KV, R2, D1, DNS, Access)
4. **Preview**: `pulumi preview` shows diff before applying
5. **Import**: Can import existing resources (`pulumi import`)

## Consequences

- `infra/` directory with Pulumi project
- Pulumi Cloud account required for state
- Passphrase-encrypted secrets in Pulumi config
- `pulumi up` deploys infra; `wrangler deploy` deploys code (separate)
