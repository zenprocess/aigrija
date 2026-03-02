# ai-grija.ro

**Verifică. Raportează. Protejează.**

Platforma românească anti-phishing powered by AI. / The Romanian anti-phishing civic tool powered by AI.

---

## What is ai-grija.ro?

A **civic action tool** — not just "is this a scam?" but "it's a scam — now do this." Built for Romania, open-source from day one.

The name is a pun: "ai grijă" means "be careful / take care" in Romanian, and it literally contains "AI."

| | Traditional tools | ai-grija.ro |
|---|---|---|
| Output | Conversational verdict | Verdict + Report packet + Share card |
| Reporting | None | One-click DNSC 1911 / Police / Bank |
| Local context | None | Active RO campaigns, per-bank playbooks |
| Friction | Account required, daily limits | No account, unlimited |
| Viral loop | None | Branded share card on WhatsApp/FB |
| Post-verdict | "Be careful" | Pre-filled legal complaint, bank fraud hotline |

## Origin Story

The founder received a phishing call spoofing ING Romania. The callers had his full name, old ID card number, and an email address provided exclusively to TAROM — indicating a data breach. A LinkedIn post about the experience went viral, demonstrating massive demand for tools that help ordinary Romanians respond to fraud.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (V8 isolates, global edge) |
| Framework | Hono (TypeScript) |
| AI | Workers AI (Llama 3.1 8B) |
| Frontend | React SPA |
| Storage | KV (cache), R2 (share cards), D1 (admin) |
| Messaging | Telegram Bot, WhatsApp Business API |
| Infrastructure | Pulumi (IaC) |
| CI/CD | GitHub Actions |

**Privacy by design:** ai-grija.ro stores no user-submitted text, no classification results, no personal data. The only persistent state is operational (rate-limit counters, cached HTML, share card images).

## Quick Start

```bash
# Clone
git clone https://github.com/zenprocess/aigrija.git
cd aigrija

# Install dependencies
npm ci

# Local development
cp .dev.vars.example .dev.vars  # Add your API keys
npx wrangler dev                # http://localhost:8787

# Run tests
npx vitest run                  # Unit tests
npx playwright test             # E2E tests
npx tsc --noEmit                # Type check
```

## Project Structure

```
src/
├── worker/           # Cloudflare Worker (Hono API)
│   ├── routes/       # API endpoints
│   ├── admin/        # Admin panel (CF Access protected)
│   └── lib/          # Shared utilities, AI, cron
├── ui/               # React SPA frontend
│   └── src/
│       ├── components/
│       └── i18n/     # Romanian, English, Hungarian
infra/                # Pulumi infrastructure-as-code
e2e/                  # Playwright E2E tests + BDD stories
scripts/              # Setup and utility scripts
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. We welcome contributions from the Code4Romania community and beyond.

## Sustainability

ai-grija.ro is a free civic tool with no revenue model. Future sustainability through EU cybersecurity grants, Code4Romania partnership, and voluntary donations.

## License

[European Union Public License 1.2](LICENSE) (EUPL-1.2)
