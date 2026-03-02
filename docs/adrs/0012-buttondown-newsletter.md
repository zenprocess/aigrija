# ADR-0012: Buttondown for Newsletter Subscriptions

**Status**: accepted
**Date**: 2026-03-02
**Deciders**: @vvladescu

## Context

ai-grija.ro sends a weekly digest of monitored public procurement data to subscribers. We need a newsletter platform that:

- Handles GDPR double opt-in (confirmed subscription via email link)
- Provides one-click unsubscribe in every email (GDPR Art. 7(3) and ePrivacy)
- Offers a REST API for programmatic subscriber management from Workers
- Supports subscriber tagging for segmentation (weekly digest vs. future alert types)
- Does not require self-hosting or significant operational overhead

Previously, subscriber email addresses were stored directly in Cloudflare KV (`email:subscriber:{address}`). This approach lacked double opt-in, unsubscribe link generation, bounce handling, and a GDPR-compliant Data Processing Agreement (DPA).

## Options Considered

### Option A: KV-based subscriber storage (status quo)

- **Double opt-in**: Not implemented — manual confirmation email would need custom code
- **Unsubscribe**: Manual — custom endpoint required, no one-click guarantee
- **GDPR DPA**: None — we are the data processor with full liability
- **Bounce handling**: None
- **Tradeoff**: Maximum control but significant compliance and operational liability. Rejected.

### Option B: Mailchimp

- **Double opt-in**: Yes
- **API**: Yes (v3 REST API)
- **GDPR**: DPA available
- **Cost**: Free tier limited to 500 contacts / 1,000 emails/month; paid plans expensive for a civic project
- **Tradeoff**: Overkill for our scale; free tier insufficient beyond early growth. Rejected.

### Option C: Buttondown

- **Double opt-in**: Yes — built-in, enabled per-subscriber-type
- **Unsubscribe**: Yes — automatic one-click link in every email
- **API**: Yes — full REST API (`api.buttondown.email/v1/subscribers`)
- **GDPR**: DPA available; data stored in compliant infrastructure
- **Tags**: Yes — tag subscribers (e.g., `digest`) for segmentation
- **Cost**: $9/month flat; no subscriber count limits on starter plan
- **Bounce handling**: Automatic — hard bounces remove subscriber

### Option D: Self-hosted Listmonk

- **Double opt-in**: Yes
- **GDPR**: Full control; data never leaves our infrastructure
- **Cost**: Free (self-hosted) but requires a Postgres database and operational management
- **Tradeoff**: Maximum control and zero ongoing SaaS cost, but operational overhead for a small team. Viable long-term migration target if Buttondown becomes insufficient.

## Decision

**Option C: Buttondown**, with tag `"digest"` for weekly digest subscribers.

### Rationale

1. **GDPR compliance out of the box**: Double opt-in, DPA, automatic unsubscribe — no custom compliance code needed
2. **REST API**: Programmatic subscriber management from Cloudflare Workers without a database
3. **Cost-appropriate**: $9/month is justified vs. the engineering cost of building equivalent compliance infrastructure in KV
4. **Escape hatch**: Subscriber list is exportable via API; migration to Listmonk is documented as the fallback

### API Integration Pattern

```typescript
// Subscribe a user (Workers handler)
const res = await fetch('https://api.buttondown.email/v1/subscribers', {
  method: 'POST',
  headers: {
    'Authorization': `Token ${env.BUTTONDOWN_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email_address: email,
    tags: ['digest'],
    // double opt-in is handled by Buttondown automatically
  }),
});
```

`BUTTONDOWN_API_KEY` is stored in Infisical and bound via `wrangler secret put BUTTONDOWN_API_KEY`. Never hardcoded.

### Migration from KV

1. Export existing KV subscriber list (`tg:subscriber:*` keys that have email addresses)
2. Import via Buttondown API with `tags: ['digest']`
3. Buttondown sends confirmation emails — only confirmed subscribers receive digest
4. Remove KV-based email subscription endpoint after migration complete

## Consequences

**Positive**:
- GDPR double opt-in and unsubscribe handled automatically — no compliance risk
- Bounce and spam complaint handling removes bad addresses automatically
- REST API integrates cleanly with Workers without additional database

**Negative**:
- $9/month recurring cost
- Subscribers must confirm opt-in — initial list migration will lose unconfirmed addresses
- Buttondown is a US company; DPA covers EU transfers but data may transit US infrastructure

**Risks**:
- Buttondown changes pricing or GDPR posture → mitigated by documented Listmonk migration path
- API rate limits on bulk operations → use batch endpoints and respect `Retry-After` headers
