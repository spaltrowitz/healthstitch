const { randomUUID } = require('crypto');
const db = require('../db/client');

let _upsertAggregateStmt;
let _weeklyAggStmt;

function getStmts() {
  if (!_upsertAggregateStmt) {
    _upsertAggregateStmt = db.prepare(`
      INSERT INTO training_load_aggregates (id, user_id, period_type, period_start, period_end, source, total_load, workout_count, avg_strain, total_calories, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, period_type, period_start, source)
      DO UPDATE SET
        total_load = excluded.total_load,
        workout_count = excluded.workout_count,
        avg_strain = excluded.avg_strain,
        total_calories = excluded.total_calories,
        updated_at = datetime('now')
    `);
    _weeklyAggStmt = db.prepare(`
      SELECT
        source,
        COUNT(*) AS workout_count,
        SUM(COALESCE(strain, COALESCE(energy_kcal, energy_kj * 0.239006), duration_ms / 60000.0)) AS total_load,
        AVG(strain) AS avg_strain,
        SUM(COALESCE(energy_kcal, energy_kj * 0.239006, 0)) AS total_calories
      FROM workout_records
      WHERE user_id = ?
        AND date(start_at) >= ?
        AND date(start_at) <= ?
      GROUP BY source
    `);
  }
  return { upsertAggregateStmt: _upsertAggregateStmt, weeklyAggStmt: _weeklyAggStmt };
}

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

function recomputeWeek(userId, weekStart) {
  const weekEnd = sundayOf(weekStart);
  const { weeklyAggStmt, upsertAggregateStmt } = getStmts();
  const rows = weeklyAggStmt.all(userId, weekStart, weekEnd);

  for (const row of rows) {
    upsertAggregateStmt.run(
      randomUUID(),
      userId,
      'weekly',
      weekStart,
      weekEnd,
      row.source,
      row.total_load || 0,
      row.workout_count,
      row.avg_strain,
      row.total_calories || 0
    );
  }

  if (rows.length === 0) {
    db.prepare(`
      DELETE FROM training_load_aggregates
      WHERE user_id = ? AND period_type = 'weekly' AND period_start = ?
    `).run(userId, weekStart);
  }
}

function recomputeMonth(userId, monthStart) {
  const monthEnd = monthEndOf(monthStart);
  const { weeklyAggStmt, upsertAggregateStmt } = getStmts();
  const rows = weeklyAggStmt.all(userId, monthStart, monthEnd);

  for (const row of rows) {
    upsertAggregateStmt.run(
      randomUUID(),
      userId,
      'monthly',
      monthStart,
      monthEnd,
      row.source,
      row.total_load || 0,
      row.workout_count,
      row.avg_strain,
      row.total_calories || 0
    );
  }

  if (rows.length === 0) {
    db.prepare(`
      DELETE FROM training_load_aggregates
      WHERE user_id = ? AND period_type = 'monthly' AND period_start = ?
    `).run(userId, monthStart);
  }
}

function updateAggregatesForWorkout(userId, workoutStartAt) {
  const dateStr = workoutStartAt.slice(0, 10);
  const weekStart = mondayOf(dateStr);
  const monthStart = monthStartOf(dateStr);

  recomputeWeek(userId, weekStart);
  recomputeMonth(userId, monthStart);
}

function recomputeAll(userId) {
  const earliest = db.prepare(`
    SELECT MIN(date(start_at)) AS min_date FROM workout_records WHERE user_id = ?
  `).get(userId);

  if (!earliest?.min_date) return;

  const latest = db.prepare(`
    SELECT MAX(date(start_at)) AS max_date FROM workout_records WHERE user_id = ?
  `).get(userId);

  db.prepare(`DELETE FROM training_load_aggregates WHERE user_id = ?`).run(userId);

  let current = mondayOf(earliest.min_date);
  const end = latest.max_date;

  while (current <= end) {
    recomputeWeek(userId, current);
    const d = new Date(current + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 7);
    current = d.toISOString().slice(0, 10);
  }

  let monthCurrent = monthStartOf(earliest.min_date);
  while (monthCurrent <= end) {
    recomputeMonth(userId, monthCurrent);
    const d = new Date(monthCurrent + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 1);
    monthCurrent = d.toISOString().slice(0, 10);
  }
}

module.exports = {
  updateAggregatesForWorkout,
  recomputeAll
};
