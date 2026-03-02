-- GEPA (Generative Evaluation and Prompt Analysis) benchmark schema
CREATE TABLE IF NOT EXISTS gepa_evaluations (
  id TEXT PRIMARY KEY,
  prompt_version TEXT NOT NULL,
  category TEXT NOT NULL,
  readability_score REAL,
  accuracy_score REAL,
  seo_score REAL,
  overall_score REAL,
  prompt_text TEXT,
  sample_output TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_category ON gepa_evaluations(category);
CREATE INDEX IF NOT EXISTS idx_eval_version ON gepa_evaluations(prompt_version);
