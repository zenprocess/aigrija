# ADR-0007: Defense-in-Depth Secret Prevention

**Status**: accepted
**Date**: 2026-03-01
**Deciders**: @vvladescu

## Context

ai-grija.ro is a Romanian anti-phishing platform that classifies URLs via Workers AI. The system handles sensitive credentials (Cloudflare API tokens, AI provider keys, KV/R2 bindings). A single leaked secret could allow attackers to hijack the Workers deployment, exfiltrate phishing-victim data, or impersonate the legitimate ai-grija.ro service to undermine trust in the anti-phishing brand itself. Single-point secret controls (e.g., only `.gitignore`) are insufficient — developer mistakes, editor auto-saves, or hook bypasses create gaps.

## Options Considered

1. **Defense-in-Depth (5 independent layers)** — Multiple independent scanners; any single failure is caught by another layer
2. **Single `.gitignore` + developer discipline** — Relies entirely on human vigilance; no automated enforcement
3. **Vault-only secrets (no local files)** — No `.env` files at all; secrets injected at deploy time only; impractical for local dev iteration

## Decision

**Defense-in-Depth with 5 independent layers** — every layer must pass before a secret can reach GitHub.

### Layer Stack

| Layer | Tool | Trigger | Action |
|-------|------|---------|--------|
| L1 — File block | `block-sensitive-files.py` hook | PreToolUse Write/Edit | Blocks writes to `.env`, `*.pem`, `*.key`, credential files |
| L2 — Commit scan | `secret-scan.py` hook + ggshield | PreToolUse Bash (`git commit`) | Scans staged files before commit lands |
| L3 — Push scan | `pre-push-scan.py` hook | PreToolUse Bash (`git push`) | Runs Gitleaks + TruffleHog + ggshield in sequence |
| L4 — CI gate | `.github/workflows/secret-scan.yml` | PR opened / pushed | Gitleaks Action + TruffleHog + file-pattern check |
| L5 — .gitignore | `.gitignore` | `git add` | Silently excludes `.env*`, `*.pem`, `*.key`, `.dev.vars` |

### Secret Lifecycle

1. **Authoring**: secrets created and stored in **Infisical** (`sec.zp.digital`) via `mcp__infisical__create-secret`
2. **Local dev**: secrets pulled to `.dev.vars` (gitignored) — `wrangler dev` reads this automatically
3. **Production binding**: `npx wrangler secret put KEY_NAME` binds secret to the Worker; accessed as `env.KEY_NAME` at runtime
4. **Never in source**: no hardcoded values in `.ts`, `.toml`, or any tracked file

### Honeytokens

GitGuardian MCP (`mcp__gitguardian__generate_honeytoken`) generates canary credentials deployed in monitored locations. Any use of a honeytoken triggers an alert, providing early warning of credential theft before real secrets are weaponised.

### Romanian Anti-Phishing Context

Because ai-grija.ro actively combats phishing, a compromised deployment would be a high-value target — attackers could flip verdicts (marking phishing URLs as safe), access victim-submitted URLs, or deface the service to erode public trust. The 5-layer model treats secret leakage as a critical threat equivalent to a direct breach.

## Consequences

- Developers must rely on `wrangler dev` for local secrets via `.dev.vars` — no plain `process.env` fallback
- Every `git commit` and `git push` has latency overhead from scanner invocations (~2-5 s)
- If a scanner flags a false positive, the developer must allow-list the pattern in `.gitguardian.yaml` or `.gitleaks.toml` — no `--no-verify` bypasses permitted
- Rotating a secret requires: update in Infisical → `npx wrangler secret put` → verify `wrangler tail` shows no auth errors
- GitHub repo settings must enable **Secret scanning** and **Push protection** in Settings → Code security (manual step post-`setup.sh`)

## Alternatives

### Single `.gitignore` + developer discipline
Rejected — relies on no developer ever accidentally staging a secret file. One `git add .` in the wrong directory defeats the control.

### Vault-only secrets (no local `.dev.vars`)
Rejected — requires network round-trips to Infisical on every local dev iteration, adding friction and breaking offline development. Feasible as a future hardening step but not the baseline.

### Pre-commit only (no CI gate)
Rejected — pre-commit hooks can be skipped with `--no-verify`; the CI gate (L4) is the backstop that cannot be bypassed by developer tooling.
