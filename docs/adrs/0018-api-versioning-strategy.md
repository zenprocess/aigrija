# ADR-0018: API Versioning Strategy

**Status**: accepted
**Date**: 2026-03-14
**Decision Makers**: zenprocess

## Context

ai-grija.ro has 30+ API routes served via Hono + chanfana OpenAPI. Currently all routes are unversioned (`/api/check`, `/api/alerts`, etc.). As the platform grows and external consumers (mobile apps, browser extensions, third-party integrations) adopt the API, breaking changes must be managed.

## Decision

Adopt **URL prefix versioning** (`/api/v1/`) as the primary strategy, with a deprecation timeline.

### Rules

1. **New routes** created after this ADR MUST use `/api/v1/` prefix
2. **Existing routes** (`/api/check`, `/api/alerts`, etc.) remain as-is and are aliased to v1
3. **Breaking changes** require a new version (`/api/v2/`) — the previous version stays available for 6 months
4. **Non-breaking additions** (new fields, new endpoints) do NOT require version bump
5. **OpenAPI spec** includes version in `info.version` field

### Migration Path

Phase 1 (current): Routes work at both `/api/check` and `/api/v1/check` (alias)
Phase 2 (6 months): New features only on `/api/v1/`
Phase 3 (12 months): Legacy unversioned routes return 301 to `/api/v1/`

## Consequences

- External consumers can pin to `/api/v1/` for stability
- Breaking changes don't disrupt existing integrations
- OpenAPI docs reflect the active version
- Slight routing complexity increase (alias layer)

## Constraints

- Never remove a versioned endpoint without 6-month deprecation notice
- Version number is monotonic (no v1.1, v1.2 — just v1, v2)
- Webhook URLs (`/webhook/telegram`, `/webhook/whatsapp`) are exempt from versioning (platform-specific)
