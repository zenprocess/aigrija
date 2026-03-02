# story-runner — Bowser Layer 3 Orchestrator

## Invocation

/story-runner [local|preview|prod] [--tags <tag1,tag2>]

## Steps

1. Determine target environment and base URL
   - local: http://localhost:8787 (start wrangler dev if not running)
   - preview: https://pre.ai-grija.ro (needs CF Access)
   - prod: https://ai-grija.ro
2. Run `npx tsx e2e/bowser-dispatch.ts --base-url <URL> ${TAGS:+--tags "$TAGS"}`
3. Read playwright-report/bowser-summary.json
4. Format and display results
5. Stop dev server if started in step 1

## Arguments

| Arg | Description |
|-----|-------------|
| `--tags <list>` | Comma-separated tags to filter stories (smoke, critical, regression, api, a11y, admin) |

## Output Format

BOWSER RUN — <url> (tags: smoke,api)
════════════════════════════════
suspicious-sms     ✅  3.2s
safe-message       ✅  2.1s
...
════════════════════════════════
TOTAL: N/M passed | Screenshots: playwright-report/stories/

## CI Mode

When CI=true, output raw JSON from bowser-summary.json instead of the formatted table.

## Environment Detection

| Arg      | Base URL                  | Auth Required     |
|----------|---------------------------|-------------------|
| local    | http://localhost:8787     | None              |
| preview  | https://pre.ai-grija.ro   | CF Access headers |
| prod     | https://ai-grija.ro       | None              |

## CF Access (preview only)

Set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET in env or .dev.vars.
bowser-dispatch.ts must forward them as CF-Access-Client-Id and CF-Access-Client-Secret headers.

## Artifacts

- Screenshots land in playwright-report/stories/
- Summary JSON at playwright-report/bowser-summary.json
- Both are gitignored; uploaded as CI artifacts on every run
