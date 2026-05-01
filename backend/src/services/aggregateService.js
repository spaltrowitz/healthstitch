const { randomUUID } = require('crypto');
const db = require('../db/client');

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sundayOf(mondayStr) {
  const d = new Date(mondayStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function monthStartOf(dateStr) {
  return dateStr.slice(0, 7) + '-01';
}

function monthEndOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

async function recomputeWeek(userId, weekStart) {
  const weekEnd = sundayOf(weekStart);

  const { rows } = await db.query(`
    SELECT
      source,
      COUNT(*) AS workout_count,
      SUM(COALESCE(strain, COALESCE(energy_kcal, energy_kj * 0.239006), duration_ms / 60000.0)) AS total_load,
      AVG(strain) AS avg_strain,
      SUM(COALESCE(energy_kcal, energy_kj * 0.239006, 0)) AS total_calories
    FROM workout_records
    WHERE user_id = $1
      AND DATE(start_at) >= $2
      AND DATE(start_at) <= $3
    GROUP BY source
  `, [userId, weekStart, weekEnd]);

  for (const row of rows) {
    await db.query(`
      INSERT INTO training_load_aggregates (id, user_id, period_type, period_start, period_end, source, total_load, workout_count, avg_strain, total_calories, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT(user_id, period_type, period_start, source)
      DO UPDATE SET
        total_load = EXCLUDED.total_load,
        workout_count = EXCLUDED.workout_count,
        avg_strain = EXCLUDED.avg_strain,
        total_calories = EXCLUDED.total_calories,
        updated_at = NOW()
    `, [
      randomUUID(), userId, 'weekly', weekStart, weekEnd,
      row.source, row.total_load || 0, row.workout_count,
      row.avg_strain, row.total_calories || 0
    ]);
  }

  if (rows.length === 0) {
    await db.query(`
      DELETE FROM training_load_aggregates
      WHERE user_id = $1 AND period_type = 'weekly' AND period_start = $2
    `, [userId, weekStart]);
  }
}

async function recomputeMonth(userId, monthStart) {
  const monthEnd = monthEndOf(monthStart);

  const { rows } = await db.query(`
    SELECT
      source,
      COUNT(*) AS workout_count,
      SUM(COALESCE(strain, COALESCE(energy_kcal, energy_kj * 0.239006), duration_ms / 60000.0)) AS total_load,
      AVG(strain) AS avg_strain,
      SUM(COALESCE(energy_kcal, energy_kj * 0.239006, 0)) AS total_calories
    FROM workout_records
    WHERE user_id = $1
      AND DATE(start_at) >= $2
      AND DATE(start_at) <= $3
    GROUP BY source
  `, [userId, monthStart, monthEnd]);

  for (const row of rows) {
    await db.query(`
      INSERT INTO training_load_aggregates (id, user_id, period_type, period_start, period_end, source, total_load, workout_count, avg_strain, total_calories, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT(user_id, period_type, period_start, source)
      DO UPDATE SET
        total_load = EXCLUDED.total_load,
        workout_count = EXCLUDED.workout_count,
        avg_strain = EXCLUDED.avg_strain,
        total_calories = EXCLUDED.total_calories,
        updated_at = NOW()
    `, [
      randomUUID(), userId, 'monthly', monthStart, monthEnd,
      row.source, row.total_load || 0, row.workout_count,
      row.avg_strain, row.total_calories || 0
    ]);
  }

  if (rows.length === 0) {
    await db.query(`
      DELETE FROM training_load_aggregates
      WHERE user_id = $1 AND period_type = 'monthly' AND period_start = $2
    `, [userId, monthStart]);
  }
}

async function updateAggregatesForWorkout(userId, workoutStartAt) {
  const dateStr = workoutStartAt.slice(0, 10);
  const weekStart = mondayOf(dateStr);
  const monthStart = monthStartOf(dateStr);

  await recomputeWeek(userId, weekStart);
  await recomputeMonth(userId, monthStart);
}

async function recomputeAll(userId) {
  const earliest = await db.query(
    'SELECT MIN(DATE(start_at)) AS min_date FROM workout_records WHERE user_id = $1',
    [userId]
  );

  if (!earliest.rows[0]?.min_date) return;

  const latest = await db.query(
    'SELECT MAX(DATE(start_at)) AS max_date FROM workout_records WHERE user_id = $1',
    [userId]
  );

  await db.query('DELETE FROM training_load_aggregates WHERE user_id = $1', [userId]);

  const minDate = earliest.rows[0].min_date instanceof Date
    ? earliest.rows[0].min_date.toISOString().slice(0, 10)
    : earliest.rows[0].min_date;
  const end = latest.rows[0].max_date instanceof Date
    ? latest.rows[0].max_date.toISOString().slice(0, 10)
    : latest.rows[0].max_date;

  let current = mondayOf(minDate);
  while (current <= end) {
    await recomputeWeek(userId, current);
    const d = new Date(current + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 7);
    current = d.toISOString().slice(0, 10);
  }

  let monthCurrent = monthStartOf(minDate);
  while (monthCurrent <= end) {
    await recomputeMonth(userId, monthCurrent);
    const d = new Date(monthCurrent + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 1);
    monthCurrent = d.toISOString().slice(0, 10);
  }
}

module.exports = {
  updateAggregatesForWorkout,
  recomputeAll
};
