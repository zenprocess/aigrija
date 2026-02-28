import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

// See infra/README.md for configuration instructions.

const config = new pulumi.Config();
const accountId = config.require("cloudflareAccountId");
const workerName = "ai-grija-ro";

// ---------------------------------------------------------------------------
// KV Namespace — used as CACHE binding in wrangler.toml
// ---------------------------------------------------------------------------
const kvNamespace = new cloudflare.WorkersKvNamespace("ai-grija-cache", {
  accountId,
  title: "ai-grija-cache",
});

// ---------------------------------------------------------------------------
// R2 Bucket — share cards storage, closest region to Romania
// ---------------------------------------------------------------------------
const r2Bucket = new cloudflare.R2Bucket("ai-grija-share-cards", {
  accountId,
  name: "ai-grija-share-cards",
  location: "EEUR",
});

// ---------------------------------------------------------------------------
// Worker Secrets
// All values come from Pulumi config (encrypted at rest in the state file).
// ---------------------------------------------------------------------------
const secretDefs: { configKey: string; secretName: string }[] = [
  { configKey: "googleSafeBrowsingKey",  secretName: "GOOGLE_SAFE_BROWSING_KEY" },
  { configKey: "virustotalApiKey",       secretName: "VIRUSTOTAL_API_KEY" },
  { configKey: "urlhausAuthKey",         secretName: "URLHAUS_AUTH_KEY" },
  { configKey: "telegramBotToken",       secretName: "TELEGRAM_BOT_TOKEN" },
  { configKey: "telegramWebhookSecret",  secretName: "TELEGRAM_WEBHOOK_SECRET" },
  { configKey: "whatsappAccessToken",    secretName: "WHATSAPP_ACCESS_TOKEN" },
  { configKey: "whatsappVerifyToken",    secretName: "WHATSAPP_VERIFY_TOKEN" },
  { configKey: "whatsappPhoneNumberId",  secretName: "WHATSAPP_PHONE_NUMBER_ID" },
  { configKey: "adminApiKey",            secretName: "ADMIN_API_KEY" },
];

for (const { configKey, secretName } of secretDefs) {
  new cloudflare.WorkersSecret(`secret-${secretName.toLowerCase().replace(/_/g, "-")}`, {
    accountId,
    scriptName: workerName,
    name: secretName,
    secretText: config.requireSecret(configKey),
  });
}

// ---------------------------------------------------------------------------
// Stack Outputs
// ---------------------------------------------------------------------------
export const kvNamespaceId = kvNamespace.id;
export const r2BucketName = r2Bucket.name;
export { workerName };
