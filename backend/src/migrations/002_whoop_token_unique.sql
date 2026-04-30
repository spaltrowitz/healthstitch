-- Fix: whoop_tokens.user_id needs UNIQUE constraint for ON CONFLICT(user_id) to work.
-- SQLite doesn't support ADD CONSTRAINT, so we recreate the table.

CREATE TABLE IF NOT EXISTS whoop_tokens_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  scope TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT OR REPLACE INTO whoop_tokens_new (id, user_id, access_token, refresh_token, expires_at, scope, created_at, updated_at)
  SELECT id, user_id, access_token, refresh_token, expires_at, scope, created_at, updated_at
  FROM whoop_tokens
  GROUP BY user_id
  HAVING MAX(updated_at);

DROP TABLE IF EXISTS whoop_tokens;
ALTER TABLE whoop_tokens_new RENAME TO whoop_tokens;
