# ai-grija.ro

**Platforma civică anti-phishing pentru România** — verifică linkuri, mesaje și coduri QR suspecte folosind inteligență artificială.

[![Deploy Production](https://github.com/zenprocess/aigrija/actions/workflows/deploy-prod.yml/badge.svg)](https://github.com/zenprocess/aigrija/actions/workflows/deploy-prod.yml)

## Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers (TypeScript) |
| Router | Hono v4 |
| AI | Workers AI (Llama 3.1 8B Instruct) |
| Storage | KV (cache), R2 (share cards), D1 (admin DB) |
| Queue | Cloudflare Queues (draft generation) |
| IaC | Pulumi (infra/) |
| Tests | Vitest (unit) + Playwright (e2e) |
| CI/CD | GitHub Actions (3 workflows) |

## Quick Start

```bash
# Install dependencies
npm install

# Local development (requires .dev.vars with secrets)
npx wrangler dev

# Run tests
npx vitest run          # Unit tests (403+)
npx playwright test     # E2E tests (11 specs)

# Type check
npx tsc --noEmit

# Deploy
npx wrangler deploy                # Production
npx wrangler deploy --env preview  # Preview (pre.ai-grija.ro)
```

## Project Structure

```
src/
├── worker/
│   ├── index.ts              # Main Hono router + cron/queue handlers
│   ├── routes/               # API endpoints
│   │   ├── check-qr.ts       # POST /api/check-qr — QR code analysis
│   │   ├── check-text.ts     # POST /api/check-text — message analysis
│   │   ├── report.ts         # POST /api/report — user reports
│   │   ├── counter.ts        # GET/POST /api/counter — stats
│   │   ├── share.ts          # POST /api/share — share card generation
│   │   ├── card.ts           # GET /card/:hash — OG share pages
│   │   ├── og.ts             # GET /og/* — OG image SVG generation
│   │   ├── telegram.ts       # Telegram bot webhook
│   │   ├── whatsapp.ts       # WhatsApp webhook
│   │   └── ...
│   ├── lib/                  # Shared utilities
│   │   ├── url-analyzer.ts   # URL threat analysis engine
│   │   ├── ai-verdict.ts     # AI-powered verdict generation
│   │   ├── rate-limiter.ts   # KV-based rate limiting
│   │   ├── scraper.ts        # Campaign scraper base
│   │   └── ...
│   ├── admin/                # Admin panel (HTML-over-the-wire)
│   │   ├── campaigns.ts      # Campaign management
│   │   ├── drafts.ts         # Draft review/approval
│   │   ├── translations.ts   # i18n management
│   │   └── ...
│   └── templates/            # HTML templates
├── ui/                       # Frontend (static assets → dist/)
infra/                        # Pulumi IaC (KV, R2, D1, DNS, Zero Trust)
e2e/                          # Playwright E2E tests
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/check-qr` | Analyze QR code content for threats |
| POST | `/api/check-text` | Analyze text message for scam patterns |
| POST | `/api/report` | Submit user report |
| POST | `/api/share` | Generate shareable verdict card |
| GET | `/api/counter` | Get total checks count |
| GET | `/card/:hash` | Share card OG page |
| GET | `/og/verdict/:verdict` | OG image generation |
| POST | `/webhook/telegram` | Telegram bot integration |
| POST | `/webhook/whatsapp` | WhatsApp bot integration |
| GET | `/admin/*` | Admin panel (Zero Trust protected) |

## Environments

| Environment | URL | Deploy |
|------------|-----|--------|
| Production | https://ai-grija.ro | `npx wrangler deploy` |
| Preview | https://pre.ai-grija.ro | `npx wrangler deploy --env preview` |
| Admin | https://admin.ai-grija.ro | Cloudflare Zero Trust |
| Preview Admin | https://pre-admin.ai-grija.ro | Cloudflare Zero Trust |

## Infrastructure (Pulumi)

```bash
cd infra/
pulumi up        # Provision all resources
pulumi preview   # Dry run
```

Manages: KV namespaces, R2 buckets, D1 databases, Queues, DNS records, Zero Trust Access apps, Worker secrets.

## Secrets

All secrets stored in Infisical (`sec.zp.digital`). Never hardcode.

```bash
npx wrangler secret put SECRET_NAME   # Bind to Worker
```

## Contributing

1. Create a branch from `main`
2. Write tests for new functionality
3. Ensure `npx vitest run` and `npx tsc --noEmit` pass
4. Open PR — Greptile will review
5. Address all review comments before merge

## License

Private — Zen Labs SRL
