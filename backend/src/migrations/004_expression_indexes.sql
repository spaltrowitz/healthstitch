-- Expression indexes for date-based GROUP BY queries.
-- These accelerate the dashboard routes that use DATE(recorded_at) and DATE(start_at).

CREATE INDEX IF NOT EXISTS idx_metric_date_expr
  ON metric_records(CAST(recorded_at AS DATE));

CREATE INDEX IF NOT EXISTS idx_sleep_start_date_expr
  ON sleep_records(CAST(start_at AS DATE));

CREATE INDEX IF NOT EXISTS idx_workout_start_date_expr
  ON workout_records(CAST(start_at AS DATE));

-- Composite index for the most common query pattern: per-user, per-source, by date
CREATE INDEX IF NOT EXISTS idx_metric_user_source_date
  ON metric_records(user_id, source, CAST(recorded_at AS DATE));
