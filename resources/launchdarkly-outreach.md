# LaunchDarkly — Open Source / Nonprofit Program Inquiry

**To:** sales@launchdarkly.com
**CC:** opensource@launchdarkly.com
**Subject:** Open Source Civic Tool — Feature Management for Anti-Phishing Platform (Romania)

---

Hi LaunchDarkly team,

I'm reaching out about **ai-grija.ro**, an open-source civic anti-phishing tool protecting Romanian citizens from SMS/WhatsApp phishing, fake government websites, and bank impersonation scams.

## What we do

- Citizens paste suspicious messages → AI + threat intelligence → instant verdict (phishing/suspicious/safe)
- Automated DNSC (Romanian CERT) alert ingestion + community reporting
- Multilingual: Romanian, Bulgarian, Hungarian, Ukrainian
- 100% free, no accounts, anonymous — funded as a civic project by Zen Labs

## Why LaunchDarkly

We're building operational infrastructure that needs proper feature flagging:

- **Gradual rollout** of new threat detection models (Safe Browsing, VirusTotal, RDAP, AI classifier)
- **Kill switches** for external API integrations (circuit breakers with dashboard control)
- **A/B testing** risk scoring weights across user segments
- **Regional targeting** — different scam patterns per country (RO vs BG vs HU vs UK)
- **Operational toggles** — enable/disable scrapers, draft generation, community features without redeployment

Our stack is **Cloudflare Workers** (edge-first), so we'd use the **LaunchDarkly JavaScript/Edge SDK**.

## Current scale

- Early stage, targeting 10K+ monthly verifications within 6 months
- 4 language markets across Southeast Europe
- Open source: github.com/zenprocess/aigrija

## Ask

We'd love to explore:

1. **Open Source / Nonprofit program** — does LaunchDarkly offer sponsored or discounted plans for civic/open-source projects?
2. **Edge SDK compatibility** — confirming the JS SDK works within Cloudflare Workers (no Node.js runtime)
3. **Starter plan** scope — would the free/starter tier cover our initial needs (est. 10-15 flags, 1 environment)?

Happy to jump on a call or provide any additional context about the project.

Best regards,

**[Your Name]**
Zen Labs
https://ai-grija.ro | https://zen-labs.ro
GitHub: zenprocess/aigrija
