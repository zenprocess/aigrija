# Architecture Decision Records (ADRs)

Key architectural decisions for ai-grija.ro. Full details in `docs/adrs/`.

## Active Decisions

| # | Decision | Implication for Code |
|---|----------|---------------------|
| 0001 | chanfana for OpenAPI | Use `createRoute()` for new API endpoints |
| 0002 | Cloudflare Workers runtime | No Node.js APIs, use Web APIs only |
| 0003 | Hono router | All routes via `new Hono()`, middleware via `.use()` |
| 0004 | Workers AI (Llama 3.1 8B) | Use `env.AI.run()` for inference, Romanian prompts |
| 0005 | Pulumi for IaC | All infra in `infra/index.ts`, never manual CF dashboard |
| 0006 | Admin HTML-over-the-wire | Admin UI is server-rendered HTML, not SPA |
| 0007 | Defense-in-depth security | 5 layers: hooks, pre-commit, pre-push, CI, .gitignore |
| 0008 | GDPR consent model | Web: cookie banner + localStorage. Bots: /start opt-in, STERGE opt-out |
| 0009 | 21st.dev components | Adapt to no-Next.js/no-shadcn, add data-testid, update BDD stories |
| 0010 | EUPL-1.2 license | Include EUPL header in new files if needed |
| 0011 | GitHub-native PM | Issues + Milestones + Labels, no external tools |
| 0012 | Buttondown newsletter | Use Buttondown API with tag "digest", not KV storage |
| 0013 | CrossGuard policies | Run `validate-infra.sh` before deploy, CrossGuard in CI |
| 0014 | Environment isolation | Local dev NEVER touches prod. Only CI/CD deploys. No `--remote` from local. |

## When Writing Code

- New API endpoint? Use chanfana OpenAPI (ADR-0001)
- New UI component from 21st.dev? Adapt, add data-testid, create BDD story (ADR-0009)
- Handling user data? Check GDPR consent model (ADR-0008)
- Adding infra? Use Pulumi, add CrossGuard policy if needed (ADR-0005, 0013)
- Storing secrets? Infisical + wrangler secret put, never hardcode (ADR-0007)
