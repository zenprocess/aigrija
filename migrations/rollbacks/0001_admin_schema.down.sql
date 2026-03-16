-- Rollback: 0001_admin_schema
DROP INDEX IF EXISTS idx_campaigns_draft_status;
DROP INDEX IF EXISTS idx_campaigns_severity;
DROP INDEX IF EXISTS idx_campaigns_source;
DROP TABLE IF EXISTS campaigns_fts;
DROP TABLE IF EXISTS translation_overrides;
DROP TABLE IF EXISTS scraper_runs;
DROP TABLE IF EXISTS campaigns;
