CREATE TABLE IF NOT EXISTS recovery_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_recovery_user
  ON recovery_periods(user_id, start_date);

-- Fix missing unique constraint on whoop_tokens.user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_whoop_tokens_user
  ON whoop_tokens(user_id);
