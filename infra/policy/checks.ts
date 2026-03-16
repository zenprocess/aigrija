/**
 * Pure check functions for infra CrossGuard policies.
 *
 * These functions contain no Pulumi runtime imports so they can be unit-tested
 * directly with Vitest without a Pulumi engine running. `infra/policy/index.ts`
 * imports and calls them inside its `validateResource` / `validateStack` callbacks.
 */

/** Minimal resource shape used by stack-level checks. */
export interface PolicyResource {
  type: string;
  props: Record<string, unknown>;
}

/** Returns violation message if the R2 location is non-European, else null. */
export function checkR2EuropeanRegion(name: string, location: string | undefined): string | null {
  if (location && !["EEUR", "WEUR"].includes(location)) {
    return `R2 bucket '${name}' is in ${location}, must be EEUR or WEUR for GDPR compliance`;
  }
  return null;
}

/** Returns violation message if the DNS record is not proxied, else null. */
export function checkDnsProxied(name: string, proxied: boolean | undefined): string | null {
  if (proxied !== true) {
    return `DNS record '${name}' must have proxied=true`;
  }
  return null;
}

/** Returns violation message if the Access session duration is not in the allowed set. */
export function checkAccessSessionDuration(name: string, duration: string | undefined): string | null {
  const allowed = ["24h", "12h", "1h"];
  if (duration && !allowed.includes(duration)) {
    return `Access app '${name}' session duration ${duration} exceeds 24h policy`;
  }
  return null;
}

/** Returns violation message if the worker secret name is empty. */
export function checkWorkerSecretName(name: string | undefined): string | null {
  if (!name || name.trim() === "") {
    return "Worker secret has empty name";
  }
  return null;
}

/** Returns list of admin domains NOT protected by any Access app in the resource list. */
export function checkAdminDomainsProtected(resources: PolicyResource[]): string[] {
  const accessApps = resources.filter(
    r => r.type === "cloudflare:index/zeroTrustAccessApplication:ZeroTrustAccessApplication"
  );
  const adminDomains = ["admin.ai-grija.ro", "pre-admin.ai-grija.ro"];
  const protectedDomains = accessApps.map(a => a.props.domain as string).filter(Boolean);
  return adminDomains.filter(d => !protectedDomains.includes(d));
}

/** Returns list of resource types that have fewer than 2 instances. */
export function checkPreviewMirrorsProduction(resources: PolicyResource[]): string[] {
  const requiredTypes = [
    "cloudflare:index/workersKvNamespace:WorkersKvNamespace",
    "cloudflare:index/r2Bucket:R2Bucket",
    "cloudflare:index/d1Database:D1Database",
    "cloudflare:index/queue:Queue",
  ];
  return requiredTypes.filter(type => resources.filter(r => r.type === type).length < 2);
}
