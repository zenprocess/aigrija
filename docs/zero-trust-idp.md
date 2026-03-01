# Zero Trust IdP Setup — Admin Panel SSO

## Current State

Admin panel uses Bearer token (ADMIN_API_KEY). Sufficient for single-admin but does not scale.

## Target: Cloudflare Access

Replace ADMIN_API_KEY with Cloudflare Access for SSO, per-user audit trails, session management, MFA.

## Setup Steps

### 1. Create Access Application

- Zero Trust > Access > Applications > Self-hosted
- Domain: ai-grija.ro, Path: /api/admin/*

### 2. Configure IdP

| Provider | Path |
|----------|------|
| Google Workspace | Zero Trust > Settings > Authentication > Google |
| GitHub | Zero Trust > Settings > Authentication > GitHub |
| One-time PIN | Built-in email OTP |

### 3. Access Policy

- Action: Allow
- Include: emails ending in @yourdomain.com
- Require: Country is Romania (optional)

### 4. Validate JWT in Worker

```typescript
async function validateAccessJWT(request: Request, env: Env): Promise<string | null> {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return null;
  const certsUrl = `https://${env.CF_TEAM_DOMAIN}/cdn-cgi/access/certs`;
  // JWT verification against CF certs
  return decodedEmail;
}
```

### 5. Migration Path

1. Phase 1 (current): ADMIN_API_KEY Bearer token
2. Phase 2: CF Access in front, ADMIN_API_KEY as fallback
3. Phase 3: Remove ADMIN_API_KEY, Access-only

### 6. Secrets

| Variable | Purpose |
|----------|---------|
| CF_TEAM_DOMAIN | Zero Trust team domain |
| CF_ACCESS_AUD | Application AUD tag |

Store in Infisical, bind via `wrangler secret put`.
