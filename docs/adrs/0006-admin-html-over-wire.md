# ADR-0006: HTML-over-the-Wire Admin Panel

**Status**: accepted  
**Date**: 2026-02-25  
**Deciders**: @vvladescu  

## Context

Admin panel needed for campaign management, config, weights tuning, and activity logs. Question: SPA framework or server-rendered HTML?

## Options Considered

1. **HTML-over-the-wire (Hono + HTMX + Tailwind CDN)** — Server-rendered, minimal JS
2. **React SPA** — Rich UX, but separate build, bundle size, API layer needed
3. **Next.js/Remix** — SSR framework, but requires Node.js runtime

## Decision

**HTML-over-the-wire** — Hono renders HTML, HTMX handles interactivity, Tailwind via CDN.

### Rationale

1. **Zero build step**: HTML templates in TypeScript, no frontend toolchain
2. **Workers-native**: Runs on same Worker, no separate deployment
3. **HTMX**: Interactive forms, partial page updates without SPA complexity
4. **Tailwind CDN**: No build-time CSS processing needed
5. **Auth**: Cloudflare Zero Trust protects all `/admin/*` routes
6. **Simplicity**: Admin panel is internal tool, doesn't need SPA UX

## Consequences

- Admin routes return `c.html(adminLayout(title, content))` 
- HTMX attributes on forms for partial updates (`hx-post`, `hx-target`)
- No client-side routing — full page navigations between sections
- Tailwind loaded from CDN (acceptable for internal tool)
- All admin state in D1/KV, no client-side state management
