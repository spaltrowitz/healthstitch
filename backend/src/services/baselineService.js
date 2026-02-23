const { randomUUID } = require('crypto');
const db = require('../db/client');

const BASELINE_DEFS = [
  { metricType: 'hrv_sdnn', windowDays: 90, unit: 'ms' },
  { metricType: 'resting_hr', windowDays: 30, unit: 'bpm' },
  { metricType: 'sleep_duration', windowDays: 90, unit: 'ms' }
];

const metricDatesStmt = db.prepare(`
  SELECT DISTINCT date(recorded_at) AS day
  FROM metric_records
  WHERE user_id = ? AND source = 'apple_watch' AND metric_type = ?
  ORDER BY day
`);

const rollingAvgStmt = db.prepare(`
  SELECT AVG(value) AS baseline
  FROM metric_records
  WHERE user_id = ?
    AND source = 'apple_watch'
    AND metric_type = ?
    AND date(recorded_at) BETWEEN date(?, '-' || (? - 1) || ' days') AND date(?)
`);

const upsertBaselineStmt = db.prepare(`
  INSERT INTO derived_baselines (
    id, user_id, source, metric_type, window_days, baseline_date, value, unit
  ) VALUES (?, ?, 'apple_watch', ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, source, metric_type, window_days, baseline_date)
  DO UPDATE SET value = excluded.value, unit = excluded.unit
`);

function computeBaselines(userId) {
  const tx = db.transaction(() => {
    for (const def of BASELINE_DEFS) {
      const days = metricDatesStmt.all(userId, def.metricType);
      for (const row of days) {
        const value = rollingAvgStmt.get(userId, def.metricType, row.day, def.windowDays, row.day)?.baseline;
        if (value == null) continue;

        upsertBaselineStmt.run(
          randomUUID(),
          userId,
          def.metricType,
          def.windowDays,
          row.day,
          value,
          def.unit
        );
      }
    }
  });

  tx();
}

module.exports = { computeBaselines };
