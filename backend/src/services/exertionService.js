const { randomUUID } = require('crypto');
const db = require('../db/client');

const DEGRADED_SPORT_TYPES = new Set([
  'strength_training', 'functional_fitness', 'traditional_strength_training',
  'core_training', 'flexibility', 'yoga', 'pilates',
]);

function computeTrimp(avgHr, durationMs, restingHr, maxHr) {
  if (!avgHr || !durationMs || !restingHr || !maxHr || maxHr <= restingHr) return null;

  const durationMin = durationMs / 60000;
  const hrr = (avgHr - restingHr) / (maxHr - restingHr);
  const clampedHrr = Math.max(0, Math.min(1, hrr));

  return durationMin * clampedHrr * Math.exp(1.92 * clampedHrr);
}

function estimateMaxHr(age) {
  if (!age || age < 10 || age > 120) return 190;
  return Math.round(208 - (0.7 * age));
}

async function getUserMaxHr(userId) {
  const { rows } = await db.query(`
    SELECT MAX(max_hr) AS observed_max
    FROM workout_records
    WHERE user_id = $1 AND max_hr IS NOT NULL AND max_hr > 100
  `, [userId]);

  const observed = rows[0]?.observed_max;
  if (observed && observed > 150) return Math.round(observed);

  return estimateMaxHr(null);
}

async function getUserRestingHr(userId, date) {
  const { rows } = await db.query(`
    SELECT AVG(value) AS avg_rhr
    FROM metric_records
    WHERE user_id = $1
      AND metric_type = 'resting_hr'
      AND recorded_at::date BETWEEN ($2::date - INTERVAL '7 days') AND $2::date
  `, [userId, date]);
  return rows[0]?.avg_rhr || 60;
}

async function getPersonalMaxTrimp(userId) {
  const { rows } = await db.query(`
    SELECT trimp_score FROM computed_workout_scores
    WHERE user_id = $1 AND trimp_score IS NOT NULL
    ORDER BY trimp_score DESC
    LIMIT 20
  `, [userId]);

  if (rows.length < 5) return 300;

  const idx = Math.floor(rows.length * 0.1);
  return rows[idx]?.trimp_score || 300;
}

async function scoreWorkout(userId, workoutId) {
  const { rows } = await db.query(
    'SELECT * FROM workout_records WHERE id = $1 AND user_id = $2',
    [workoutId, userId]
  );
  if (rows.length === 0) return null;

  const workout = rows[0];
  const date = workout.start_at.toISOString().slice(0, 10);
  const rhr = await getUserRestingHr(userId, date);
  const maxHr = await getUserMaxHr(userId);

  const trimp = computeTrimp(workout.avg_hr, workout.duration_ms, rhr, maxHr);

  let dataQuality = 'reliable';
  let dataQualityReason = null;
  if (DEGRADED_SPORT_TYPES.has(workout.sport_type)) {
    dataQuality = 'degraded';
    dataQualityReason = 'HR-based scoring underestimates non-cardiovascular exertion';
  } else if (workout.avg_hr && workout.avg_hr < 80 && workout.duration_ms > 1800000) {
    dataQuality = 'unreliable';
    dataQualityReason = 'Suspiciously low avg HR for workout duration — possible optical HR dropout';
  }

  let hrZones = null;
  if (workout.hr_zone_json) {
    try { hrZones = workout.hr_zone_json; } catch (_) { /* keep null */ }
  }

  const personalMax = await getPersonalMaxTrimp(userId);
  const exertion = trimp != null ? Math.min(Math.round((trimp / personalMax) * 100), 100) : null;

  await db.query(`
    INSERT INTO computed_workout_scores (id, user_id, workout_id, trimp_score, exertion_score, hr_zone_json, data_quality, data_quality_reason)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT(user_id, workout_id)
    DO UPDATE SET trimp_score = EXCLUDED.trimp_score, exertion_score = EXCLUDED.exertion_score,
                  hr_zone_json = EXCLUDED.hr_zone_json, data_quality = EXCLUDED.data_quality,
                  data_quality_reason = EXCLUDED.data_quality_reason
  `, [randomUUID(), userId, workoutId, trimp, exertion, hrZones, dataQuality, dataQualityReason]);

  return { workoutId, trimp, exertion, dataQuality, dataQualityReason };
}

async function getDailyExertion(userId, date) {
  const { rows: workouts } = await db.query(`
    SELECT id FROM workout_records
    WHERE user_id = $1 AND start_at::date = $2::date
  `, [userId, date]);

  let totalTrimp = 0;
  const results = [];
  for (const w of workouts) {
    const score = await scoreWorkout(userId, w.id);
    if (score) {
      totalTrimp += score.trimp || 0;
      results.push(score);
    }
  }

  const personalMax = await getPersonalMaxTrimp(userId);
  const dailyExertion = Math.min(Math.round((totalTrimp / personalMax) * 100), 100);

  return { daily_exertion: dailyExertion, total_trimp: totalTrimp, workouts: results };
}

module.exports = {
  computeTrimp,
  estimateMaxHr,
  scoreWorkout,
  getDailyExertion,
};
