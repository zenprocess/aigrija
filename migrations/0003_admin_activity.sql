-- Migration: 0003_admin_activity
-- Adds admin_activity table for audit logging (activity-log.ts).
-- The existing 0001 migration covers campaigns/scraper_runs.
-- The existing 0002 migration covers conversations/reports/audit_log.

CREATE TABLE IF NOT EXISTS admin_activity (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  action       TEXT    NOT NULL,
  entity_type  TEXT    NOT NULL,
  entity_id    TEXT,
  admin_email  TEXT    NOT NULL,
  details      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created    ON admin_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_email      ON admin_activity (admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action     ON admin_activity (action);
