const express = require('express');
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function dateString(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function sourceList(sourceFilter) {
  if (sourceFilter === 'apple_watch' || sourceFilter === 'whoop') return [sourceFilter];
  return ['apple_watch', 'whoop'];
}

function getBaseline(userId, metricType, windowDays, day) {
  return db.prepare(`
    SELECT value, baseline_date
    FROM derived_baselines
    WHERE user_id = ? AND source = 'apple_watch' AND metric_type = ? AND window_days = ? AND baseline_date <= ?
    ORDER BY baseline_date DESC
    LIMIT 1
  `).get(userId, metricType, windowDays, day);
}

function pctDelta(value, baseline) {
  if (value == null || baseline == null || baseline === 0) return null;
  return ((value - baseline) / baseline) * 100;
}

router.get('/morning-checkin', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const day = String(req.query.date || dateString(0));
  const yesterday = dateString(-1);

  const whoopRecovery = db.prepare(`
    SELECT value FROM metric_records
    WHERE user_id = ? AND source = 'whoop' AND metric_type = 'recovery_score' AND date(recorded_at) = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(userId, day)?.value ?? null;

  const todayWhoopHrv = db.prepare(`
    SELECT value FROM metric_records
    WHERE user_id = ? AND source = 'whoop' AND metric_type = 'hrv_rmssd' AND date(recorded_at) = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(userId, day)?.value ?? null;

  const todayAppleHrv = db.prepare(`
    SELECT value FROM metric_records
    WHERE user_id = ? AND source = 'apple_watch' AND metric_type = 'hrv_sdnn' AND date(recorded_at) = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(userId, day)?.value ?? null;

  const todayHrv = todayWhoopHrv ?? todayAppleHrv;
  const hrvBaseline = getBaseline(userId, 'hrv_sdnn', 90, day)?.value ?? null;

  const todayWhoopRhr = db.prepare(`
    SELECT value FROM metric_records
    WHERE user_id = ? AND source = 'whoop' AND metric_type = 'resting_hr' AND date(recorded_at) = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(userId, day)?.value ?? null;

  const todayAppleRhr = db.prepare(`
    SELECT value FROM metric_records
    WHERE user_id = ? AND source = 'apple_watch' AND metric_type = 'resting_hr' AND date(recorded_at) = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(userId, day)?.value ?? null;

  const todayRhr = todayWhoopRhr ?? todayAppleRhr;
  const rhrBaseline = getBaseline(userId, 'resting_hr', 30, day)?.value ?? null;

  const whoopSleep = db.prepare(`
    SELECT * FROM sleep_records
    WHERE user_id = ? AND source = 'whoop' AND sleep_date IN (?, ?)
    ORDER BY sleep_date DESC, end_at DESC
    LIMIT 1
  `).get(userId, day, yesterday);

  const appleSleepAvg = getBaseline(userId, 'sleep_duration', 90, day)?.value ?? null;
  const sleepDebtMs = whoopSleep ? Math.max((whoopSleep.sleep_need_ms || 0) - whoopSleep.total_duration_ms, 0) : null;

  const whoopStrainYesterday = db.prepare(`
    SELECT value FROM metric_records
    WHERE user_id = ? AND source = 'whoop' AND metric_type = 'daily_strain' AND date(recorded_at) = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(userId, yesterday)?.value ?? null;

  const appleWorkoutYesterday = db.prepare(`
    SELECT sport_type, duration_ms
    FROM workout_records
    WHERE user_id = ? AND source = 'apple_watch' AND date(start_at) = ?
    ORDER BY duration_ms DESC
    LIMIT 1
  `).get(userId, yesterday);

  let recommendation = 'Moderate activity';
  if ((whoopRecovery != null && whoopRecovery < 33) || (sleepDebtMs != null && sleepDebtMs > 3_600_000)) {
    recommendation = 'Prioritize rest';
  } else if (whoopRecovery != null && whoopRecovery > 66) {
    recommendation = 'Ready to train';
  }

  return res.json({
    date: day,
    recovery: {
      score: whoopRecovery,
      zone: whoopRecovery == null ? null : whoopRecovery < 33 ? 'red' : whoopRecovery <= 66 ? 'yellow' : 'green'
    },
    hrv: {
      value: todayHrv,
      source: todayWhoopHrv != null ? 'whoop' : todayAppleHrv != null ? 'apple_watch' : null,
      baseline_90d_apple: hrvBaseline,
      delta_pct_vs_baseline: pctDelta(todayHrv, hrvBaseline)
    },
    resting_hr: {
      value: todayRhr,
      source: todayWhoopRhr != null ? 'whoop' : todayAppleRhr != null ? 'apple_watch' : null,
      baseline_30d_apple: rhrBaseline,
      delta_pct_vs_baseline: pctDelta(todayRhr, rhrBaseline)
    },
    sleep: {
      actual_ms: whoopSleep?.total_duration_ms ?? null,
      whoop_sleep_need_ms: whoopSleep?.sleep_need_ms ?? null,
      apple_long_term_avg_ms: appleSleepAvg,
      whoop_sleep_performance_pct: whoopSleep?.sleep_performance ?? null,
      sleep_debt_ms: sleepDebtMs
    },
    training_yesterday: {
      whoop_strain: whoopStrainYesterday,
      apple_workout_type: appleWorkoutYesterday?.sport_type ?? null,
      apple_workout_duration_ms: appleWorkoutYesterday?.duration_ms ?? null
    },
    recommendation
  });
});

router.get('/trends', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const range = String(req.query.range || '30').toLowerCase();
  const sources = sourceList(String(req.query.source || 'both'));

  let fromDate = null;
  if (range !== 'all') {
    const days = Number(range);
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (Number.isFinite(days) ? days : 30) + 1);
    fromDate = d.toISOString().slice(0, 10);
  }

  const sourcePlaceholders = sources.map(() => '?').join(', ');
  const baseParams = [userId, ...sources];
  const dateClause = fromDate ? 'AND date(recorded_at) >= ?' : '';
  const sleepDateClause = fromDate ? 'AND sleep_date >= ?' : '';

  const hrv = db.prepare(`
    SELECT date(recorded_at) AS date, source, metric_type, AVG(value) AS value
    FROM metric_records
    WHERE user_id = ?
      AND source IN (${sourcePlaceholders})
      AND metric_type IN ('hrv_sdnn', 'hrv_rmssd')
      ${dateClause}
    GROUP BY date, source, metric_type
    ORDER BY date ASC
  `).all(...baseParams, ...(fromDate ? [fromDate] : []));

  const restingHr = db.prepare(`
    SELECT date(recorded_at) AS date, source, AVG(value) AS value
    FROM metric_records
    WHERE user_id = ?
      AND source IN (${sourcePlaceholders})
      AND metric_type = 'resting_hr'
      ${dateClause}
    GROUP BY date, source
    ORDER BY date ASC
  `).all(...baseParams, ...(fromDate ? [fromDate] : []));

  const sleep = db.prepare(`
    SELECT sleep_date AS date, source, total_duration_ms, sleep_need_ms
    FROM sleep_records
    WHERE user_id = ?
      AND source IN (${sourcePlaceholders})
      ${sleepDateClause}
    ORDER BY sleep_date ASC
  `).all(...baseParams, ...(fromDate ? [fromDate] : []));

  const sleepStages = db.prepare(`
    SELECT sleep_date AS date, slow_wave_ms, rem_ms, light_ms, awake_ms
    FROM sleep_records
    WHERE user_id = ?
      AND source = 'whoop'
      ${fromDate ? 'AND sleep_date >= ?' : ''}
    ORDER BY sleep_date ASC
  `).all(userId, ...(fromDate ? [fromDate] : []));

  const whoopStrain = db.prepare(`
    SELECT date(recorded_at) AS date, value AS whoop_strain
    FROM metric_records
    WHERE user_id = ?
      AND metric_type = 'daily_strain'
      ${dateClause}
    ORDER BY date ASC
  `).all(userId, ...(fromDate ? [fromDate] : []));

  const appleLoad = db.prepare(`
    SELECT date(recorded_at) AS date, value AS apple_active_energy
    FROM metric_records
    WHERE user_id = ?
      AND metric_type = 'active_energy'
      ${dateClause}
    ORDER BY date ASC
  `).all(userId, ...(fromDate ? [fromDate] : []));

  const loadRows = db.prepare(`
    SELECT date(recorded_at) AS date,
      CASE
        WHEN metric_type = 'daily_strain' THEN value
        WHEN metric_type = 'active_energy' THEN value / 100.0
        ELSE 0
      END AS load
    FROM metric_records
    WHERE user_id = ?
      AND metric_type IN ('daily_strain', 'active_energy')
      ${dateClause}
    ORDER BY date ASC
  `).all(userId, ...(fromDate ? [fromDate] : []));

  const loadByDate = new Map();
  for (const row of loadRows) {
    loadByDate.set(row.date, (loadByDate.get(row.date) || 0) + row.load);
  }
  const orderedDates = [...loadByDate.keys()].sort();
  const rolling7 = orderedDates.map((date, idx) => {
    const window = orderedDates.slice(Math.max(0, idx - 6), idx + 1);
    const avg = window.reduce((sum, d) => sum + loadByDate.get(d), 0) / window.length;
    return { date, value: avg };
  });

  const baselineRows = db.prepare(`
    SELECT baseline_date AS date, metric_type, window_days, value
    FROM derived_baselines
    WHERE user_id = ?
      AND source = 'apple_watch'
      ${fromDate ? 'AND baseline_date >= ?' : ''}
    ORDER BY baseline_date ASC
  `).all(userId, ...(fromDate ? [fromDate] : []));

  return res.json({
    range,
    source: sources,
    timeline_start: fromDate,
    hrv,
    resting_hr: restingHr,
    sleep,
    sleep_stages: sleepStages,
    strain: {
      whoop: whoopStrain,
      apple_load: appleLoad,
      rolling_7d_load: rolling7
    },
    baselines: baselineRows
  });
});

router.get('/device-comparison', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const metric = String(req.query.metric || 'sleep_duration');
  const from = String(req.query.from || dateString(-30));
  const to = String(req.query.to || dateString(0));

  let appleRows = [];
  let whoopRows = [];

  if (metric === 'resting_hr') {
    const query = db.prepare(`
      SELECT date(recorded_at) AS date, source, AVG(value) AS value
      FROM metric_records
      WHERE user_id = ?
        AND metric_type = 'resting_hr'
        AND source IN ('apple_watch', 'whoop')
        AND date(recorded_at) BETWEEN ? AND ?
      GROUP BY date, source
      ORDER BY date ASC
    `).all(userId, from, to);

    appleRows = query.filter((row) => row.source === 'apple_watch');
    whoopRows = query.filter((row) => row.source === 'whoop');
  } else {
    const query = db.prepare(`
      SELECT sleep_date AS date, source, AVG(total_duration_ms) AS value
      FROM sleep_records
      WHERE user_id = ?
        AND source IN ('apple_watch', 'whoop')
        AND sleep_date BETWEEN ? AND ?
      GROUP BY sleep_date, source
      ORDER BY sleep_date ASC
    `).all(userId, from, to);

    appleRows = query.filter((row) => row.source === 'apple_watch');
    whoopRows = query.filter((row) => row.source === 'whoop');
  }

  const appleMap = new Map(appleRows.map((r) => [r.date, r.value]));
  const whoopMap = new Map(whoopRows.map((r) => [r.date, r.value]));

  const dates = [...new Set([...appleMap.keys(), ...whoopMap.keys()])].sort();
  const rows = dates.map((date) => {
    const apple = appleMap.get(date) ?? null;
    const whoop = whoopMap.get(date) ?? null;
    return {
      date,
      apple_watch_value: apple,
      whoop_value: whoop,
      delta: apple == null || whoop == null ? null : whoop - apple
    };
  });

  const validDelta = rows.filter((r) => r.delta != null).map((r) => r.delta);
  const averageDelta = validDelta.length ? validDelta.reduce((a, b) => a + b, 0) / validDelta.length : null;

  return res.json({ metric, from, to, rows, average_delta: averageDelta });
});

router.get('/workouts', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const source = String(req.query.source || 'both');
  const from = String(req.query.from || dateString(-90));
  const to = String(req.query.to || dateString(0));
  const sport = String(req.query.sport || 'all');

  const sources = sourceList(source);
  const sourcePlaceholders = sources.map(() => '?').join(', ');
  const params = [userId, ...sources, from, to];

  let sportClause = '';
  if (sport !== 'all') {
    sportClause = 'AND sport_type = ?';
    params.push(sport);
  }

  const workouts = db.prepare(`
    SELECT
      date(start_at) AS date,
      source,
      sport_type,
      duration_ms,
      avg_hr,
      max_hr,
      strain,
      COALESCE(energy_kcal, energy_kj * 0.239006) AS calories
    FROM workout_records
    WHERE user_id = ?
      AND source IN (${sourcePlaceholders})
      AND date(start_at) BETWEEN ? AND ?
      ${sportClause}
    ORDER BY start_at DESC
  `).all(...params);

  const loadRows = db.prepare(`
    SELECT
      date(start_at) AS date,
      strftime('%Y-%W', start_at) AS week,
      strftime('%Y-%m', start_at) AS month,
      COALESCE(strain, COALESCE(energy_kcal, energy_kj * 0.239006), duration_ms / 60000.0) AS load
    FROM workout_records
    WHERE user_id = ?
      AND source IN (${sourcePlaceholders})
      AND date(start_at) BETWEEN ? AND ?
      ${sportClause}
  `).all(...params);

  const weekly = {};
  const monthly = {};
  for (const row of loadRows) {
    weekly[row.week] = (weekly[row.week] || 0) + (row.load || 0);
    monthly[row.month] = (monthly[row.month] || 0) + (row.load || 0);
  }

  return res.json({
    workouts,
    weekly_load: Object.entries(weekly).map(([period, load]) => ({ period, load })),
    monthly_load: Object.entries(monthly).map(([period, load]) => ({ period, load }))
  });
});

module.exports = router;
