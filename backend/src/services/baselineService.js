const { randomUUID } = require('crypto');
const db = require('../db/client');

const BASELINE_DEFS = [
  { metricType: 'hrv_sdnn', windowDays: 90, unit: 'ms' },
  { metricType: 'resting_hr', windowDays: 30, unit: 'bpm' },
  { metricType: 'sleep_duration', windowDays: 90, unit: 'ms' }
];

function isInRecovery(day, recoveryPeriods) {
  for (const rp of recoveryPeriods) {
    if (day >= rp.start_date && (!rp.end_date || day <= rp.end_date)) return true;
  }
  return false;
}

async function computeBaselines(userId) {
  const { rows: recoveryPeriods } = await db.query(
    'SELECT start_date, end_date FROM recovery_periods WHERE user_id = $1',
    [userId]
  );

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    for (const def of BASELINE_DEFS) {
      const { rows: days } = await client.query(`
        SELECT DISTINCT DATE(recorded_at) AS day
        FROM metric_records
        WHERE user_id = $1 AND source = 'apple_watch' AND metric_type = $2
        ORDER BY day
      `, [userId, def.metricType]);

      for (const row of days) {
        const day = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : row.day;
        if (isInRecovery(day, recoveryPeriods)) continue;

        const windowStart = new Date(day);
        windowStart.setDate(windowStart.getDate() - (def.windowDays - 1));
        const windowStartStr = windowStart.toISOString().slice(0, 10);

        const result = await client.query(`
          SELECT AVG(value) AS baseline
          FROM metric_records
          WHERE user_id = $1
            AND source = 'apple_watch'
            AND metric_type = $2
            AND DATE(recorded_at) BETWEEN $3 AND $4
            AND DATE(recorded_at) NOT IN (
              SELECT DATE(recorded_at)
              FROM metric_records m2
              WHERE m2.user_id = $5
                AND m2.source = 'apple_watch'
                AND m2.metric_type = $6
                AND EXISTS (
                  SELECT 1 FROM recovery_periods rp
                  WHERE rp.user_id = $7
                    AND DATE(m2.recorded_at) >= rp.start_date
                    AND (rp.end_date IS NULL OR DATE(m2.recorded_at) <= rp.end_date)
                )
            )
        `, [userId, def.metricType, windowStartStr, day, userId, def.metricType, userId]);

        const value = result.rows[0]?.baseline;
        if (value == null) continue;

        await client.query(`
          INSERT INTO derived_baselines (
            id, user_id, source, metric_type, window_days, baseline_date, value, unit
          ) VALUES ($1, $2, 'apple_watch', $3, $4, $5, $6, $7)
          ON CONFLICT(user_id, source, metric_type, window_days, baseline_date)
          DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit
        `, [randomUUID(), userId, def.metricType, def.windowDays, day, value, def.unit]);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { computeBaselines };
