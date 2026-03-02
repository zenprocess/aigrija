# Bowser — E2E Test Skill

Bowser is the E2E testing layer for ai-grija.ro. It wraps Playwright and YAML story execution into a simple CLI interface (Layer 1) and a concurrent dispatcher (Layer 2).

## When to Use

| Use Case | Tool |
|----------|------|
| Regression after a deploy | `bash scripts/bowser-run.sh` |
| Run a single spec during dev | `bash scripts/bowser-run.sh --spec alerts` |
| Run a user-journey story | `bash scripts/bowser-run.sh --story suspicious-sms` |
| Run all stories in parallel | `npm run test:bowser` |

## Layer 1 — CLI Wrapper (`scripts/bowser-run.sh`)

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--spec NAME` | — | Run `e2e/NAME.spec.ts` (or `e2e/NAME` if full path). Mutually exclusive with `--story`. |
| `--story NAME` | — | Run `e2e/stories/NAME.yaml` via `run-stories.ts`. |
| `--base-url URL` | auto | Target URL. Auto-detected: CF_ACCESS_CLIENT_ID set → `CF_PREVIEW_URL` or `https://preview.aigrija.ro`, else `http://localhost:8787`. |
| `--viewport mobile\|tablet\|desktop` | `desktop` | Selects Playwright project. `mobile`/`tablet` → iPhone 14 profile, `desktop` → Desktop Chrome. |
| `--headed` | headless | Run browser in headed mode (useful for local debugging). |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |
| 2 | Configuration or argument error |

### Examples

```bash
# Run a single spec, desktop
bash scripts/bowser-run.sh --spec api

# Run on mobile viewport
bash scripts/bowser-run.sh --spec homepage --viewport mobile

# Run a YAML story
bash scripts/bowser-run.sh --story suspicious-sms

# Run against a preview deploy
CF_ACCESS_CLIENT_ID=xxx CF_ACCESS_CLIENT_SECRET=yyy CF_PREVIEW_URL=https://preview.aigrija.ro \
  bash scripts/bowser-run.sh --story safe-message

# Run all specs headed for debugging
bash scripts/bowser-run.sh --headed
```

### CF Access (Preview Environments)

When `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are set, the script automatically:
1. Sets `BASE_URL` to `CF_PREVIEW_URL` (fallback: `https://preview.aigrija.ro`)
2. Injects `PLAYWRIGHT_EXTRA_HTTP_HEADERS` with the CF Access service token headers so Playwright can reach protected preview URLs

## Layer 2 — Dispatcher (`e2e/bowser-dispatch.ts`)

Runs all YAML stories concurrently (max 4 at a time) and aggregates results.

### Usage

```bash
npm run test:bowser
# or with a custom URL
npx tsx e2e/bowser-dispatch.ts --base-url https://preview.aigrija.ro
```

### Output

Results are written to `playwright-report/bowser-summary.json`:

```json
{
  "timestamp": "2026-03-01T12:00:00.000Z",
  "base_url": "http://localhost:8787",
  "total": 5,
  "passed": 4,
  "failed": 1,
  "stories": [
    { "name": "suspicious-sms", "status": "pass", "duration_ms": 3200, "screenshots": [] },
    { "name": "safe-message", "status": "fail", "error": "...", "screenshots": [] }
  ]
}
```

### Retry Behaviour

Failed stories are retried once automatically before being marked as failed. This handles transient network issues in CI.

## File Map

```
scripts/bowser-run.sh          Layer 1: CLI wrapper
e2e/bowser-dispatch.ts         Layer 2: concurrent dispatcher
e2e/stories/*.yaml             YAML story definitions
e2e/run-stories.ts             Story execution engine
playwright-report/bowser-summary.json  Aggregated results (generated)
```
