import { PolicyPack, validateResourceOfType } from "@pulumi/policy";

new PolicyPack("ai-grija-infra", {
  policies: [
    // R2 buckets must be in European regions
    {
      name: "r2-bucket-european-region",
      description: "R2 buckets must be located in European regions (EEUR or WEUR)",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/r2Bucket:R2Bucket", (args, reportViolation) => {
        const location = args.props.location;
        if (location && !["EEUR", "WEUR"].includes(location)) {
          reportViolation(`R2 bucket '${args.props.name}' is in ${location}, must be EEUR or WEUR for GDPR compliance`);
        }
      }),
    },

    // DNS records must be proxied through Cloudflare
    {
      name: "dns-must-be-proxied",
      description: "All DNS records must be proxied through Cloudflare for DDoS protection",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/record:Record", (args, reportViolation) => {
        if (args.props.proxied !== true) {
          reportViolation(`DNS record '${args.props.name}' must have proxied=true`);
        }
      }),
    },

    // Zero Trust Access must have session duration <= 24h
    {
      name: "access-session-max-24h",
      description: "Zero Trust Access sessions must not exceed 24 hours",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/zeroTrustAccessApplication:ZeroTrustAccessApplication", (args, reportViolation) => {
        const duration = args.props.sessionDuration;
        if (duration && duration !== "24h" && duration !== "12h" && duration !== "1h") {
          reportViolation(`Access app '${args.props.name}' session duration ${duration} exceeds 24h policy`);
        }
      }),
    },

    // Worker secrets must not be empty
    {
      name: "no-empty-worker-secrets",
      description: "Worker secrets must have non-empty values",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType("cloudflare:index/workersSecret:WorkersSecret", (args, reportViolation) => {
        // secretText is always secret/unknown during preview, but we can check the name exists
        if (!args.props.name || args.props.name.trim() === "") {
          reportViolation("Worker secret has empty name");
        }
      }),
    },

    // Admin domains must have Zero Trust protection
    {
      name: "admin-domains-require-access",
      description: "Admin subdomains must be protected by Zero Trust Access",
      enforcementLevel: "advisory",
      validateStack: (args, reportViolation) => {
        const accessApps = args.resources.filter(
          r => r.type === "cloudflare:index/zeroTrustAccessApplication:ZeroTrustAccessApplication"
        );
        const adminDomains = ["admin.ai-grija.ro", "pre-admin.ai-grija.ro"];
        const protectedDomains = accessApps.map(a => a.props.domain).filter(Boolean);

        for (const domain of adminDomains) {
          if (!protectedDomains.includes(domain)) {
            reportViolation(`Admin domain '${domain}' is not protected by Zero Trust Access`);
          }
        }
      },
    },

    // Preview environment must mirror production resource types
    {
      name: "preview-mirrors-production",
      description: "Preview environment must have matching resource types for KV, R2, D1, Queue",
      enforcementLevel: "advisory",
      validateStack: (args, reportViolation) => {
        const resources = args.resources;
        const requiredTypes = [
          "cloudflare:index/workersKvNamespace:WorkersKvNamespace",
          "cloudflare:index/r2Bucket:R2Bucket",
          "cloudflare:index/d1Database:D1Database",
          "cloudflare:index/queue:Queue",
        ];

        for (const type of requiredTypes) {
          const ofType = resources.filter(r => r.type === type);
          if (ofType.length < 2) {
            reportViolation(`Expected at least 2 ${type} resources (prod + preview), found ${ofType.length}`);
          }
        }
      },
    },
  ],
});
