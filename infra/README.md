# ai-grija-infra

Pulumi TypeScript project that provisions Cloudflare infrastructure for ai-grija.ro.

## What this provisions

| Resource | Type | Details |
|----------|------|---------|
| `ai-grija-cache` | KV Namespace | Cache binding for the Worker |
| `ai-grija-share-cards` | R2 Bucket | Share-card image storage (EEUR region) |
| `ai-grija-admin` | D1 Database | Structured data — conversations, reports, audit logs |
| `draft-generation` | Queue | Async draft generation pipeline |
| `ai-grija.ro` | DNS CNAME | Root domain → Workers (proxied) |
| `admin.ai-grija.ro` | DNS CNAME | Admin subdomain → Workers (proxied) |
| `ai-grija Admin` | Zero Trust Access App | Protects admin.ai-grija.ro |
| Admin policy | Zero Trust Access Policy | Allow admin@zen-labs.ro |
| Worker secrets | `WorkersSecret` x12 | Encrypted secrets bound to the `ai-grija-ro` Worker |

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/) installed
- Cloudflare API token with Workers, KV, R2, D1, Queues, DNS, and Access permissions
- Node.js 18+

Set the CF API token in your environment before running:

```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
```

## Configuration

### Required config

```bash
cd infra
pulumi stack init dev
pulumi config set cloudflareAccountId "your-cf-account-id"
pulumi config set cloudflareZoneId "your-cf-zone-id"   # Zone ID for ai-grija.ro
```

Find your Zone ID in the Cloudflare dashboard → ai-grija.ro → Overview → API section.

### Secrets (encrypted in Pulumi state)

Run `pulumi config set --secret <name> <value>` for each:

| Config key | Source |
|------------|--------|
| googleSafeBrowsingKey | Google Cloud Console |
| virustotalApiKey | virustotal.com/gui/my-apikey |
| urlhausAuthKey | auth.abuse.ch |
| telegramBotToken | @BotFather |
| telegramWebhookSecret | openssl rand -hex 32 |
| whatsappAccessToken | Meta Business |
| whatsappVerifyToken | openssl rand -hex 32 |
| whatsappPhoneNumberId | Meta Business |
| adminApiKey | openssl rand -hex 32 |
| telegramAdminChatId | Telegram — chat ID for admin notifications |
| sanityWriteToken | sanity.io project settings |
| launchdarklySDKKey | LaunchDarkly project settings |

## Deploy

```bash
cd infra
npm install
pulumi up
```

Review the preview, type `yes` to confirm.

## Post-deploy: update wrangler.toml

After `pulumi up` completes, retrieve the output IDs and update `../wrangler.toml`:

```bash
pulumi stack output kvNamespaceId   # → [[kv_namespaces]] id
pulumi stack output d1DatabaseId    # → [[d1_databases]] database_id
```

### Analytics Engine Dataset

Workers Analytics Engine datasets are created automatically on first write — no provisioning needed.
To list existing datasets: `wrangler analytics-engine datasets list`

## Outputs

| Output | Description |
|--------|-------------|
| `kvNamespaceId` | KV namespace ID — update `wrangler.toml` |
| `r2BucketName` | R2 bucket name (`ai-grija-share-cards`) |
| `d1DatabaseId` | D1 database ID — update `wrangler.toml` |
| `queueId` | Queue resource ID (`draft-generation`) |
| `zeroTrustAppId` | Zero Trust Access Application ID |
| `workerName` | Worker script name (`ai-grija-ro`) |
| `previewKvId` | Preview KV namespace ID — update `wrangler.toml` `[env.preview]` |
| `previewDbId` | Preview D1 database ID — update `wrangler.toml` `[env.preview]` |
| `previewR2BucketName` | Preview R2 bucket name (`ai-grija-share-cards-preview`) |

## Preview Environment

The preview environment mirrors production but runs on `pre.ai-grija.ro` with isolated Cloudflare resources.

### Deploy to preview

```bash
npx wrangler deploy --env preview
```

### Resources

- Separate KV namespace, R2 bucket, and D1 database — changes do not affect production data.
- Zero Trust Access protects `pre-admin.ai-grija.ro` (same email allowlist as production).
- Secrets are shared from the same Pulumi config keys — rotate per environment if needed.

### Post-deploy: update wrangler.toml preview IDs

After `pulumi up`, retrieve preview IDs and replace the `TBD_PREVIEW` placeholders in `wrangler.toml`:

```bash
pulumi stack output previewKvId    # → [[env.preview.kv_namespaces]] id
pulumi stack output previewDbId    # → [[env.preview.d1_databases]] database_id
```

### E2E tests against preview

```bash
BASE_URL=https://pre.ai-grija.ro npx playwright test
```

The GitHub Actions workflow `.github/workflows/preview-deploy.yml` runs this automatically on every `feat/*` and `fix/*` branch push and on pull requests targeting `main`.
