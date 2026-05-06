CREATE TABLE IF NOT EXISTS computed_daily_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  score_date DATE NOT NULL,
  recovery_score DOUBLE PRECISION,
  recovery_zone TEXT,
  exertion_score DOUBLE PRECISION,
  sleep_need_ms BIGINT,
  fatigue_reduction_ms BIGINT,
  adjusted_sleep_need_ms BIGINT,
  sleep_debt_ms BIGINT,
  data_quality_json TEXT,
  inputs_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_scores_unique
  ON computed_daily_scores(user_id, score_date);

CREATE TABLE IF NOT EXISTS computed_workout_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  trimp_score DOUBLE PRECISION,
  exertion_score DOUBLE PRECISION,
  hr_zone_json TEXT,
  data_quality TEXT,
  data_quality_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (workout_id) REFERENCES workout_records(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_scores_unique
  ON computed_workout_scores(user_id, workout_id);

CREATE TABLE IF NOT EXISTS nap_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  nap_date DATE NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  duration_ms BIGINT NOT NULL,
  deep_ms BIGINT,
  rem_ms BIGINT,
  light_ms BIGINT,
  credit_ms BIGINT,
  credit_method TEXT NOT NULL DEFAULT 'stage_weighted',
  time_of_day_modifier DOUBLE PRECISION,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nap_dedupe
  ON nap_records(user_id, source, nap_date, start_at, end_at);

CREATE TABLE IF NOT EXISTS source_priority (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  priority_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_priority_unique
  ON source_priority(user_id, metric_type);
