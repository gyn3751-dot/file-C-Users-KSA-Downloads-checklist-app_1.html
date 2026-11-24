CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,        -- random id kept in the entrant's browser so they can edit their own entry
  company TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  agree INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_entries_phone ON entries(phone);
CREATE INDEX IF NOT EXISTS idx_entries_created ON entries(created_at);
