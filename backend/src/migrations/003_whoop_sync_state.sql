CREATE TABLE IF NOT EXISTS whoop_sync_state (
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  last_sync_at TEXT,
  last_sync_status TEXT CHECK(last_sync_status IN ('success', 'error')),
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT
);
