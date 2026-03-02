-- Migration: 0004_campaigns_indexes
-- Adds supplemental indexes for campaigns table not covered by 0001.
-- Skips indexes that already exist in 0001_admin_schema.sql
-- (idx_campaigns_source, idx_campaigns_severity, idx_campaigns_draft_status are already there).

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at  ON campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_archived    ON campaigns (archived);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug        ON campaigns (slug);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_ran_at   ON scraper_runs (ran_at DESC);
