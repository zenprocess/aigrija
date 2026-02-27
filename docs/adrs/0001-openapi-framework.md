# ADR-0001: OpenAPI Framework for API Documentation & Validation

**Status**: proposed  
**Date**: 2026-02-27  
**Deciders**: @vvladescu  

## Context

ai-grija.ro needs contract-first API documentation with runtime request validation.
Currently routes use ad-hoc validation (manual `if` checks). No generated spec exists.

We need: auto-generated OpenAPI 3.1 spec, Swagger UI, Zod-based request validation,
all running on Cloudflare Workers with Hono.

## Options Considered

### Option A: `chanfana` (Cloudflare's library)

- **Maintainer**: Cloudflare (official)
- **Production use**: Cloudflare Radar 2.0 public API
- **Pattern**: Class-based routes (`extends OpenAPIRoute`)
- **Integration**: `fromHono()` wraps existing Hono app
- **Auto-serves**: `/docs` (Swagger UI), `/openapi.json`
- **Validation**: Zod v4, auto-validates request params/body/headers
- **CLI**: `npx chanfana` extracts static schema.json
- **Bundle**: Lightweight, designed for Workers
- **Tradeoff**: Every route becomes a class (more boilerplate, but cleaner separation)
- **Can extend existing app**: Yes, old routes untouched

### Option B: `@hono/zod-openapi` + `@hono/swagger-ui`

- **Maintainer**: Hono community (honojs/middleware repo)
- **Pattern**: Function-based with `createRoute()` + `OpenAPIHono`
- **Auto-serves**: Manual setup (`app.doc('/doc', ...)`, `swaggerUI()` middleware)
- **Validation**: Zod, via route schema definitions
- **CLI**: None
- **Bundle**: Pulls swagger-ui-dist from CDN
- **Tradeoff**: Closer to vanilla Hono patterns, less boilerplate per route

### Option C: Static `openapi.yaml` (no runtime validation)

- **Pattern**: Hand-written spec file, no runtime enforcement
- **Tradeoff**: Spec drifts from implementation immediately. Rejected.

## Decision

**Option A: `chanfana`**

### Rationale

1. **Cloudflare-native**: Built by Cloudflare, battle-tested on Radar 2.0 API at scale
2. **Zero config Swagger UI**: `fromHono()` auto-serves `/docs` and `/openapi.json`
3. **CLI for CI**: `npx chanfana` can extract schema in CI for contract testing
4. **Extend-not-rewrite**: Can wrap existing Hono app, migrate routes incrementally
5. **Class-based routes**: More explicit per-route schema, easier to audit
6. **Active maintenance**: Cloudflare maintains it alongside Workers runtime

### Migration path

1. `npm install chanfana zod`
2. Wrap app with `fromHono(app, { docs_url: '/docs' })`
3. Convert routes one-by-one from inline handlers to `OpenAPIRoute` classes
4. Old routes continue working during migration
5. Delete static `openapi.yaml` once all routes are converted

## Consequences

- Every route handler becomes a class (more lines, but schema is co-located)
- Zod becomes a production dependency (already dev-dep via vitest)
- Request validation happens automatically (remove manual `if` checks)
- Swagger UI available at `/docs` in all environments
- Schema extractable via CLI for frontend codegen or contract tests
