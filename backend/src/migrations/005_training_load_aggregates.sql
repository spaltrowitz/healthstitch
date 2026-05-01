CREATE TABLE IF NOT EXISTS training_load_aggregates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK(period_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  source TEXT NOT NULL,
  total_load DOUBLE PRECISION NOT NULL DEFAULT 0,
  workout_count INTEGER NOT NULL DEFAULT 0,
  avg_strain DOUBLE PRECISION,
  total_calories DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aggregate_unique
  ON training_load_aggregates(user_id, period_type, period_start, source);

CREATE INDEX IF NOT EXISTS idx_aggregate_query
  ON training_load_aggregates(user_id, period_type, period_start);
