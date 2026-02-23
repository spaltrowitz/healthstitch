CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whoop_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  scope TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS apple_sync_state (
  user_id TEXT PRIMARY KEY,
  last_sync_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS metric_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  external_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  sleep_date TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  total_duration_ms INTEGER NOT NULL,
  slow_wave_ms INTEGER,
  rem_ms INTEGER,
  light_ms INTEGER,
  awake_ms INTEGER,
  sleep_performance REAL,
  sleep_need_ms INTEGER,
  sleep_consistency REAL,
  sleep_efficiency REAL,
  respiratory_rate REAL,
  disturbance_count INTEGER,
  external_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  avg_hr REAL,
  max_hr REAL,
  strain REAL,
  energy_kj REAL,
  energy_kcal REAL,
  distance_m REAL,
  hr_zone_json TEXT,
  external_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  baseline_date TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_baseline_unique
  ON derived_baselines(user_id, source, metric_type, window_days, baseline_date);

CREATE INDEX IF NOT EXISTS idx_baseline_query
  ON derived_baselines(user_id, metric_type, baseline_date);
