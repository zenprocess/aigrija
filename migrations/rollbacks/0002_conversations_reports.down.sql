-- Rollback: 0002_conversations_reports
DROP INDEX IF EXISTS idx_reports_domain;
DROP INDEX IF EXISTS idx_conversations_verdict;
DROP INDEX IF EXISTS idx_conversations_created;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS conversations;
