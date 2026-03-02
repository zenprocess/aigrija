# ADR-0016: R2 CDN Architecture (cdn.ai-grija.ro)

**Status**: accepted
**Date**: 2026-03-02
**Deciders**: @vvladescu

## Context

ai-grija.ro needs a CDN for static assets (images, documents, user uploads). Options evaluated: external CDN (Bunny, KeyCDN), Cloudflare R2 with custom domain, S3+CloudFront.

## Options Considered

1. **External CDN (Bunny, KeyCDN)** — separate vendor, egress fees, additional DNS complexity
2. **Cloudflare R2 with custom domain** — same stack as Workers runtime, zero egress fees
3. **S3 + CloudFront** — AWS ecosystem, egress fees, cross-provider complexity

## Decision

Use Cloudflare R2 with custom domain `cdn.ai-grija.ro`. Assets served through CF edge network with automatic SSL.

### Rationale

- **Zero egress fees** — R2's key differentiator; no per-GB transfer cost
- **Same stack as Workers runtime** — no cross-provider complexity
- **CF edge caching built-in** when domain is proxied (orange cloud)
- **S3-compatible API** for tooling interop

## Architecture

- **Asset bucket**: `ai-grija-assets` (EEUR region)
- **Custom domain**: `cdn.ai-grija.ro` → R2 via CNAME (proxied)
- **State bucket**: `ai-grija-pulumi-state` (separate, no public access)

## Security

- **CORS**: locked to `ai-grija.ro` origins only, no wildcard
- **WAF**: block non-GET/HEAD on CDN, hotlink protection, rate limiting
- **TLS**: minimum 1.2
- **R2 tokens**: bucket-scoped, least privilege

## Caching Strategy

| Asset Type | Cache-Control |
|-----------|--------------|
| Hashed JS/CSS | `public, max-age=31536000, immutable` |
| Images | `public, max-age=2592000, stale-while-revalidate=3600` |
| HTML | `public, max-age=0, must-revalidate` |
| Private/user | `private, no-store` |

## Consequences

- All static assets must be uploaded to R2 (not served from Worker)
- Cache invalidation requires purging CF cache (API or dashboard)
- R2 S3-compat tokens are dashboard-only (no API creation)
