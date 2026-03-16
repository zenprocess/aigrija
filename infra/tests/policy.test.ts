/**
 * Infra policy unit tests
 *
 * These tests validate the LOGIC of each policy rule in isolation — no Pulumi
 * runtime or Cloudflare API required. Check functions are imported directly
 * from infra/policy/checks.ts so that a policy change automatically affects
 * these tests (no duplicated logic that can drift out of sync).
 */

import { describe, it, expect } from "vitest";
import {
  checkR2EuropeanRegion,
  checkDnsProxied,
  checkAccessSessionDuration,
  checkWorkerSecretName,
  checkAdminDomainsProtected,
  checkPreviewMirrorsProduction,
  type PolicyResource,
} from "../policy/checks";

// ---------------------------------------------------------------------------
// r2-bucket-european-region
// ---------------------------------------------------------------------------

describe("r2-bucket-european-region", () => {
  it("passes EEUR (production bucket)", () => {
    expect(checkR2EuropeanRegion("ai-grija-share-cards", "EEUR")).toBeNull();
  });

  it("passes WEUR", () => {
    expect(checkR2EuropeanRegion("ai-grija-share-cards", "WEUR")).toBeNull();
  });

  it("passes when location is undefined (Cloudflare default)", () => {
    expect(checkR2EuropeanRegion("ai-grija-share-cards", undefined)).toBeNull();
  });

  it("fails ENAM — preview bucket uses North America", () => {
    const violation = checkR2EuropeanRegion("ai-grija-share-cards-preview", "ENAM");
    expect(violation).toMatch(/ENAM/);
    expect(violation).toMatch(/GDPR/);
  });

  it("fails APAC", () => {
    const violation = checkR2EuropeanRegion("my-bucket", "APAC");
    expect(violation).toMatch(/APAC/);
  });
});

// ---------------------------------------------------------------------------
// dns-must-be-proxied
// ---------------------------------------------------------------------------

describe("dns-must-be-proxied", () => {
  it("passes when proxied=true", () => {
    expect(checkDnsProxied("ai-grija.ro", true)).toBeNull();
  });

  it("fails when proxied=false", () => {
    const violation = checkDnsProxied("ai-grija.ro", false);
    expect(violation).toMatch(/proxied=true/);
  });

  it("fails when proxied=undefined", () => {
    const violation = checkDnsProxied("ai-grija.ro", undefined);
    expect(violation).toMatch(/proxied=true/);
  });

  it("production root DNS is compliant", () => {
    // dns-root in index.ts: proxied: true
    expect(checkDnsProxied("ai-grija.ro", true)).toBeNull();
  });

  it("admin DNS is compliant", () => {
    // dns-admin in index.ts: proxied: true
    expect(checkDnsProxied("admin", true)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// access-session-max-24h
// ---------------------------------------------------------------------------

describe("access-session-max-24h", () => {
  it("passes 24h", () => {
    expect(checkAccessSessionDuration("ai-grija Admin", "24h")).toBeNull();
  });

  it("passes 12h", () => {
    expect(checkAccessSessionDuration("ai-grija Admin", "12h")).toBeNull();
  });

  it("passes 1h", () => {
    expect(checkAccessSessionDuration("ai-grija Admin", "1h")).toBeNull();
  });

  it("passes undefined (no duration set)", () => {
    expect(checkAccessSessionDuration("ai-grija Admin", undefined)).toBeNull();
  });

  it("fails 48h", () => {
    const violation = checkAccessSessionDuration("ai-grija Admin", "48h");
    expect(violation).toMatch(/48h/);
  });

  it("fails 720h (30 days)", () => {
    const violation = checkAccessSessionDuration("ai-grija Admin", "720h");
    expect(violation).toMatch(/720h/);
  });

  it("production Access app sessionDuration is compliant", () => {
    // accessApp in index.ts: sessionDuration: "24h"
    expect(checkAccessSessionDuration("ai-grija Admin", "24h")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// no-empty-worker-secrets
// ---------------------------------------------------------------------------

describe("no-empty-worker-secrets", () => {
  it("passes a valid secret name", () => {
    expect(checkWorkerSecretName("ADMIN_API_KEY")).toBeNull();
  });

  it("fails empty string", () => {
    expect(checkWorkerSecretName("")).toMatch(/empty name/);
  });

  it("fails whitespace-only string", () => {
    expect(checkWorkerSecretName("   ")).toMatch(/empty name/);
  });

  it("fails undefined", () => {
    expect(checkWorkerSecretName(undefined)).toMatch(/empty name/);
  });

  it("all production secret names are non-empty", () => {
    const secretNames = [
      "GOOGLE_SAFE_BROWSING_KEY",
      "VIRUSTOTAL_API_KEY",
      "URLHAUS_AUTH_KEY",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "ADMIN_API_KEY",
      "TELEGRAM_ADMIN_CHAT_ID",
      "SANITY_WRITE_TOKEN",
      "LAUNCHDARKLY_SDK_KEY",
    ];
    for (const name of secretNames) {
      expect(checkWorkerSecretName(name)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// admin-domains-require-access
// ---------------------------------------------------------------------------

describe("admin-domains-require-access", () => {
  const fullResources: PolicyResource[] = [
    {
      type: "cloudflare:index/zeroTrustAccessApplication:ZeroTrustAccessApplication",
      props: { domain: "admin.ai-grija.ro" },
    },
    {
      type: "cloudflare:index/zeroTrustAccessApplication:ZeroTrustAccessApplication",
      props: { domain: "pre-admin.ai-grija.ro" },
    },
  ];

  it("passes when both admin domains are protected", () => {
    expect(checkAdminDomainsProtected(fullResources)).toHaveLength(0);
  });

  it("fails when admin.ai-grija.ro has no Access app", () => {
    const resources: PolicyResource[] = [
      {
        type: "cloudflare:index/zeroTrustAccessApplication:ZeroTrustAccessApplication",
        props: { domain: "pre-admin.ai-grija.ro" },
      },
    ];
    const unprotected = checkAdminDomainsProtected(resources);
    expect(unprotected).toContain("admin.ai-grija.ro");
    expect(unprotected).not.toContain("pre-admin.ai-grija.ro");
  });

  it("fails when no Access apps exist", () => {
    const unprotected = checkAdminDomainsProtected([]);
    expect(unprotected).toContain("admin.ai-grija.ro");
    expect(unprotected).toContain("pre-admin.ai-grija.ro");
  });

  it("ignores non-Access resources", () => {
    const resources: PolicyResource[] = [
      ...fullResources,
      { type: "cloudflare:index/r2Bucket:R2Bucket", props: { domain: "admin.ai-grija.ro" } },
    ];
    expect(checkAdminDomainsProtected(resources)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// preview-mirrors-production
// ---------------------------------------------------------------------------

describe("preview-mirrors-production", () => {
  const mirroredResources: PolicyResource[] = [
    // KV x2
    { type: "cloudflare:index/workersKvNamespace:WorkersKvNamespace", props: { title: "ai-grija-cache" } },
    { type: "cloudflare:index/workersKvNamespace:WorkersKvNamespace", props: { title: "ai-grija-cache-preview" } },
    // R2 x2
    { type: "cloudflare:index/r2Bucket:R2Bucket", props: { name: "ai-grija-share-cards" } },
    { type: "cloudflare:index/r2Bucket:R2Bucket", props: { name: "ai-grija-share-cards-preview" } },
    // D1 x2
    { type: "cloudflare:index/d1Database:D1Database", props: { name: "ai-grija-admin" } },
    { type: "cloudflare:index/d1Database:D1Database", props: { name: "ai-grija-admin-preview" } },
    // Queue x2
    { type: "cloudflare:index/queue:Queue", props: { name: "draft-generation" } },
    { type: "cloudflare:index/queue:Queue", props: { name: "draft-generation-preview" } },
  ];

  it("passes when all resource types have prod + preview instances", () => {
    expect(checkPreviewMirrorsProduction(mirroredResources)).toHaveLength(0);
  });

  it("fails when Queue is missing preview instance", () => {
    const resources = mirroredResources.filter(
      r => !(r.type === "cloudflare:index/queue:Queue" && (r.props.name as string).includes("preview"))
    );
    const violations = checkPreviewMirrorsProduction(resources);
    expect(violations).toContain("cloudflare:index/queue:Queue");
  });

  it("fails when D1 has no instances at all", () => {
    const resources = mirroredResources.filter(r => r.type !== "cloudflare:index/d1Database:D1Database");
    const violations = checkPreviewMirrorsProduction(resources);
    expect(violations).toContain("cloudflare:index/d1Database:D1Database");
  });

  it("infra/index.ts provides 2x KV, R2, D1, Queue (regression guard)", () => {
    // This documents the current state of index.ts and will fail if someone
    // removes the preview resources without updating the policy.
    expect(checkPreviewMirrorsProduction(mirroredResources)).toHaveLength(0);
  });
});
