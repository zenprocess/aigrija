# ADR-0013: CrossGuard Policy-as-Code for Infrastructure Guardrails

**Status**: accepted
**Date**: 2026-03-02
**Deciders**: @vvladescu

## Context

ai-grija.ro uses Pulumi to manage Cloudflare infrastructure (`infra/index.ts`). While Pulumi ensures infra is version-controlled, there is no automated enforcement of organizational policies — a developer could accidentally:

- Create an R2 bucket in a non-EU jurisdiction
- Deploy a DNS record without Cloudflare proxy (bypassing DDoS protection)
- Set an Access session limit to an unreasonably long value
- Leave a Workers secret empty (placeholder not replaced)
- Expose an admin subdomain without Cloudflare Access protection

Additionally, config drift between `wrangler.toml` / `infra/index.ts` and what is actually deployed goes undetected until a production incident.

## Options Considered

### Option A: Manual code review only

- **Tradeoff**: Relies on reviewer knowledge; inconsistent; does not scale. Rejected.

### Option B: OPA (Open Policy Agent) with custom Pulumi integration

- **Tradeoff**: Powerful but requires significant custom integration work for Pulumi + Cloudflare. Overkill for our policy surface. Rejected.

### Option C: Pulumi CrossGuard

- **Integration**: Native to Pulumi — policy packs run as part of `pulumi up`
- **Language**: TypeScript (same as our infra code)
- **Enforcement**: Policies block (`mandatory`) or warn (`advisory`) before resources are created/updated
- **CI integration**: `pulumi up --policy-pack ./policy` in GitHub Actions

## Decision

**Option C: Pulumi CrossGuard** with a TypeScript policy pack in `infra/policy/`, plus two companion shell scripts for drift detection and post-deploy smoke testing.

### Policy Pack: `infra/policy/index.ts`

Six mandatory policies:

| Policy | Rule |
|--------|------|
| `r2-eu-region` | R2 buckets MUST specify `location: "EU"` (GDPR data residency) |
| `dns-proxied` | DNS A/CNAME records for `aigrija.ro` MUST have `proxied: true` (DDoS protection) |
| `access-session-limit` | Cloudflare Access applications MUST have session duration of 24 hours or less |
| `no-empty-secrets` | Workers secrets MUST NOT have empty string values (catches unset placeholders) |
| `admin-requires-access` | Subdomains matching `admin.*` or `*.admin.*` MUST have a Cloudflare Access policy attached |
| `preview-mirrors-prod` | Preview/staging Worker bindings MUST mirror production bindings (same KV namespaces, R2 buckets, AI binding) |

### Companion Scripts

**`scripts/validate-infra.sh`** — Config-code drift detection:
- Parses `wrangler.toml` bindings and compares against Pulumi state output
- Fails (exit 1) if a binding declared in `wrangler.toml` is absent from Pulumi state
- Runs before `pulumi up` in CI

**`scripts/infra-smoke-test.sh`** — Post-deploy HTTP verification:
- Hits known endpoints (`/api/health`, `/api/status`) after every deploy
- Verifies HTTP 200 responses and JSON structure
- Alerts (exit 1) if smoke test fails after deploy

### CI Integration

```yaml
# .github/workflows/deploy.yml
- name: Validate infra config drift
  run: bash scripts/validate-infra.sh

- name: Pulumi up with CrossGuard
  run: pulumi up --yes --policy-pack ./infra/policy
  env:
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}

- name: Post-deploy smoke test
  run: bash scripts/infra-smoke-test.sh
```

### Developer Workflow

```bash
# Before any infra change
bash scripts/validate-infra.sh

# Deploy with policy enforcement
cd infra && pulumi up --policy-pack ./policy

# After deploy
bash scripts/infra-smoke-test.sh
```

## Consequences

**Positive**:
- Policy violations are caught before resources are created — no manual audit needed
- GDPR data residency (EU-only R2) and security posture (Access, proxied DNS) enforced automatically
- Drift detection closes the gap between declared config and actual deployed state
- Smoke tests provide immediate post-deploy confidence

**Negative**:
- CrossGuard policy pack adds ~200 lines of TypeScript to maintain
- `pulumi up` is slightly slower with policy evaluation
- Policy false positives (e.g., a non-admin subdomain matching the `admin.*` pattern) require policy tuning

**Risks**:
- CrossGuard is a Pulumi Business tier feature for remote policy enforcement; local `--policy-pack` flag works on all tiers including free. Verify tier requirements if migrating to Pulumi Cloud enforcement.
- Smoke test HTTP checks will fail if the Worker cold-starts slowly — add retry logic with `--max-time` and `--retry` flags in `infra-smoke-test.sh`
