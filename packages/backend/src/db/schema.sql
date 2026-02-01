-- Translation Memory Database Schema for Cloudflare D1

-- Translation memory table
CREATE TABLE IF NOT EXISTS translation_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  context_type TEXT DEFAULT 'general',
  model_used TEXT NOT NULL,
  quality_score REAL DEFAULT 0,
  use_count INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_hash, source_lang, target_lang)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_source_hash ON translation_memory(source_hash);
CREATE INDEX IF NOT EXISTS idx_langs ON translation_memory(source_lang, target_lang);
CREATE INDEX IF NOT EXISTS idx_context ON translation_memory(context_type);
CREATE INDEX IF NOT EXISTS idx_quality ON translation_memory(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_use_count ON translation_memory(use_count DESC);

-- User terminology table (for custom term preferences)
CREATE TABLE IF NOT EXISTS user_terminology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_term TEXT NOT NULL,
  target_term TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  context_type TEXT DEFAULT 'general',
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_term, source_lang, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_term_source ON user_terminology(source_term);
CREATE INDEX IF NOT EXISTS idx_term_langs ON user_terminology(source_lang, target_lang);

-- Translation history for analytics
CREATE TABLE IF NOT EXISTS translation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_text_preview TEXT NOT NULL,  -- First 100 chars
  target_lang TEXT NOT NULL,
  model_used TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cached BOOLEAN DEFAULT FALSE,
  processing_time_ms INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_date ON translation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_model ON translation_history(model_used);

-- Context analysis cache
CREATE TABLE IF NOT EXISTS context_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  context_type TEXT NOT NULL,
  domain TEXT,
  tone TEXT NOT NULL,
  terminology_hints TEXT,  -- JSON array
  confidence REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_context_url ON context_cache(url_hash);
