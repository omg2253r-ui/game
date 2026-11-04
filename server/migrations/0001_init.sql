-- SCRAPBOUND initial schema
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  pass_hash TEXT,
  pass_salt TEXT,
  display_name TEXT NOT NULL,
  guest INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS saves (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  server_updated_at INTEGER NOT NULL,
  flags TEXT
);

-- server-authoritative rewards (co-op raids) waiting to be claimed into a save
CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_grants_user ON grants(user_id, claimed_at);

-- anti-cheat audit trail for rejected / suspicious saves
CREATE TABLE IF NOT EXISTS save_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
