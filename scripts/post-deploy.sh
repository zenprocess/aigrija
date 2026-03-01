#!/usr/bin/env bash
set -euo pipefail

echo "=== Post-deploy: Fetching Pulumi outputs ==="

KV_ID=$(PULUMI_CONFIG_PASSPHRASE="$PULUMI_CONFIG_PASSPHRASE" pulumi stack output kvNamespaceId --cwd infra 2>/dev/null)
D1_ID=$(PULUMI_CONFIG_PASSPHRASE="$PULUMI_CONFIG_PASSPHRASE" pulumi stack output d1DatabaseId --cwd infra 2>/dev/null)
PREVIEW_KV_ID=$(PULUMI_CONFIG_PASSPHRASE="$PULUMI_CONFIG_PASSPHRASE" pulumi stack output previewKvId --cwd infra 2>/dev/null)
PREVIEW_D1_ID=$(PULUMI_CONFIG_PASSPHRASE="$PULUMI_CONFIG_PASSPHRASE" pulumi stack output previewDbId --cwd infra 2>/dev/null)

echo "KV Namespace ID: $KV_ID"
echo "D1 Database ID:  $D1_ID"
echo "Preview KV ID:   $PREVIEW_KV_ID"
echo "Preview D1 ID:   $PREVIEW_D1_ID"

python3 -c "
with open('wrangler.toml', 'r') as f:
    content = f.read()
content = content.replace('id = \"TBD\"', 'id = \"$KV_ID\"', 1)
content = content.replace('database_id = \"TBD\"', 'database_id = \"$D1_ID\"', 1)
content = content.replace('id = \"TBD_PREVIEW\"', 'id = \"$PREVIEW_KV_ID\"', 1)
content = content.replace('database_id = \"TBD_PREVIEW\"', 'database_id = \"$PREVIEW_D1_ID\"', 1)
with open('wrangler.toml', 'w') as f:
    f.write(content)
"

echo "=== wrangler.toml updated with actual IDs ==="

echo "=== Applying D1 migrations (prod) ==="
npx wrangler d1 execute ai-grija-admin --file=migrations/0001_admin_schema.sql --remote
npx wrangler d1 execute ai-grija-admin --file=migrations/0002_conversations_reports.sql --remote

echo "=== Applying D1 migrations (preview) ==="
npx wrangler d1 execute ai-grija-admin-preview --file=migrations/0001_admin_schema.sql --remote
npx wrangler d1 execute ai-grija-admin-preview --file=migrations/0002_conversations_reports.sql --remote

echo "=== Telegram webhook reminder ==="
echo "Run manually after deploy:"
echo "  curl -X POST 'https://api.telegram.org/bot\$TELEGRAM_BOT_TOKEN/setWebhook?url=https://ai-grija.ro/webhook/telegram&secret_token=\$TELEGRAM_WEBHOOK_SECRET'"

echo "=== Done! Deploy with: npx wrangler deploy ==="
