# ADR-0008: GDPR Compliance for Messaging Identifiers, Consent Management & Email Subscriptions

**Status**: accepted
**Date**: 2026-03-02
**Deciders**: @vvladescu

## Context

ai-grija.ro sends alerts and weekly digests via Telegram and WhatsApp. To deliver messages, we must store Telegram `chat_id` values and WhatsApp phone numbers — both are **personal data under GDPR** (Art. 4(1)). We also use Umami analytics (self-hosted) and plan to add email newsletter subscriptions. Romanian GDPR enforcement (ANSPDCP) is active and fines are real.

### Key constraints

- Telegram `chat_id` is a persistent numeric identifier linked to a real person — PII
- WhatsApp numbers are phone numbers — unambiguous PII
- These identifiers **cannot be anonymized** and still deliver messages
- Umami analytics needs cookie/consent management
- Email subscriptions need GDPR-compliant opt-in and unsubscribe

## Decisions

### D1: Consent-Based Processing (Art. 6(1)(a))

**Chosen**: Explicit opt-in consent for all messaging channels.

Users must affirmatively start the bot or send a subscribe command. No pre-checked boxes, no passive enrollment. Consent is recorded with timestamp in KV.

**Rejected alternatives**:
- Legitimate interest (Art. 6(1)(f)) — too risky for direct messaging; ANSPDCP expects consent
- Contract performance (Art. 6(1)(b)) — no contractual relationship exists

### D2: Data Minimization & Retention

| Data | Storage | Retention | Deletion |
|------|---------|-----------|----------|
| Telegram `chat_id` | KV `tg:subscriber:{chat_id}` | Until unsubscribe or 12 months inactive | `/sterge` command or auto-purge |
| WhatsApp number | KV `wa:subscriber:{number}` | Until unsubscribe or 12 months inactive | "STOP" message or auto-purge |
| Email address | Buttondown (EU) or KV | Until unsubscribe | One-click unsubscribe link |
| Consent record | KV `consent:{channel}:{id}` | 5 years (proof of consent) | Manual request only |

Auto-purge cron runs monthly: if no interaction in 12 months, delete subscriber + notify.

### D3: Right to Erasure (`/sterge` Command)

Both bots respond to a delete command:
- Telegram: `/sterge` → deletes `tg:subscriber:{chat_id}` + `consent:tg:{chat_id}` → confirms deletion
- WhatsApp: "STERGE" or "STOP" → same logic
- Email: unsubscribe link in every email → removes from Buttondown + KV

Response confirms deletion in Romanian. No data retained except anonymized aggregate counters.

### D4: Consent Management — Cloudflare Zaraz

**Chosen**: Cloudflare Zaraz with built-in Consent Management Platform (CMP).

- **Zero code changes** — configured entirely in CF dashboard
- Umami loaded as "Custom HTML" tool under "Analytics" purpose
- Purpose-based consent: Analytics (Umami), Functional (bot interactions)
- Auto-generates cookie banner compliant with GDPR + ePrivacy
- Context Enricher passes consent state to Workers if needed

**Rejected alternatives**:
- Cookie consent banner in React (manual implementation, maintenance burden)
- Cookiebot/OneTrust (external SaaS, cost, data leaves EU)

### D5: Email Newsletter Platform

**Chosen**: **Buttondown** ($9/mo SaaS)

- GDPR-compliant with DPA available
- REST API for programmatic subscriber management
- Simple embed form for the website
- Handles double opt-in, unsubscribe, bounce management
- Data stays in compliant infrastructure

**Rejected alternatives**:
- Substack: No public API, data leaves EU, cannot self-host, poor GDPR story
- Listmonk (self-hosted): Maximum control but operational overhead for a small team
- MailChannels: Already used for transactional digest emails; not a newsletter platform

**Migration path**: If Buttondown becomes insufficient, migrate to self-hosted Listmonk. Subscriber data is exportable via API.

## Privacy Policy Updates Required

1. Disclose Telegram `chat_id` and WhatsApp number collection
2. State lawful basis (consent) and retention period (12 months inactive)
3. Document right to erasure via `/sterge` command
4. Disclose Zaraz consent management and Umami analytics
5. Disclose Buttondown as email processor with link to their DPA
6. Add ANSPDCP complaint right information

## Consequences

**Positive**:
- Full GDPR compliance for all communication channels
- Automated consent and deletion — minimal manual intervention
- Zaraz handles analytics consent with zero code
- Buttondown handles email compliance out of the box

**Negative**:
- Monthly auto-purge cron adds complexity
- Buttondown is a paid dependency ($9/mo)
- Users who don't re-consent after 12 months lose their subscription silently

**Risks**:
- Buttondown changes pricing or GDPR stance → mitigated by Listmonk migration path
- Zaraz CMP may not cover all Romanian-specific requirements → monitor ANSPDCP guidance
