# ADR-0003: Hono as HTTP Router

**Status**: accepted  
**Date**: 2026-02-15  
**Deciders**: @vvladescu  

## Context

Needed a lightweight HTTP router for Cloudflare Workers that supports middleware, TypeScript, and Workers bindings.

## Options Considered

1. **Hono** — Ultra-fast, Workers-native, typed middleware
2. **itty-router** — Minimal, but lacks middleware ecosystem
3. **Express (via adapter)** — Heavy, Node.js patterns don't map well to Workers

## Decision

**Hono v4** — native Workers support, typed bindings, middleware ecosystem.

### Rationale

1. **Workers-first**: Built for edge runtimes, zero Node.js dependencies
2. **Type safety**: `Hono<{ Bindings: Env }>` gives full env typing
3. **Middleware**: Built-in CORS, caching, auth middleware
4. **Testing**: `.fetch()` method enables unit testing without HTTP server
5. **Community**: Large ecosystem, Cloudflare recommends it

## Consequences

- Routes use Hono patterns (c.req, c.json, c.html)
- Admin panel uses HTML-over-the-wire (Hono HTML responses + HTMX)
- Testing uses `app.fetch(req, env, ctx)` pattern
