# ADR-0015: Pulumi State Backend on Cloudflare R2

**Status**: accepted
**Date**: 2026-03-02
**Deciders**: @vvladescu
**Supersedes**: Partial update to ADR-0005 (removes local-only state assumption)

## Context

Pulumi state was stored on the developer's local filesystem. This meant:

1. CI/CD could not run pulumi preview or pulumi up — no access to state
2. Single point of failure — state lost if laptop dies
3. PULUMI_ACCESS_TOKEN was referenced in workflows but never existed (we don't use Pulumi Cloud)

We already have Cloudflare R2 (S3-compatible, zero egress fees) in our stack.

## Options Considered

1. **Pulumi Cloud** — SaaS state backend, free tier available
2. **Cloudflare R2 as S3-compatible backend** — self-hosted, already in our stack
3. **Keep local** — status quo, CI can't validate infra

## Decision

**Cloudflare R2 as Pulumi state backend** via S3-compatible API.

### Rationale

1. **Already in our stack** — R2 is managed, we pay for it, zero new vendor
2. **Zero egress fees** — state reads in CI are free
3. **S3-compatible** — Pulumi natively supports s3:// backends
4. **CI-accessible** — R2 API tokens work in GitHub Actions
5. **No vendor lock-in** — portable to any S3-compatible store

## Implementation

### New R2 Bucket

Dedicated bucket ai-grija-pulumi-state (separate from app data).

### CI Environment Variables

| Secret | Purpose |
|--------|---------|
| PULUMI_CONFIG_PASSPHRASE | Decrypt secrets in Pulumi.*.yaml |
| AWS_ACCESS_KEY_ID | R2 API token ID (S3-compat) |
| AWS_SECRET_ACCESS_KEY | R2 API token secret (S3-compat) |
| CLOUDFLARE_API_TOKEN | CF provider auth (existing) |

## Consequences

- CI can now run pulumi preview in PR checks
- State is durable and backed up (R2 replication)
- Need R2 API token (S3-compat) stored in Infisical + GitHub secrets
- Removes need for PULUMI_ACCESS_TOKEN entirely
