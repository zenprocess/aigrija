# Runbook: Pulumi State Bucket — Versioning & Lifecycle

**Bucket**: `ai-grija-pulumi-state`
**Region**: EEUR (Eastern Europe)
**Purpose**: Stores encrypted Pulumi state for this stack (ADR-0015)

---

## Why Versioning Matters

The Pulumi state file is the authoritative record of all deployed resources. A corrupted
or accidentally deleted state file means Pulumi can no longer manage your infrastructure
safely. Versioning provides a recovery path: roll back to any prior state snapshot.

---

## 1. Enable Object Versioning

**Current status**: Versioning must be enabled manually — the `@pulumi/cloudflare` provider
does not expose R2 bucket versioning as of 2026-03. See the provider gap section below.

### Steps (Cloudflare Dashboard)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → your account
2. Navigate to **R2 Object Storage** (left sidebar)
3. Click on bucket **`ai-grija-pulumi-state`**
4. Click the **Settings** tab
5. Scroll to the **Object versioning** section
6. Click **Enable versioning**
7. Confirm the dialog

**Expected result**: The Settings page shows "Object versioning: Enabled".

### Verification

```bash
# Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID env vars
curl -s "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/ai-grija-pulumi-state/versioning" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  | jq -r '.result.state'
# Expected output: "enabled"
```

Or run the infrastructure validation script:

```bash
bash scripts/validate-infra.sh
```

---

## 2. Add Lifecycle Rule — Expire Noncurrent Versions After 30 Days

Without a lifecycle rule, old versions accumulate indefinitely and incur storage costs.
Expiring noncurrent versions after 30 days retains enough history for recovery while
capping storage growth.

**Current status**: R2 lifecycle rules are not yet supported by the `@pulumi/cloudflare`
provider as of 2026-03. Must be configured manually. Once the provider adds support,
this should move to `infra/index.ts`. See the provider gap section below.

### Steps (Cloudflare Dashboard)

1. Go to **R2 Object Storage** → **`ai-grija-pulumi-state`** → **Settings**
2. Scroll to the **Object lifecycle rules** section
3. Click **Add rule**
4. Configure:
   - **Rule name**: `expire-noncurrent-versions`
   - **Prefix filter**: *(leave empty — applies to all objects)*
   - **Noncurrent version expiration**: **30 days**
   - **Current version expiration**: *(leave disabled)*
5. Click **Save**

**Expected result**: Noncurrent versions older than 30 days are automatically deleted.

### Verification (Dashboard)

Navigate to **Settings** → **Object lifecycle rules**. The rule `expire-noncurrent-versions`
should appear with "Noncurrent version expiration: 30 days".

---

## 3. Provider Gap — Track Until Automated

The Cloudflare Pulumi provider currently lacks support for:
- `R2BucketVersioning` resource (or equivalent property on `R2Bucket`)
- `R2BucketLifecycle` resource

Once these are available, the `infra/index.ts` TODOs at lines 26-34 should be resolved:

```typescript
// infra/index.ts — target state once provider supports it
const stateBucketVersioning = new cloudflare.R2BucketVersioning("pulumi-state-versioning", {
  accountId,
  bucketName: stateBucket.name,
  versioning: { state: "enabled" },
});

const stateBucketLifecycle = new cloudflare.R2BucketLifecycle("pulumi-state-lifecycle", {
  accountId,
  bucketName: stateBucket.name,
  rules: [{
    id: "expire-noncurrent-versions",
    enabled: true,
    noncurrentVersionExpiration: { noncurrentDays: 30 },
  }],
});
```

**Track the provider gap**: https://github.com/pulumi/pulumi-cloudflare/issues
Search for: "R2 versioning", "R2 lifecycle"

---

## 4. Recovering From a Corrupted State File

If the Pulumi state becomes corrupted or is accidentally overwritten:

1. **Do not run `pulumi up` or `pulumi destroy`** until state is restored
2. Open the R2 bucket in the Cloudflare Dashboard
3. Navigate to the state file object (typically `.pulumi/stacks/<stack-name>.json`)
4. Click **View versions** to list all previous versions
5. Select the most recent healthy version and click **Restore**
6. Verify the restored state: `pulumi stack --show-secrets` (check output looks correct)
7. Resume normal operations

---

## 5. CI/CD Access

The Pulumi state bucket is accessed in CI via S3-compatible API tokens stored as GitHub secrets.
See ADR-0015 for the full setup.

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | R2 API token ID |
| `AWS_SECRET_ACCESS_KEY` | R2 API token secret |
| `PULUMI_CONFIG_PASSPHRASE` | Decrypt stack secrets |

These are also stored in Infisical under the `production` environment.

---

## Related

- [ADR-0015: Pulumi R2 State Backend](adrs/0015-pulumi-r2-state-backend.md)
- [ADR-0005: Pulumi IaC](adrs/0005-pulumi-iac.md)
- [`infra/index.ts`](../infra/index.ts) — lines 26-34 (TODO comments)
- [`scripts/validate-infra.sh`](../scripts/validate-infra.sh) — includes versioning check
