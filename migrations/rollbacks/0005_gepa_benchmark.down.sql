-- Rollback: 0005_gepa_benchmark
DROP INDEX IF EXISTS idx_eval_version;
DROP INDEX IF EXISTS idx_eval_category;
DROP TABLE IF EXISTS gepa_evaluations;
