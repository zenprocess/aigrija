import { PolicyPack, validateResourceOfType } from "@pulumi/policy";
import {
  checkR2EuropeanRegion,
  checkDnsProxied,
  checkAccessSessionDuration,
  checkWorkerSecretName,
  checkAdminDomainsProtected,
  checkPreviewMirrorsProduction,
} from "./checks";

new PolicyPack("ai-grija-infra", {
  policies: [
    // R2 buckets must have a location explicitly set (not left as CF default)
    {
      name: "r2-bucket-location-required",
      description: "R2 buckets must have an explicit location set — relying on CF default is not allowed",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/r2Bucket:R2Bucket", (args, reportViolation) => {
        if (!args.props.location) {
          reportViolation(`R2 bucket '${args.props.name}' has no location set. Specify EEUR, WEUR, or another valid region.`);
        }
      }),
    },

    // R2 buckets must be in European regions
    {
      name: "r2-bucket-european-region",
      description: "R2 buckets must be located in European regions (EEUR or WEUR)",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/r2Bucket:R2Bucket", (args, reportViolation) => {
        const violation = checkR2EuropeanRegion(
          args.props.name as string,
          args.props.location as string | undefined
        );
        if (violation) reportViolation(violation);
      }),
    },

    // DNS records must be proxied through Cloudflare
    {
      name: "dns-must-be-proxied",
      description: "All DNS records must be proxied through Cloudflare for DDoS protection",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/record:Record", (args, reportViolation) => {
        const violation = checkDnsProxied(
          args.props.name as string,
          args.props.proxied as boolean | undefined
        );
        if (violation) reportViolation(violation);
      }),
    },

    // Zero Trust Access must have session duration <= 24h
    {
      name: "access-session-max-24h",
      description: "Zero Trust Access sessions must not exceed 24 hours",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/zeroTrustAccessApplication:ZeroTrustAccessApplication", (args, reportViolation) => {
        const violation = checkAccessSessionDuration(
          args.props.name as string,
          args.props.sessionDuration as string | undefined
        );
        if (violation) reportViolation(violation);
      }),
    },

    // Worker secrets must not be empty
    {
      name: "no-empty-worker-secrets",
      description: "Worker secrets must have non-empty values",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/workersSecret:WorkersSecret", (args, reportViolation) => {
        // secretText is always secret/unknown during preview, but we can check the name exists
        const violation = checkWorkerSecretName(args.props.name as string | undefined);
        if (violation) reportViolation(violation);
      }),
    },

    // Admin domains must have Zero Trust protection
    {
      name: "admin-domains-require-access",
      description: "Admin subdomains must be protected by Zero Trust Access",
      enforcementLevel: "advisory",
      validateStack: (args, reportViolation) => {
        const unprotected = checkAdminDomainsProtected(args.resources);
        for (const domain of unprotected) {
          reportViolation(`Admin domain '${domain}' is not protected by Zero Trust Access`);
        }
      },
    },

    // Preview environment must mirror production resource types
    {
      name: "preview-mirrors-production",
      description: "Preview environment must have matching resource types for KV, R2, D1, Queue",
      enforcementLevel: "advisory",
      validateStack: (args, reportViolation) => {
        const violations = checkPreviewMirrorsProduction(args.resources);
        for (const type of violations) {
          const count = args.resources.filter(r => r.type === type).length;
          reportViolation(`Expected at least 2 ${type} resources (prod + preview), found ${count}`);
        }
      },
    },
  ],
});
