-- Conversations / check history
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'web',
  user_hash TEXT,
  message_text TEXT NOT NULL,
  url TEXT,
  verdict TEXT NOT NULL,
  confidence REAL NOT NULL,
  scam_type TEXT,
  model_used TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_verdict ON conversations(verdict);

-- Reports (community signals)
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT REFERENCES conversations(id),
  verdict TEXT NOT NULL,
  scam_type TEXT,
  url_domain TEXT,
  confidence REAL,
  reporter_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(url_domain);

-- Admin audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
