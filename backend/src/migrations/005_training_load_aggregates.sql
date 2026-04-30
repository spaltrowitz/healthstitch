CREATE TABLE IF NOT EXISTS training_load_aggregates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK(period_type IN ('weekly', 'monthly')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  source TEXT NOT NULL,
  total_load REAL NOT NULL DEFAULT 0,
  workout_count INTEGER NOT NULL DEFAULT 0,
  avg_strain REAL,
  total_calories REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aggregate_unique
  ON training_load_aggregates(user_id, period_type, period_start, source);

CREATE INDEX IF NOT EXISTS idx_aggregate_query
  ON training_load_aggregates(user_id, period_type, period_start);
