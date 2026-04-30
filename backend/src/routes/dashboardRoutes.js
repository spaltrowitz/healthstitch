const express = require('express');
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function dateString(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function generateDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function fillGaps(rows, dateRange, dateKey = 'date') {
  const byDate = new Map(rows.map((r) => [r[dateKey], r]));
  return dateRange.map((date) => {
    const row = byDate.get(date);
    if (row) return { ...row, has_data: true };
    return { [dateKey]: date, has_data: false };
  });
}

function sourceList(sourceFilter) {
  if (sourceFilter === 'apple_watch' || sourceFilter === 'whoop') return [sourceFilter];
  return ['apple_watch', 'whoop'];
}

// Pre-compiled statements for morning check-in
const whoopRecoveryStmt = db.prepare(`
  SELECT value FROM metric_records
  WHERE user_id = ? AND source = 'whoop' AND metric_type = 'recovery_score' AND date(recorded_at) = ?
  ORDER BY recorded_at DESC
  LIMIT 1
`);

const whoopHrvStmt = db.prepare(`
  SELECT value FROM metric_records
  WHERE user_id = ? AND source = 'whoop' AND metric_type = 'hrv_rmssd' AND date(recorded_at) = ?
  ORDER BY recorded_at DESC
  LIMIT 1
`);

const appleHrvStmt = db.prepare(`
  SELECT value FROM metric_records
  WHERE user_id = ? AND source = 'apple_watch' AND metric_type = 'hrv_sdnn' AND date(recorded_at) = ?
  ORDER BY recorded_at DESC
  LIMIT 1
`);

const whoopRhrStmt = db.prepare(`
  SELECT value FROM metric_records
  WHERE user_id = ? AND source = 'whoop' AND metric_type = 'resting_hr' AND date(recorded_at) = ?
  ORDER BY recorded_at DESC
  LIMIT 1
`);

const appleRhrStmt = db.prepare(`
  SELECT value FROM metric_records
  WHERE user_id = ? AND source = 'apple_watch' AND metric_type = 'resting_hr' AND date(recorded_at) = ?
  ORDER BY recorded_at DESC
  LIMIT 1
`);

const whoopSleepStmt = db.prepare(`
  SELECT * FROM sleep_records
  WHERE user_id = ? AND source = 'whoop' AND sleep_date IN (?, ?)
  ORDER BY sleep_date DESC, end_at DESC
  LIMIT 1
`);

const whoopStrainStmt = db.prepare(`
  SELECT value FROM metric_records
  WHERE user_id = ? AND source = 'whoop' AND metric_type = 'daily_strain' AND date(recorded_at) = ?
  ORDER BY recorded_at DESC
  LIMIT 1
`);

const appleWorkoutStmt = db.prepare(`
  SELECT sport_type, duration_ms
  FROM workout_records
  WHERE user_id = ? AND source = 'apple_watch' AND date(start_at) = ?
  ORDER BY duration_ms DESC
  LIMIT 1
`);

// Per-source baseline lookups
const baselineStmt = db.prepare(`
  SELECT value, baseline_date
  FROM derived_baselines
  WHERE user_id = ? AND source = ? AND metric_type = ? AND window_days = ? AND baseline_date <= ?
  ORDER BY baseline_date DESC
  LIMIT 1
`);

function getBaseline(userId, source, metricType, windowDays, day) {
  return baselineStmt.get(userId, source, metricType, windowDays, day);
}

function pctDelta(value, baseline) {
  if (value == null || baseline == null || baseline === 0) return null;
  return ((value - baseline) / baseline) * 100;
}

router.get('/morning-checkin', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const day = String(req.query.date || dateString(0));
  const yesterday = dateString(-1);

  const whoopRecovery = whoopRecoveryStmt.get(userId, day)?.value ?? null;

  // HRV: each source compared against its own baseline (no cross-comparison)
  const todayWhoopHrv = whoopHrvStmt.get(userId, day)?.value ?? null;
  const todayAppleHrv = appleHrvStmt.get(userId, day)?.value ?? null;

  const whoopHrvBaseline = getBaseline(userId, 'whoop', 'hrv_rmssd', 90, day)?.value ?? null;
  const appleHrvBaseline = getBaseline(userId, 'apple_watch', 'hrv_sdnn', 90, day)?.value ?? null;

  // RHR: each source compared against its own baseline
  const todayWhoopRhr = whoopRhrStmt.get(userId, day)?.value ?? null;
  const todayAppleRhr = appleRhrStmt.get(userId, day)?.value ?? null;

  const whoopRhrBaseline = getBaseline(userId, 'whoop', 'resting_hr', 30, day)?.value ?? null;
  const appleRhrBaseline = getBaseline(userId, 'apple_watch', 'resting_hr', 30, day)?.value ?? null;

  const whoopSleep = whoopSleepStmt.get(userId, day, yesterday);
  const appleSleepAvg = getBaseline(userId, 'apple_watch', 'sleep_duration', 90, day)?.value ?? null;
  const whoopSleepAvg = getBaseline(userId, 'whoop', 'sleep_duration', 90, day)?.value ?? null;
  const sleepDebtMs = whoopSleep ? Math.max((whoopSleep.sleep_need_ms || 0) - whoopSleep.total_duration_ms, 0) : null;

  const whoopStrainYesterday = whoopStrainStmt.get(userId, yesterday)?.value ?? null;
  const appleWorkoutYesterday = appleWorkoutStmt.get(userId, yesterday);

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
      whoop: {
        value: todayWhoopHrv,
        metric_type: 'hrv_rmssd',
        baseline_90d: whoopHrvBaseline,
        delta_pct: pctDelta(todayWhoopHrv, whoopHrvBaseline)
      },
      apple_watch: {
        value: todayAppleHrv,
        metric_type: 'hrv_sdnn',
        baseline_90d: appleHrvBaseline,
        delta_pct: pctDelta(todayAppleHrv, appleHrvBaseline)
      }
    },
    resting_hr: {
      whoop: {
        value: todayWhoopRhr,
        baseline_30d: whoopRhrBaseline,
        delta_pct: pctDelta(todayWhoopRhr, whoopRhrBaseline)
      },
      apple_watch: {
        value: todayAppleRhr,
        baseline_30d: appleRhrBaseline,
        delta_pct: pctDelta(todayAppleRhr, appleRhrBaseline)
      }
    },
    sleep: {
      actual_ms: whoopSleep?.total_duration_ms ?? null,
      whoop_sleep_need_ms: whoopSleep?.sleep_need_ms ?? null,
      apple_long_term_avg_ms: appleSleepAvg,
      whoop_long_term_avg_ms: whoopSleepAvg,
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

  // Strain and active energy kept as separate metrics (no combined "load")
  const whoopStrain = db.prepare(`
    SELECT date(recorded_at) AS date, value AS whoop_strain
    FROM metric_records
    WHERE user_id = ?
      AND metric_type = 'daily_strain'
      ${dateClause}
    ORDER BY date ASC
  `).all(userId, ...(fromDate ? [fromDate] : []));

  const appleActiveEnergy = db.prepare(`
    SELECT date(recorded_at) AS date, SUM(value) AS apple_active_energy_kcal
    FROM metric_records
    WHERE user_id = ?
      AND metric_type = 'active_energy'
      ${dateClause}
    GROUP BY date
    ORDER BY date ASC
  `).all(userId, ...(fromDate ? [fromDate] : []));

  const baselineRows = db.prepare(`
    SELECT baseline_date AS date, source, metric_type, window_days, value
    FROM derived_baselines
    WHERE user_id = ?
      ${fromDate ? 'AND baseline_date >= ?' : ''}
    ORDER BY baseline_date ASC
  `).all(userId, ...(fromDate ? [fromDate] : []));

  const today = dateString(0);
  const rangeStart = fromDate || (hrv.length ? hrv[0].date : today);
  const dateRange = generateDateRange(rangeStart, today);

  return res.json({
    range,
    source: sources,
    timeline_start: fromDate,
    hrv: fillGaps(hrv, dateRange),
    resting_hr: fillGaps(restingHr, dateRange),
    sleep: fillGaps(sleep, dateRange),
    sleep_stages: fillGaps(sleepStages, dateRange),
    strain: {
      whoop: fillGaps(whoopStrain, dateRange),
      apple_active_energy: fillGaps(appleActiveEnergy, dateRange)
    },
    baselines: baselineRows
  });
});

// Pre-compiled for device-comparison
const deviceCompRhrStmt = db.prepare(`
  SELECT date(recorded_at) AS date, source, AVG(value) AS value
  FROM metric_records
  WHERE user_id = ?
    AND metric_type = 'resting_hr'
    AND source IN ('apple_watch', 'whoop')
    AND date(recorded_at) BETWEEN ? AND ?
  GROUP BY date, source
  ORDER BY date ASC
`);

const deviceCompSleepStmt = db.prepare(`
  SELECT sleep_date AS date, source, AVG(total_duration_ms) AS value
  FROM sleep_records
  WHERE user_id = ?
    AND source IN ('apple_watch', 'whoop')
    AND sleep_date BETWEEN ? AND ?
  GROUP BY sleep_date, source
  ORDER BY sleep_date ASC
`);

router.get('/device-comparison', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const metric = String(req.query.metric || 'sleep_duration');
  const from = String(req.query.from || dateString(-30));
  const to = String(req.query.to || dateString(0));

  let appleRows = [];
  let whoopRows = [];

  if (metric === 'resting_hr') {
    const query = deviceCompRhrStmt.all(userId, from, to);
    appleRows = query.filter((row) => row.source === 'apple_watch');
    whoopRows = query.filter((row) => row.source === 'whoop');
  } else {
    const query = deviceCompSleepStmt.all(userId, from, to);
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

// Lazy-init for workouts — aggregates table created by migration
let _weeklyAggStmt, _monthlyAggStmt;
function getAggStmts() {
  if (!_weeklyAggStmt) {
    _weeklyAggStmt = db.prepare(`
      SELECT period_start AS period, SUM(total_load) AS load, SUM(workout_count) AS count,
        AVG(avg_strain) AS avg_strain, SUM(total_calories) AS calories
      FROM training_load_aggregates
      WHERE user_id = ? AND period_type = 'weekly'
        AND period_start >= ? AND period_end <= ?
      GROUP BY period_start
      ORDER BY period_start ASC
    `);
    _monthlyAggStmt = db.prepare(`
      SELECT period_start AS period, SUM(total_load) AS load, SUM(workout_count) AS count,
        AVG(avg_strain) AS avg_strain, SUM(total_calories) AS calories
      FROM training_load_aggregates
      WHERE user_id = ? AND period_type = 'monthly'
        AND period_start >= ? AND period_end <= ?
      GROUP BY period_start
      ORDER BY period_start ASC
    `);
  }
  return { weeklyAggStmt: _weeklyAggStmt, monthlyAggStmt: _monthlyAggStmt };
}

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

  const { weeklyAggStmt, monthlyAggStmt } = getAggStmts();
  const weekly = weeklyAggStmt.all(userId, from, to);
  const monthly = monthlyAggStmt.all(userId, from, to);

  return res.json({
    workouts,
    weekly_load: weekly.map((r) => ({ period: r.period, load: r.load, count: r.count, avg_strain: r.avg_strain, calories: r.calories })),
    monthly_load: monthly.map((r) => ({ period: r.period, load: r.load, count: r.count, avg_strain: r.avg_strain, calories: r.calories }))
  });
});

module.exports = router;
