# D1 Migrations

Versioned SQL migrations for the `ai-grija-admin` D1 database (binding: `DB` / `ADMIN_DB`).

## File Naming Convention

```
NNNN_description.sql        -- forward (up) migration
NNNN_description.down.sql   -- rollback (down) migration
```

Migrations are applied in numeric order.

## Migrations

| # | File | Description |
|---|------|-------------|
| 0001 | `0001_admin_schema.sql` | campaigns, scraper_runs, translation_overrides, campaigns_fts |
| 0002 | `0002_conversations_reports.sql` | conversations, reports, audit_log |
| 0003 | `0003_admin_activity.sql` | admin_activity (activity-log.ts audit trail) + indexes |
| 0004 | `0004_campaigns_indexes.sql` | Supplemental indexes on campaigns / scraper_runs |

## Running Migrations

### Apply all migrations (production)

```bash
./scripts/migrate.sh
```

### Apply all migrations (preview environment)

```bash
./scripts/migrate.sh --env preview
```

### Dry run

```bash
./scripts/migrate.sh --dry-run
```

### Apply a single file manually

```bash
npx wrangler d1 execute ai-grija-admin --file=migrations/0003_admin_activity.sql
```

### Roll back a specific migration

```bash
./scripts/migrate.sh --down 0004   # roll back indexes
./scripts/migrate.sh --down 0003   # roll back admin_activity
```

## Adding a New Migration

1. Pick the next number: `NNNN_description.sql`.
2. Create the matching `NNNN_description.down.sql` rollback.
3. Use `IF NOT EXISTS` / `IF EXISTS` to keep migrations idempotent.
4. Preview: `./scripts/migrate.sh --dry-run`
5. Apply to preview first: `./scripts/migrate.sh --env preview`
6. Apply to production: `./scripts/migrate.sh`

## Schema Overview

### `campaigns` (0001)

Core threat campaign records. Inserted by `scraper-runner.ts`, managed via admin UI.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | 8-byte hex UUID |
| `slug` | TEXT UNIQUE | URL slug |
| `title` | TEXT | Campaign title |
| `source` | TEXT | Source name (e.g. `dnsc`) |
| `source_url` | TEXT | Original article URL |
| `published_at` | TEXT | ISO-8601 original publish date |
| `body_text` | TEXT | Full scraped body |
| `threat_type` | TEXT | Threat category |
| `affected_brands` | TEXT | JSON array |
| `iocs` | TEXT | JSON array of indicators of compromise |
| `severity` | TEXT | `critical` / `high` / `medium` / `low` |
| `draft_status` | TEXT | `pending` / `generated` / `approved` / `published` / `rejected` |
| `draft_content` | TEXT | AI-generated Markdown draft |
| `archived` | INTEGER | `0` = active, `1` = archived |
| `created_at` | TEXT | ISO-8601 |
| `updated_at` | TEXT | ISO-8601 |

### `scraper_runs` (0001)

Audit log for each scraper invocation.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Hex UUID |
| `source` | TEXT | Scraper name |
| `ran_at` | TEXT | ISO-8601 |
| `items_found` | INTEGER | |
| `items_new` | INTEGER | |
| `duration_ms` | INTEGER | nullable |
| `error` | TEXT | nullable |
| `status` | TEXT | `success` / `error` |

### `conversations` (0002)

Check history — one row per user URL/text check.

### `reports` (0002)

Community-submitted signals linked to a conversation.

### `audit_log` (0002)

General audit log (actor/action/target).

### `admin_activity` (0003)

Fine-grained admin audit trail written by `activity-log.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `action` | TEXT | e.g. `approve`, `publish` |
| `entity_type` | TEXT | e.g. `campaign` |
| `entity_id` | TEXT | nullable |
| `admin_email` | TEXT | |
| `details` | TEXT | JSON object, nullable |
| `created_at` | TEXT | ISO-8601 |
