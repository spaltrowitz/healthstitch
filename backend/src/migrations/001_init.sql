CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whoop_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  scope TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS apple_sync_state (
  user_id TEXT PRIMARY KEY,
  last_sync_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS metric_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  external_id TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_external
  ON metric_records(user_id, source, metric_type, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_dedupe
  ON metric_records(user_id, source, metric_type, recorded_at, value, unit);

CREATE INDEX IF NOT EXISTS idx_metric_query
  ON metric_records(user_id, source, metric_type, recorded_at);

CREATE TABLE IF NOT EXISTS sleep_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  sleep_date DATE NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  total_duration_ms BIGINT NOT NULL,
  slow_wave_ms BIGINT,
  rem_ms BIGINT,
  light_ms BIGINT,
  awake_ms BIGINT,
  sleep_performance DOUBLE PRECISION,
  sleep_need_ms BIGINT,
  sleep_consistency DOUBLE PRECISION,
  sleep_efficiency DOUBLE PRECISION,
  respiratory_rate DOUBLE PRECISION,
  disturbance_count INTEGER,
  external_id TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_external
  ON sleep_records(user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_dedupe
  ON sleep_records(user_id, source, sleep_date, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_sleep_query
  ON sleep_records(user_id, source, sleep_date);

CREATE TABLE IF NOT EXISTS workout_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  sport_type TEXT NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  duration_ms BIGINT NOT NULL,
  avg_hr DOUBLE PRECISION,
  max_hr DOUBLE PRECISION,
  strain DOUBLE PRECISION,
  energy_kj DOUBLE PRECISION,
  energy_kcal DOUBLE PRECISION,
  distance_m DOUBLE PRECISION,
  hr_zone_json TEXT,
  external_id TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_external
  ON workout_records(user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_dedupe
  ON workout_records(user_id, source, start_at, end_at, sport_type);

CREATE INDEX IF NOT EXISTS idx_workout_query
  ON workout_records(user_id, source, start_at);

CREATE TABLE IF NOT EXISTS derived_baselines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  window_days INTEGER NOT NULL,
  baseline_date DATE NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_baseline_unique
  ON derived_baselines(user_id, source, metric_type, window_days, baseline_date);

CREATE INDEX IF NOT EXISTS idx_baseline_query
  ON derived_baselines(user_id, metric_type, baseline_date);
