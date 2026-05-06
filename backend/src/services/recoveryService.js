const { randomUUID } = require('crypto');
const db = require('../db/client');
const { getDailyExertion } = require('./exertionService');
const { computeSleepNeed } = require('./sleepNeedService');

const MIN_BASELINE_NIGHTS = 4;
const BASELINE_WINDOW_DAYS = 7;

async function getHrvForDate(userId, date) {
  const { rows } = await db.query(`
    SELECT value, source,
      CASE WHEN metric_type = 'hrv_rmssd' THEN 'rmssd' ELSE 'sdnn' END AS method
    FROM metric_records
    WHERE user_id = $1
      AND metric_type IN ('hrv_rmssd', 'hrv_sdnn')
      AND recorded_at::date = $2::date
    ORDER BY
      CASE WHEN metric_type = 'hrv_rmssd' THEN 0 ELSE 1 END,
      recorded_at DESC
    LIMIT 1
  `, [userId, date]);

  if (rows.length === 0) return null;
  return { value: rows[0].value, source: rows[0].source, method: rows[0].method };
}

async function getRhrForDate(userId, date) {
  const { rows } = await db.query(`
    SELECT value, source FROM metric_records
    WHERE user_id = $1
      AND metric_type = 'resting_hr'
      AND recorded_at::date = $2::date
    ORDER BY recorded_at DESC
    LIMIT 1
  `, [userId, date]);

  if (rows.length === 0) return null;
  return { value: rows[0].value, source: rows[0].source };
}

async function getBaseline(userId, date, metricType) {
  const { rows } = await db.query(`
    SELECT value FROM metric_records
    WHERE user_id = $1
      AND metric_type = $2
      AND recorded_at::date BETWEEN ($3::date - INTERVAL '${BASELINE_WINDOW_DAYS} days') AND ($3::date - INTERVAL '1 day')
  `, [userId, metricType, date]);

  if (rows.length < MIN_BASELINE_NIGHTS) return null;
  const sum = rows.reduce((acc, r) => acc + r.value, 0);
  return sum / rows.length;
}

function normalizeScore(value, baseline) {
  if (!baseline || baseline === 0) return 50;
  const delta = (value - baseline) / baseline;
  return Math.max(0, Math.min(100, 50 + (delta * 100)));
}

function normalizeRhrScore(value, baseline) {
  if (!baseline || baseline === 0) return 50;
  const delta = (baseline - value) / baseline;
  return Math.max(0, Math.min(100, 50 + (delta * 100)));
}

function recoveryZone(score) {
  if (score >= 67) return 'green';
  if (score >= 34) return 'yellow';
  return 'red';
}

async function computeRecoveryScore(userId, date) {
  const hrv = await getHrvForDate(userId, date);
  const rhr = await getRhrForDate(userId, date);
  const sleepNeed = await computeSleepNeed(userId, date);

  const hrvMetricType = hrv?.method === 'rmssd' ? 'hrv_rmssd' : 'hrv_sdnn';
  const hrvBaseline = hrv ? await getBaseline(userId, date, hrvMetricType) : null;
  const rhrBaseline = rhr ? await getBaseline(userId, date, 'resting_hr') : null;

  const lastNight = sleepNeed.last_night;
  const sleepEfficiency = lastNight?.efficiency ?? null;
  const totalSleepMs = lastNight?.duration_ms ?? 0;
  const swsMs = lastNight?.sws_ms ?? 0;
  const swsPct = totalSleepMs > 0 ? swsMs / totalSleepMs : 0;

  const hrvScore = hrv && hrvBaseline ? normalizeScore(hrv.value, hrvBaseline) : null;
  const rhrScore = rhr && rhrBaseline ? normalizeRhrScore(rhr.value, rhrBaseline) : null;
  const efficiencyScore = sleepEfficiency != null ? sleepEfficiency : null;
  const swsScore = Math.min(swsPct / 0.20, 1.0) * 100;

  const components = [];
  const weights = [];
  if (hrvScore != null) { components.push(hrvScore); weights.push(0.35); }
  if (rhrScore != null) { components.push(rhrScore); weights.push(0.25); }
  if (efficiencyScore != null) { components.push(efficiencyScore); weights.push(0.25); }
  if (swsMs > 0) { components.push(swsScore); weights.push(0.15); }

  let recovery = null;
  if (components.length >= 2) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    recovery = components.reduce((sum, c, i) => sum + c * weights[i], 0) / totalWeight;
    recovery = Math.max(0, Math.min(100, Math.round(recovery)));
  }

  const zone = recovery != null ? recoveryZone(recovery) : null;

  const flags = [];
  let confidence = 'high';
  if (hrv?.method === 'sdnn') {
    flags.push('Using SDNN (Apple Watch). RMSSD preferred — enable raw IBI sync for better accuracy.');
    confidence = 'medium';
  }
  if (!hrvBaseline) {
    flags.push('Insufficient HRV history for baseline (need 4+ nights in past 7 days).');
    confidence = 'low';
  }
  if (!rhr) flags.push('No resting HR data for this date.');
  if (!lastNight) flags.push('No sleep data for this date.');
  if (components.length < 3) confidence = 'low';

  const exertion = await getDailyExertion(userId, date);

  const inputs = {
    hrv: hrv ? { value: hrv.value, method: hrv.method, source: hrv.source, baseline_7d: hrvBaseline, delta_pct: hrvBaseline ? ((hrv.value - hrvBaseline) / hrvBaseline * 100).toFixed(1) : null } : null,
    rhr: rhr ? { value: rhr.value, source: rhr.source, baseline_7d: rhrBaseline, delta_pct: rhrBaseline ? ((rhr.value - rhrBaseline) / rhrBaseline * 100).toFixed(1) : null } : null,
    sleep_efficiency: sleepEfficiency,
    sws_pct: swsPct > 0 ? parseFloat(swsPct.toFixed(3)) : null,
  };

  await db.query(`
    INSERT INTO computed_daily_scores (
      id, user_id, score_date, recovery_score, recovery_zone, exertion_score,
      sleep_need_ms, fatigue_reduction_ms, adjusted_sleep_need_ms, sleep_debt_ms,
      data_quality_json, inputs_json, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT(user_id, score_date)
    DO UPDATE SET
      recovery_score = EXCLUDED.recovery_score,
      recovery_zone = EXCLUDED.recovery_zone,
      exertion_score = EXCLUDED.exertion_score,
      sleep_need_ms = EXCLUDED.sleep_need_ms,
      fatigue_reduction_ms = EXCLUDED.fatigue_reduction_ms,
      adjusted_sleep_need_ms = EXCLUDED.adjusted_sleep_need_ms,
      sleep_debt_ms = EXCLUDED.sleep_debt_ms,
      data_quality_json = EXCLUDED.data_quality_json,
      inputs_json = EXCLUDED.inputs_json,
      updated_at = NOW()
  `, [
    randomUUID(), userId, date, recovery, zone, exertion.daily_exertion,
    sleepNeed.base_need_ms, sleepNeed.nap_credit_ms, sleepNeed.adjusted_need_ms,
    sleepNeed.debt_ms,
    JSON.stringify({ confidence, flags }),
    JSON.stringify(inputs),
  ]);

  return {
    date,
    recovery: { score: recovery, zone, inputs, confidence, flags },
    exertion,
    sleep_need: sleepNeed,
  };
}

module.exports = { computeRecoveryScore };
