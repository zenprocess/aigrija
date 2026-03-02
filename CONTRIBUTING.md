# Contributing to ai-grija.ro

Mulțumim că vrei să contribui! / Thank you for wanting to contribute!

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Install dependencies: `npm ci`
4. Copy `.dev.vars.example` to `.dev.vars` and add your API keys
5. Start dev server: `npx wrangler dev`

## Development

```bash
npx wrangler dev        # Local dev server (port 8787)
npx vitest run          # Unit tests
npx playwright test     # E2E tests
npx tsc --noEmit        # Type check
```

## Pull Request Process

1. All PRs target `main` branch
2. Required CI checks must pass: TypeScript typecheck, unit tests, secret scan, CodeQL
3. PRs are reviewed by Greptile (AI code review) — address all comments before merge
4. Commit messages should be descriptive (conventional commits preferred)
5. Sign-off required: all commits must be signed off (`git commit -s`)

## Code Style

- TypeScript for all worker code
- React (JSX) for frontend components
- All user-facing text must be in Romanian (with i18n keys for EN/HU)
- Interactive components must have `data-testid` attributes
- No `@vercel/*` imports — this runs on Cloudflare Workers

## i18n / Translations

Translation files are in `src/ui/src/i18n/`:
- `ro.json` — Romanian (primary, legally binding)
- `en.json` — English
- `hu.json` — Hungarian

Romanian text always prevails for legal content (privacy policy, terms).

## Security

- Never hardcode secrets in source code
- Use `.dev.vars` for local development (gitignored)
- Secret scanning is enabled — PRs with leaked credentials will be blocked
- Report security vulnerabilities to security@ai-grija.ro

## Architecture Decisions

Architecture Decision Records (ADRs) are in `docs/adrs/`. Read these before making architectural changes.

## Code of Conduct

Be respectful, constructive, and inclusive. This is a civic project — we're all here to help protect Romanian citizens from fraud.

## Questions?

Open a GitHub Discussion or reach out at contact@ai-grija.ro.
