CREATE TABLE campaigns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT,
  published_at TEXT,
  scraped_at TEXT DEFAULT (datetime('now')),
  body_text TEXT,
  threat_type TEXT,
  affected_brands TEXT DEFAULT '[]',
  iocs TEXT DEFAULT '[]',
  severity TEXT DEFAULT 'medium',
  draft_status TEXT DEFAULT 'pending',
  draft_content TEXT,
  raw_json TEXT,
  archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_campaigns_source ON campaigns(source);
CREATE INDEX idx_campaigns_severity ON campaigns(severity);
CREATE INDEX idx_campaigns_draft_status ON campaigns(draft_status);

CREATE VIRTUAL TABLE campaigns_fts USING fts5(
  title, body_text, affected_brands,
  content='campaigns', content_rowid='rowid'
);

CREATE TABLE scraper_runs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  source TEXT NOT NULL,
  ran_at TEXT DEFAULT (datetime('now')),
  items_found INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error TEXT,
  status TEXT DEFAULT 'success'
);

CREATE TABLE translation_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lang TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(lang, key)
);
