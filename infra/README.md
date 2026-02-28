# ai-grija-infra

Pulumi TypeScript project that provisions Cloudflare infrastructure for ai-grija.ro.

## What this provisions

| Resource | Type | Details |
|----------|------|---------|
| `ai-grija-cache` | KV Namespace | Cache binding for the Worker |
| `ai-grija-share-cards` | R2 Bucket | Share-card image storage (EEUR region) |
| Worker secrets | `WorkersSecret` x9 | Encrypted secrets bound to the `ai-grija-ro` Worker |

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/) installed
- Cloudflare API token with Workers, KV, and R2 permissions
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
```

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

## Deploy

```bash
cd infra
npm install
pulumi up
```

Review the preview, type `yes` to confirm.

## Update wrangler.toml with the KV namespace ID

After `pulumi up` completes:

```bash
pulumi stack output kvNamespaceId
```

Then in `../wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "<paste kvNamespaceId here>"
```

## Outputs

| Output | Description |
|--------|-------------|
| `kvNamespaceId` | KV namespace ID — update `wrangler.toml` |
| `r2BucketName` | R2 bucket name (`ai-grija-share-cards`) |
| `workerName` | Worker script name (`ai-grija-ro`) |
