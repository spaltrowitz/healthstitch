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

const upsertBaselineStmt = db.prepare(`
  INSERT INTO derived_baselines (
    id, user_id, source, metric_type, window_days, baseline_date, value, unit
  ) VALUES (?, ?, 'apple_watch', ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, source, metric_type, window_days, baseline_date)
  DO UPDATE SET value = excluded.value, unit = excluded.unit
`);

const recoveryPeriodsStmt = db.prepare(`
  SELECT start_date, end_date
  FROM recovery_periods
  WHERE user_id = ?
`);

function isInRecovery(day, recoveryPeriods) {
  for (const rp of recoveryPeriods) {
    if (day >= rp.start_date && (!rp.end_date || day <= rp.end_date)) return true;
  }
  return false;
}

function computeBaselines(userId) {
  const recoveryPeriods = recoveryPeriodsStmt.all(userId);

  const tx = db.transaction(() => {
    for (const def of BASELINE_DEFS) {
      const days = metricDatesStmt.all(userId, def.metricType);
      for (const row of days) {
        if (isInRecovery(row.day, recoveryPeriods)) continue;

        const windowStart = new Date(row.day);
        windowStart.setDate(windowStart.getDate() - (def.windowDays - 1));
        const windowStartStr = windowStart.toISOString().slice(0, 10);

        const result = db.prepare(`
          SELECT AVG(value) AS baseline
          FROM metric_records
          WHERE user_id = ?
            AND source = 'apple_watch'
            AND metric_type = ?
            AND date(recorded_at) BETWEEN ? AND ?
            AND date(recorded_at) NOT IN (
              SELECT date(recorded_at)
              FROM metric_records m2
              WHERE m2.user_id = ?
                AND m2.source = 'apple_watch'
                AND m2.metric_type = ?
                AND EXISTS (
                  SELECT 1 FROM recovery_periods rp
                  WHERE rp.user_id = ?
                    AND date(m2.recorded_at) >= rp.start_date
                    AND (rp.end_date IS NULL OR date(m2.recorded_at) <= rp.end_date)
                )
            )
        `).get(userId, def.metricType, windowStartStr, row.day, userId, def.metricType, userId);

        const value = result?.baseline;
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
