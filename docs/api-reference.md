---
title: API Reference
type: api-reference
generated_at: 2026-03-15
source: src/worker/routes/registry.ts
---

# ai-grija.ro API Reference

Base URL: `https://ai-grija.ro` | Preview: `https://pre.ai-grija.ro`

OpenAPI spec auto-generated at `/openapi.json`. Interactive docs at `/docs`.

All POST endpoints are rate-limited. Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are included in responses.

API v1 aliases available at `/api/v1/*` (see ADR-0018).

---

## Phishing Check

### POST /api/check
Analyze a suspicious message for phishing indicators.

**Latency tier**: slow (5000ms p95)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | yes | Suspicious message text (3-5000 chars) |
| url | string | no | Suspicious URL to analyze |

**Response**: `{ verdict, confidence, red_flags, recommended_actions, campaign_match?, domain_analysis? }`

### POST /api/check/image
Analyze a screenshot of a suspicious message via Workers AI vision (Llava).

**Latency tier**: slow (5000ms p95)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | file | yes | PNG/JPG/WEBP, max 5MB |

### POST /api/check-qr
Analyze a QR code for phishing URLs.

**Latency tier**: slow (5000ms p95)

---

## Alerts & Campaigns

### GET /api/alerts
List active phishing campaigns.

**Latency tier**: ssr (500ms p95)

**Response**: `[{ slug, title, description, target, severity, status, first_seen }]`

### GET /api/alerts/emerging
List newly emerging campaigns (last 7 days).

### GET /api/alerts/:slug
Get a single campaign by slug.

---

## Community Reports

### GET /api/reports
List community-submitted scam reports (top 20 by votes).

**Latency tier**: medium (200ms p95)

**Response**: `[{ id, text_snippet, votes_up, votes_down, verdict, created_at }]`

### POST /api/reports/:id/vote
Vote on a community report.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| vote | string | yes | `"up"` or `"down"` |

---

## Feed & Stats

### GET /api/feed/latest
Latest scam detection feed entries.

**Latency tier**: fast (50ms p95)

### GET /api/stats
Platform statistics (total checks, active campaigns, etc.).

### GET /api/counter
Total verification count.

### GET /api/badges
Achievement badges data.

---

## Quiz

### GET /api/quiz
Get phishing recognition quiz questions (10 questions, randomized).

**Latency tier**: fast (50ms p95)

### POST /api/quiz/check
Submit quiz answer for verification.

---

## Newsletter & Digest

### POST /api/newsletter/subscribe
Subscribe to the email newsletter via Buttondown.

**Latency tier**: medium (200ms p95)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | yes | Email address (double opt-in) |

### POST /api/newsletter/unsubscribe
Unsubscribe from the newsletter.

### GET /api/digest/latest
Get the latest weekly digest.

### POST /api/digest/subscribe
Subscribe to weekly digest alerts.

### POST /api/digest/unsubscribe
Unsubscribe from weekly digest.

---

## Sharing

### GET /api/share/:id
Get a shareable verdict card by ID.

**Latency tier**: fast (50ms p95)

---

## Translation

### POST /api/translation-report
Report a translation issue.

**Latency tier**: medium (200ms p95)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| current_text | string | yes | The incorrect text |
| suggested | string | yes | Suggested correction |
| comment | string | no | Additional details |

---

## Health & Monitoring

### GET /health
Basic health check.

**Latency tier**: fast (50ms p95)

**Response**: `{ status: "healthy", version, timestamp }`

### GET /health/deep
Deep health check with component status.

**Response**: `{ status, components: { kv, ai, r2, d1, queue } }`

### GET /api/health/metrics
Internal health metrics.

---

## Webhooks

### POST /webhook/telegram
Telegram bot webhook (verified via bot token).

**Latency tier**: external (10000ms p95)

### POST /webhook/whatsapp
WhatsApp Cloud API webhook.

**Latency tier**: external (10000ms p95)

---

## SSR Routes (non-API)

| Route | Description |
|-------|-------------|
| `/alerte` | SSR alert listing page |
| `/alerte/:slug` | SSR alert detail page |
| `/blog` | Redirects to `/ghid` (301) |
| `/ghid`, `/amenintari`, `/educatie` | SSR content category pages (JSON) |
| `/ghid/:slug`, `/amenintari/:slug` | SSR content detail (JSON) |
| `/og/:hash` | Open Graph image generation |
| `/card/:hash` | Share card image |
| `/sitemap.xml` | XML sitemap |
| `/robots.txt` | Robots file |

---

## SPA Hash Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/#/quiz` | Quiz | Phishing recognition quiz |
| `/#/confidentialitate` | PrivacyPolicy | GDPR privacy policy |
| `/#/termeni` | TermsOfService | Terms of use |
| `/#/amenintari` | ContentList | Threats category |
| `/#/ghid` | ContentList | Guides category |
| `/#/educatie` | ContentList | Education category |
| `/#/alerte/:slug` | AlertDetail | Campaign detail view |

---

## Authentication

Public API endpoints require no authentication. Admin panel (`admin.ai-grija.ro`) is protected by Cloudflare Access (JWT validation).

## Rate Limiting

All POST endpoints are rate-limited per IP. Limits vary by route tier (see ADR-0019). Test environments use elevated limits (1000/window).

## Error Format

```json
{
  "error": {
    "code": "RATE_LIMITED|VALIDATION_ERROR|NOT_FOUND|INTERNAL_ERROR",
    "message": "Human-readable message (Romanian)",
    "request_id": "uuid"
  }
}
```
