-- Rollback: 0004_campaigns_indexes
DROP INDEX IF EXISTS idx_campaigns_created_at;
DROP INDEX IF EXISTS idx_campaigns_archived;
DROP INDEX IF EXISTS idx_campaigns_slug;
DROP INDEX IF EXISTS idx_scraper_runs_ran_at;
