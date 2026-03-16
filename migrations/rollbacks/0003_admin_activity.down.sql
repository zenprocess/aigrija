-- Rollback: 0003_admin_activity
DROP INDEX IF EXISTS idx_admin_activity_action;
DROP INDEX IF EXISTS idx_admin_activity_email;
DROP INDEX IF EXISTS idx_admin_activity_created;
DROP TABLE IF EXISTS admin_activity;
