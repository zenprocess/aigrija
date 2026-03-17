import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

// See infra/README.md for configuration instructions.

const config = new pulumi.Config();
const accountId = config.require("cloudflareAccountId");
const zoneId = config.require("cloudflareZoneId");
const workerName = "ai-grija-ro";
const adminEmailDomains = config.require("adminEmailDomains").split(",");
const adminGroupIds = config.require("adminGroupIds").split(",");

// ---------------------------------------------------------------------------
// KV Namespace — used as CACHE binding in wrangler.toml
// ---------------------------------------------------------------------------
const kvNamespace = new cloudflare.WorkersKvNamespace("ai-grija-cache", {
  accountId,
  title: "ai-grija-cache",
}, { import: `${accountId}/fd0667f87eb44232badd391fc3c72bde` });

// ---------------------------------------------------------------------------
// R2 Bucket — Pulumi state backend
// Stores encrypted Pulumi state for this stack. Created here to bring it
// under IaC management (previously created manually — ADR-0015).
//
// TODO(versioning): R2 object versioning must be enabled manually in the
// Cloudflare dashboard. There is no API/Pulumi support as of 2026-03.
// Dashboard path: R2 → ai-grija-pulumi-state → Settings → Versioning → Enable
//
// TODO(lifecycle): R2 lifecycle rules (expire noncurrent versions after 30 days)
// are not yet supported by the @pulumi/cloudflare provider. Once the provider
// exposes cloudflare.R2BucketLifecycle or equivalent, add a rule here:
//   noncurrentVersionExpiration: { noncurrentDays: 30 }
// Track: https://github.com/pulumi/pulumi-cloudflare/issues
// ---------------------------------------------------------------------------
const stateBucket = new cloudflare.R2Bucket("pulumi-state-bucket", {
  accountId,
  name: "ai-grija-pulumi-state",
  location: "EEUR",
}, { import: `${accountId}/ai-grija-pulumi-state` });

// ---------------------------------------------------------------------------
// R2 Bucket — share cards storage, closest region to Romania
// ---------------------------------------------------------------------------
const r2Bucket = new cloudflare.R2Bucket("ai-grija-share-cards", {
  accountId,
  name: "ai-grija-share-cards",
  location: "EEUR",
}, { import: `${accountId}/ai-grija-share-cards` });

// ---------------------------------------------------------------------------
// D1 Database — admin DB for structured data (conversations, reports, audit)
// After `pulumi up`, run: pulumi stack output d1DatabaseId
// Then update wrangler.toml [[d1_databases]] database_id field.
// ---------------------------------------------------------------------------
const adminDb = new cloudflare.D1Database("ai-grija-admin", {
  accountId,
  name: "ai-grija-admin",
}, { import: `${accountId}/9d15ccda-3648-4a93-8856-2ac5b5ffe199` });

// ---------------------------------------------------------------------------
// Queue — async draft generation pipeline
// Supported in @pulumi/cloudflare v5+
// Fallback (if provider support missing): npx wrangler queues create draft-generation
// ---------------------------------------------------------------------------
const draftQueue = new cloudflare.Queue("draft-generation", {
  accountId,
  name: "draft-generation",
});

// ---------------------------------------------------------------------------
// Analytics Engine Dataset
// Note: Workers Analytics Engine datasets are created automatically on first
// write from the Worker — no Pulumi resource needed.
// Fallback reference: wrangler analytics-engine datasets list
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DNS Records — ai-grija.ro and admin.ai-grija.ro proxied through Cloudflare
// ---------------------------------------------------------------------------
new cloudflare.Record("dns-root", {
  zoneId,
  name: "ai-grija.ro",
  type: "CNAME",
  content: "ai-grija-ro.workers.dev",
  proxied: true,
});

new cloudflare.Record("dns-admin", {
  zoneId,
  name: "admin",
  type: "CNAME",
  content: "ai-grija-ro.workers.dev",
  proxied: true,
});

// ---------------------------------------------------------------------------
// Zero Trust Access — protect admin.ai-grija.ro
// ---------------------------------------------------------------------------
const accessApp = new cloudflare.ZeroTrustAccessApplication("admin-access", {
  zoneId,
  name: "ai-grija Admin",
  domain: "admin.ai-grija.ro",
  type: "self_hosted",
  sessionDuration: "24h",
  autoRedirectToIdentity: false,
});

new cloudflare.ZeroTrustAccessPolicy("admin-policy", {
  applicationId: accessApp.id,
  zoneId,
  name: "Allow team",
  decision: "allow",
  precedence: 1,
  includes: [
    { emailDomains: adminEmailDomains },
  ],
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
  { configKey: "telegramAdminChatId",    secretName: "TELEGRAM_ADMIN_CHAT_ID" },
  { configKey: "sanityWriteToken",       secretName: "SANITY_WRITE_TOKEN" },
  { configKey: "launchdarklySDKKey",     secretName: "LAUNCHDARKLY_SDK_KEY" },
  { configKey: "phishtankApiKey",        secretName: "PHISHTANK_API_KEY" },
];

for (const { configKey, secretName } of secretDefs) {
  new cloudflare.WorkersSecret(`secret-${secretName.toLowerCase().replace(/_/g, "-")}`, {
    accountId,
    scriptName: workerName,
    name: secretName,
    secretText: config.requireSecret(configKey),
  }, { import: `${accountId}/${workerName}/${secretName}` });
}


// ---------------------------------------------------------------------------
// Preview Environment — pre.ai-grija.ro
// ---------------------------------------------------------------------------
const previewWorkerName = "ai-grija-ro-preview";

const previewKv = new cloudflare.WorkersKvNamespace("ai-grija-cache-preview", {
  accountId,
  title: "ai-grija-cache-preview",
}, { import: `${accountId}/912ef2fa84a445f0bb916896881a9fac` });

const previewR2 = new cloudflare.R2Bucket("ai-grija-share-cards-preview", {
  accountId,
  name: "ai-grija-share-cards-preview",
  location: "EEUR",
}, { import: `${accountId}/ai-grija-share-cards-preview` });

const previewDb = new cloudflare.D1Database("ai-grija-admin-preview", {
  accountId,
  name: "ai-grija-admin-preview",
}, { import: `${accountId}/4d78649f-36ef-49bf-bcc1-672c61c5dd93` });

const previewQueue = new cloudflare.Queue("draft-generation-preview", {
  accountId,
  name: "draft-generation-preview",
});

// Preview DNS
new cloudflare.Record("dns-preview", {
  zoneId,
  name: "pre",
  type: "CNAME",
  content: `${previewWorkerName}.workers.dev`,
  proxied: true,
});

new cloudflare.Record("dns-preview-admin", {
  zoneId,
  name: "pre-admin",
  type: "CNAME",
  content: `${previewWorkerName}.workers.dev`,
  proxied: true,
});

// Zero Trust for preview admin
const previewAccessApp = new cloudflare.ZeroTrustAccessApplication("preview-admin-access", {
  zoneId,
  name: "ai-grija Preview Admin",
  domain: "pre-admin.ai-grija.ro",
  type: "self_hosted",
  sessionDuration: "24h",
  autoRedirectToIdentity: false,
});

new cloudflare.ZeroTrustAccessPolicy("preview-admin-policy", {
  applicationId: previewAccessApp.id,
  zoneId,
  name: "Allow team preview",
  decision: "allow",
  precedence: 1,
  includes: [
    { emailDomains: adminEmailDomains },
    { groups: adminGroupIds },
  ],
});

// Preview secrets — same keys, can use test values
for (const { configKey, secretName } of secretDefs) {
  new cloudflare.WorkersSecret(`preview-secret-${secretName.toLowerCase().replace(/_/g, "-")}`, {
    accountId,
    scriptName: previewWorkerName,
    name: secretName,
    secretText: config.requireSecret(configKey),
  });
}

// ---------------------------------------------------------------------------
// R2 Bucket — CDN assets (error pages, static files) served via cdn.ai-grija.ro
// Referenced by CF Custom Error Pages below. ADR-0016.
// ---------------------------------------------------------------------------
const cdnBucket = new cloudflare.R2Bucket("ai-grija-assets", {
  accountId,
  name: "ai-grija-assets",
  location: "EEUR",
}, { import: `${accountId}/ai-grija-assets` });

// CDN subdomain — cdn.ai-grija.ro proxied to Workers dev subdomain
new cloudflare.Record("dns-cdn", {
  zoneId,
  name: "cdn",
  type: "CNAME",
  content: "ai-grija-ro.workers.dev",
  proxied: true,
});

// ---------------------------------------------------------------------------
// Studio DNS — studio.ai-grija.ro and pre-studio.ai-grija.ro
// Sanity Studio is deployed as a separate Workers target (ai-grija-studio).
// Independent deploy lifecycle — see .github/workflows/deploy-studio.yml.
// ---------------------------------------------------------------------------
new cloudflare.Record("dns-studio", {
  zoneId,
  name: "studio",
  type: "CNAME",
  content: "ai-grija-studio.workers.dev",
  proxied: true,
});

new cloudflare.Record("dns-studio-preview", {
  zoneId,
  name: "pre-studio",
  type: "CNAME",
  content: "ai-grija-studio-preview.workers.dev",
  proxied: true,
});

// ---------------------------------------------------------------------------
// CF Custom Error Pages — served from R2 CDN for edge-level 500 and 1000 errors
// ---------------------------------------------------------------------------
const cfErrorPageUrl = "https://cdn.ai-grija.ro/cf-error.html";

new cloudflare.CustomPages("custom-error-500", {
  zoneId,
  type: "500_errors",
  url: cfErrorPageUrl,
  state: "customized",
}, { import: `zone/${zoneId}/500_errors` });

new cloudflare.CustomPages("custom-error-1000", {
  zoneId,
  type: "1000_errors",
  url: cfErrorPageUrl,
  state: "customized",
}, { import: `zone/${zoneId}/1000_errors` });

// ---------------------------------------------------------------------------
// Stack Outputs
// ---------------------------------------------------------------------------
export const kvNamespaceId = kvNamespace.id;
export const r2BucketName = r2Bucket.name;
export const d1DatabaseId = adminDb.id;
export const queueId = draftQueue.id;
export const zeroTrustAppId = accessApp.id;
export { workerName };
export const previewKvId = previewKv.id;
export const previewDbId = previewDb.id;
export const previewR2BucketName = previewR2.name;
export const previewQueueId = previewQueue.id;
export const stateBucketName = stateBucket.name;
export const cdnBucketName = cdnBucket.name;
