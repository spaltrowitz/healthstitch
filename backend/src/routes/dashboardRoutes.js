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

  // Check recovery mode
  const activeRecovery = db.prepare(`
    SELECT id, reason, start_date, notes FROM recovery_periods
    WHERE user_id = ? AND end_date IS NULL
    ORDER BY start_date DESC LIMIT 1
  `).get(userId);

  let recoveryMode = null;
  if (activeRecovery) {
    const dayNum = Math.floor((Date.now() - new Date(activeRecovery.start_date).getTime()) / 86400000) + 1;
    recoveryMode = {
      active: true,
      reason: activeRecovery.reason,
      since: activeRecovery.start_date,
      day_number: dayNum
    };
  }

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
  if (recoveryMode) {
    if (recoveryMode.day_number <= 3) recommendation = 'Rest and recover. Your body is healing.';
    else if (recoveryMode.day_number <= 7) recommendation = 'Gentle movement if comfortable. Don\'t push it.';
    else recommendation = 'Listen to your body. Consider ending recovery mode when you feel ready.';
  } else if ((whoopRecovery != null && whoopRecovery < 33) || (sleepDebtMs != null && sleepDebtMs > 3_600_000)) {
    recommendation = 'Prioritize rest';
  } else if (whoopRecovery != null && whoopRecovery > 66) {
    recommendation = 'Ready to train';
  }

  const baselineSuppressed = !!recoveryMode;

  return res.json({
    date: day,
    recovery_mode: recoveryMode,
    recovery: {
      score: whoopRecovery,
      zone: whoopRecovery == null ? null : whoopRecovery < 33 ? 'red' : whoopRecovery <= 66 ? 'yellow' : 'green'
    },
    hrv: {
      value: todayHrv,
      source: todayWhoopHrv != null ? 'whoop' : todayAppleHrv != null ? 'apple_watch' : null,
      baseline_90d_apple: hrvBaseline,
      delta_pct_vs_baseline: baselineSuppressed ? null : pctDelta(todayHrv, hrvBaseline),
      suppressed: baselineSuppressed
    },
    resting_hr: {
      value: todayRhr,
      source: todayWhoopRhr != null ? 'whoop' : todayAppleRhr != null ? 'apple_watch' : null,
      baseline_30d_apple: rhrBaseline,
      delta_pct_vs_baseline: baselineSuppressed ? null : pctDelta(todayRhr, rhrBaseline),
      suppressed: baselineSuppressed
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

router.get('/score-explainer', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const day = String(req.query.date || dateString(0));
  const yesterday = dateString(-1);

  // Get sleep from both sources
  const appleSleep = db.prepare(`
    SELECT total_duration_ms, slow_wave_ms, rem_ms, light_ms, awake_ms
    FROM sleep_records WHERE user_id = ? AND source = 'apple_watch' AND sleep_date = ?
    ORDER BY end_at DESC LIMIT 1
  `).get(userId, day);

  const whoopSleep = db.prepare(`
    SELECT total_duration_ms, slow_wave_ms, rem_ms, light_ms, awake_ms,
      sleep_performance, sleep_need_ms, sleep_efficiency, sleep_consistency, respiratory_rate
    FROM sleep_records WHERE user_id = ? AND source = 'whoop' AND sleep_date = ?
      AND (metadata_json IS NULL OR metadata_json NOT LIKE '%"nap":true%')
    ORDER BY end_at DESC LIMIT 1
  `).get(userId, day);

  // Get vitals from both sources
  function getMetric(source, metricType) {
    return db.prepare(`
      SELECT value FROM metric_records
      WHERE user_id = ? AND source = ? AND metric_type = ? AND date(recorded_at) = ?
      ORDER BY recorded_at DESC LIMIT 1
    `).get(userId, source, metricType, day)?.value ?? null;
  }

  // Get 7-day averages for context
  function getAvg7d(source, metricType) {
    return db.prepare(`
      SELECT ROUND(AVG(value), 2) as avg FROM metric_records
      WHERE user_id = ? AND source = ? AND metric_type = ?
        AND date(recorded_at) BETWEEN date(?, '-6 days') AND ?
    `).get(userId, source, metricType, day, day)?.avg ?? null;
  }

  const recoveryScore = getMetric('whoop', 'recovery_score');
  const whoopHrv = getMetric('whoop', 'hrv_rmssd');
  const appleHrv = getMetric('apple_watch', 'hrv_sdnn');
  const whoopRhr = getMetric('whoop', 'resting_hr');
  const appleRhr = getMetric('apple_watch', 'resting_hr');
  const whoopSpo2 = getMetric('whoop', 'spo2');
  const whoopRespRate = getMetric('whoop', 'respiratory_rate');
  const appleRespRate = getMetric('apple_watch', 'respiratory_rate');
  const whoopSkinTemp = getMetric('whoop', 'skin_temp_deviation');
  const prevStrain = getMetric('whoop', 'daily_strain');

  const avgSpo2_7d = getAvg7d('whoop', 'spo2');
  const avgHrv_7d = getAvg7d('whoop', 'hrv_rmssd');
  const avgRhr_7d = getAvg7d('whoop', 'resting_hr');
  const hrvBaseline = getBaseline(userId, 'hrv_sdnn', 90, day)?.value ?? null;
  const rhrBaseline = getBaseline(userId, 'resting_hr', 30, day)?.value ?? null;

  // Build sleep comparison
  const sleepComparison = {};
  if (appleSleep) {
    sleepComparison.apple_watch = {
      total_hours: +(appleSleep.total_duration_ms / 3600000).toFixed(2),
      deep_min: appleSleep.slow_wave_ms ? Math.round(appleSleep.slow_wave_ms / 60000) : null,
      rem_min: appleSleep.rem_ms ? Math.round(appleSleep.rem_ms / 60000) : null,
      light_min: appleSleep.light_ms ? Math.round(appleSleep.light_ms / 60000) : null,
      awake_min: appleSleep.awake_ms ? Math.round(appleSleep.awake_ms / 60000) : null
    };
  }
  if (whoopSleep) {
    sleepComparison.whoop = {
      total_hours: +(whoopSleep.total_duration_ms / 3600000).toFixed(2),
      deep_min: whoopSleep.slow_wave_ms ? Math.round(whoopSleep.slow_wave_ms / 60000) : null,
      rem_min: whoopSleep.rem_ms ? Math.round(whoopSleep.rem_ms / 60000) : null,
      light_min: whoopSleep.light_ms ? Math.round(whoopSleep.light_ms / 60000) : null,
      awake_min: whoopSleep.awake_ms ? Math.round(whoopSleep.awake_ms / 60000) : null,
      performance: whoopSleep.sleep_performance,
      efficiency: whoopSleep.sleep_efficiency,
      need_hours: whoopSleep.sleep_need_ms ? +(whoopSleep.sleep_need_ms / 3600000).toFixed(2) : null
    };
  }

  // Build factors analysis
  const factors = [];

  // SpO2
  if (whoopSpo2 != null) {
    const isLow = whoopSpo2 < 90;
    const isBelowAvg = avgSpo2_7d != null && whoopSpo2 < avgSpo2_7d - 3;
    factors.push({
      metric: 'Blood Oxygen (SpO2)',
      apple_value: null,
      whoop_value: `${whoopSpo2.toFixed(1)}%`,
      avg_7d: avgSpo2_7d ? `${avgSpo2_7d.toFixed(1)}%` : null,
      status: isLow ? 'low' : 'normal',
      impact: isLow ? 'high' : 'low',
      explanation: isLow
        ? 'SpO2 below 90% significantly impacts WHOOP recovery score. If this is medication-related, it may not reflect actual recovery status.'
        : 'SpO2 is within normal range.'
    });
  }

  // HRV
  if (whoopHrv != null || appleHrv != null) {
    const hrvStatus = avgHrv_7d && whoopHrv ? (whoopHrv < avgHrv_7d * 0.85 ? 'below_avg' : whoopHrv > avgHrv_7d * 1.15 ? 'above_avg' : 'normal') : 'normal';
    factors.push({
      metric: 'Heart Rate Variability',
      apple_value: appleHrv ? `${appleHrv.toFixed(1)} ms (SDNN)` : null,
      whoop_value: whoopHrv ? `${whoopHrv.toFixed(1)} ms (RMSSD)` : null,
      avg_7d: avgHrv_7d ? `${avgHrv_7d.toFixed(1)} ms` : null,
      baseline_90d: hrvBaseline ? `${hrvBaseline.toFixed(1)} ms` : null,
      status: hrvStatus,
      impact: hrvStatus === 'below_avg' ? 'high' : 'medium',
      explanation: 'Apple uses SDNN (overall variability), WHOOP uses RMSSD (parasympathetic activity). RMSSD is more sensitive to recovery state. Both trending the same direction is a good sign.'
    });
  }

  // Resting HR
  if (whoopRhr != null || appleRhr != null) {
    const rhrDiff = (whoopRhr && appleRhr) ? Math.abs(whoopRhr - appleRhr) : 0;
    factors.push({
      metric: 'Resting Heart Rate',
      apple_value: appleRhr ? `${appleRhr} bpm` : null,
      whoop_value: whoopRhr ? `${whoopRhr} bpm` : null,
      avg_7d: avgRhr_7d ? `${avgRhr_7d.toFixed(1)} bpm` : null,
      baseline_30d: rhrBaseline ? `${rhrBaseline.toFixed(1)} bpm` : null,
      status: 'normal',
      impact: 'medium',
      explanation: rhrDiff > 3
        ? `${rhrDiff} bpm difference between devices. WHOOP measures during deepest sleep; Apple Watch samples throughout the night.`
        : 'Both devices are closely aligned.'
    });
  }

  // Respiratory Rate
  if (whoopRespRate != null || appleRespRate != null) {
    factors.push({
      metric: 'Respiratory Rate',
      apple_value: appleRespRate ? `${appleRespRate.toFixed(1)} rpm` : null,
      whoop_value: whoopRespRate ? `${whoopRespRate.toFixed(1)} rpm` : null,
      status: 'normal',
      impact: 'low',
      explanation: 'Both devices measure breathing rate during sleep. Minor differences are normal due to different measurement windows.'
    });
  }

  // Previous day strain
  if (prevStrain != null) {
    factors.push({
      metric: 'Previous Day Strain',
      apple_value: null,
      whoop_value: `${prevStrain.toFixed(1)}`,
      status: prevStrain > 14 ? 'high' : prevStrain > 10 ? 'moderate' : 'normal',
      impact: prevStrain > 14 ? 'high' : 'medium',
      explanation: prevStrain > 14
        ? 'High strain yesterday increases sleep need and may lower recovery.'
        : 'Moderate to low strain — not a major factor in today\'s recovery.'
    });
  }

  // Build score breakdown
  const scores = {
    whoop_recovery: recoveryScore != null ? {
      score: recoveryScore,
      zone: recoveryScore < 33 ? 'red' : recoveryScore <= 66 ? 'yellow' : 'green',
      components: 'WHOOP recovery is calculated from HRV, RHR, SpO2, skin temperature, and respiratory rate measured during slow-wave sleep.',
      primary_driver: whoopSpo2 != null && whoopSpo2 < 90 ? 'Low SpO2 is likely the primary factor dragging recovery down.' :
        whoopHrv != null && avgHrv_7d && whoopHrv < avgHrv_7d * 0.85 ? 'Below-average HRV suggests incomplete recovery.' :
        'All vitals appear within normal ranges.'
    } : null,
    whoop_sleep: whoopSleep ? {
      score: whoopSleep.sleep_performance,
      components: 'WHOOP sleep score = actual sleep time ÷ sleep need. Factors in deep, REM, and light sleep quality.',
      primary_driver: whoopSleep.sleep_performance < 70 ? 'You didn\'t meet your sleep need.' :
        'Sleep duration met most of your sleep need.'
    } : null
  };

  return res.json({
    date: day,
    sleep: sleepComparison,
    scores,
    factors,
    summary: whoopSpo2 != null && whoopSpo2 < 90
      ? `Your WHOOP recovery (${recoveryScore || '--'}%) is likely depressed by low blood oxygen (${whoopSpo2.toFixed(1)}%). If this is medication-related, your actual recovery may be better than the score suggests.`
      : recoveryScore != null && recoveryScore < 50
        ? `Low recovery (${recoveryScore}%) — check HRV and sleep quality factors below.`
        : `Recovery looks ${recoveryScore > 66 ? 'good' : 'moderate'}. See factor breakdown below.`
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

router.get('/insights', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const insights = [];

  // Check recovery mode
  const activeRecovery = db.prepare(`
    SELECT reason, start_date FROM recovery_periods
    WHERE user_id = ? AND end_date IS NULL
    ORDER BY start_date DESC LIMIT 1
  `).get(userId);

  if (activeRecovery) {
    const dayNum = Math.floor((Date.now() - new Date(activeRecovery.start_date).getTime()) / 86400000) + 1;
    insights.push({
      type: 'info',
      title: `🩺 Recovery Mode Active — Day ${dayNum}`,
      body: `You've been in recovery mode since ${activeRecovery.start_date} (${activeRecovery.reason}). Baseline comparisons are paused and recovery-period data is excluded from baseline calculations.`,
      detail: 'Your metrics are still being tracked. When you end recovery mode, baselines will resume updating without being skewed by this period.'
    });
  }

  // Determine overlap period
  const whoopRange = db.prepare(`
    SELECT MIN(date(recorded_at)) as start, MAX(date(recorded_at)) as end
    FROM metric_records WHERE user_id = ? AND source = 'whoop'
  `).get(userId);

  if (!whoopRange || !whoopRange.start) {
    return res.json({ insights: [{ type: 'info', title: 'No WHOOP data', body: 'Upload WHOOP data to see cross-device insights.' }] });
  }

  const overlapStart = whoopRange.start;
  const overlapEnd = whoopRange.end;

  // 1. Sleep duration comparison
  const sleepComp = db.prepare(`
    SELECT
      ROUND(AVG(a.total_duration_ms / 3600000.0), 2) as apple_avg,
      ROUND(AVG(w.total_duration_ms / 3600000.0), 2) as whoop_avg,
      ROUND(AVG((a.total_duration_ms - w.total_duration_ms) / 3600000.0), 2) as avg_diff,
      COUNT(*) as days
    FROM sleep_records a
    JOIN sleep_records w ON a.sleep_date = w.sleep_date AND w.source = 'whoop' AND w.user_id = ?
    WHERE a.source = 'apple_watch' AND a.user_id = ?
  `).get(userId, userId);

  if (sleepComp && sleepComp.days > 0) {
    const direction = sleepComp.avg_diff > 0 ? 'longer' : 'shorter';
    const absDiff = Math.abs(sleepComp.avg_diff);
    const diffMin = Math.round(absDiff * 60);
    insights.push({
      type: 'comparison',
      title: 'Sleep Duration: Apple Watch vs WHOOP',
      body: `Over ${sleepComp.days} overlapping nights, Apple Watch reports an average of ${sleepComp.apple_avg}h vs WHOOP's ${sleepComp.whoop_avg}h — Apple Watch records ${diffMin} minutes ${direction} on average.`,
      detail: absDiff > 0.5
        ? 'This is a significant difference. Apple Watch may count light dozing as sleep, while WHOOP uses heart rate to detect true sleep onset.'
        : 'The two devices are closely aligned on sleep tracking.',
      data: { apple_avg: sleepComp.apple_avg, whoop_avg: sleepComp.whoop_avg, diff_hours: sleepComp.avg_diff, days: sleepComp.days }
    });
  }

  // 2. Resting heart rate comparison
  const rhrComp = db.prepare(`
    SELECT
      ROUND(AVG(a.val), 1) as apple_avg,
      ROUND(AVG(w.val), 1) as whoop_avg,
      ROUND(AVG(a.val - w.val), 1) as avg_diff,
      COUNT(*) as days
    FROM (SELECT date(recorded_at) as d, AVG(value) as val FROM metric_records WHERE user_id=? AND source='apple_watch' AND metric_type='resting_hr' AND date(recorded_at) BETWEEN ? AND ? GROUP BY d) a
    JOIN (SELECT date(recorded_at) as d, AVG(value) as val FROM metric_records WHERE user_id=? AND source='whoop' AND metric_type='resting_hr' AND date(recorded_at) BETWEEN ? AND ? GROUP BY d) w
    ON a.d = w.d
  `).get(userId, overlapStart, overlapEnd, userId, overlapStart, overlapEnd);

  if (rhrComp && rhrComp.days > 0) {
    const direction = rhrComp.avg_diff > 0 ? 'higher' : 'lower';
    insights.push({
      type: 'comparison',
      title: 'Resting Heart Rate: Apple Watch vs WHOOP',
      body: `Over ${rhrComp.days} days, Apple Watch averages ${rhrComp.apple_avg} bpm vs WHOOP's ${rhrComp.whoop_avg} bpm — Apple reads ${Math.abs(rhrComp.avg_diff)} bpm ${direction}.`,
      detail: 'WHOOP measures RHR during your deepest sleep phase (slow-wave sleep), while Apple Watch samples throughout the night. This can cause a consistent offset between the two.',
      data: { apple_avg: rhrComp.apple_avg, whoop_avg: rhrComp.whoop_avg, diff_bpm: rhrComp.avg_diff, days: rhrComp.days }
    });
  }

  // 3. HRV methodology difference
  const hrvComp = db.prepare(`
    SELECT
      ROUND(AVG(a.val), 1) as apple_avg_sdnn,
      ROUND(AVG(w.val), 1) as whoop_avg_rmssd,
      COUNT(*) as days
    FROM (SELECT date(recorded_at) as d, AVG(value) as val FROM metric_records WHERE user_id=? AND source='apple_watch' AND metric_type='hrv_sdnn' AND date(recorded_at) BETWEEN ? AND ? GROUP BY d) a
    JOIN (SELECT date(recorded_at) as d, AVG(value) as val FROM metric_records WHERE user_id=? AND source='whoop' AND metric_type='hrv_rmssd' AND date(recorded_at) BETWEEN ? AND ? GROUP BY d) w
    ON a.d = w.d
  `).get(userId, overlapStart, overlapEnd, userId, overlapStart, overlapEnd);

  if (hrvComp && hrvComp.days > 0) {
    insights.push({
      type: 'comparison',
      title: 'HRV: Different Measurements, Different Numbers',
      body: `Apple Watch HRV (SDNN) averages ${hrvComp.apple_avg_sdnn} ms while WHOOP HRV (RMSSD) averages ${hrvComp.whoop_avg_rmssd} ms over ${hrvComp.days} overlapping days.`,
      detail: 'These are fundamentally different calculations. SDNN measures overall variability across all heartbeat intervals, while RMSSD measures beat-to-beat changes — more sensitive to parasympathetic (recovery) activity. Comparing their trends is meaningful, but the absolute numbers will always differ.',
      data: { apple_sdnn: hrvComp.apple_avg_sdnn, whoop_rmssd: hrvComp.whoop_avg_rmssd, days: hrvComp.days }
    });
  }

  // 4. HRV trend correlation
  const hrvTrend = db.prepare(`
    SELECT a.d, a.val as apple_val, w.val as whoop_val
    FROM (SELECT date(recorded_at) as d, AVG(value) as val FROM metric_records WHERE user_id=? AND source='apple_watch' AND metric_type='hrv_sdnn' AND date(recorded_at) BETWEEN ? AND ? GROUP BY d) a
    JOIN (SELECT date(recorded_at) as d, AVG(value) as val FROM metric_records WHERE user_id=? AND source='whoop' AND metric_type='hrv_rmssd' AND date(recorded_at) BETWEEN ? AND ? GROUP BY d) w
    ON a.d = w.d
    ORDER BY a.d
  `).all(userId, overlapStart, overlapEnd, userId, overlapStart, overlapEnd);

  if (hrvTrend.length >= 7) {
    const n = hrvTrend.length;
    const xMean = hrvTrend.reduce((s, r) => s + r.apple_val, 0) / n;
    const yMean = hrvTrend.reduce((s, r) => s + r.whoop_val, 0) / n;
    let num = 0, denX = 0, denY = 0;
    for (const r of hrvTrend) {
      const dx = r.apple_val - xMean;
      const dy = r.whoop_val - yMean;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const corr = denX && denY ? num / Math.sqrt(denX * denY) : 0;
    const corrPct = Math.round(Math.abs(corr) * 100);

    let interpretation;
    if (corr > 0.7) interpretation = 'Your devices strongly agree on HRV trends — when one goes up, the other does too.';
    else if (corr > 0.4) interpretation = 'Your devices moderately agree on HRV trends. They capture similar patterns but with some day-to-day divergence.';
    else interpretation = 'Your devices show weak correlation in HRV trends. This is common given the different measurement methods and timing.';

    insights.push({
      type: 'correlation',
      title: 'Do Your Devices Agree on HRV Trends?',
      body: `Correlation: ${corrPct}% (r = ${corr.toFixed(2)}) over ${n} days.`,
      detail: interpretation,
      data: { correlation: Math.round(corr * 100) / 100, days: n }
    });
  }

  // 5. Recovery vs next-day strain pattern
  const recoveryStrain = db.prepare(`
    SELECT
      CASE WHEN m.value < 33 THEN 'red' WHEN m.value <= 66 THEN 'yellow' ELSE 'green' END as zone,
      ROUND(AVG(ns.value), 1) as avg_next_strain,
      COUNT(*) as days
    FROM metric_records m
    JOIN metric_records ns ON ns.user_id = ? AND ns.source = 'whoop' AND ns.metric_type = 'daily_strain'
      AND date(ns.recorded_at) = date(m.recorded_at, '+1 day')
    WHERE m.user_id = ? AND m.source = 'whoop' AND m.metric_type = 'recovery_score'
    GROUP BY zone
  `).all(userId, userId);

  if (recoveryStrain.length > 0) {
    const zoneMap = {};
    for (const r of recoveryStrain) zoneMap[r.zone] = r;
    const parts = [];
    if (zoneMap.green) parts.push(`Green days (${zoneMap.green.days}): avg strain ${zoneMap.green.avg_next_strain}`);
    if (zoneMap.yellow) parts.push(`Yellow days (${zoneMap.yellow.days}): avg strain ${zoneMap.yellow.avg_next_strain}`);
    if (zoneMap.red) parts.push(`Red days (${zoneMap.red.days}): avg strain ${zoneMap.red.avg_next_strain}`);

    insights.push({
      type: 'pattern',
      title: 'Recovery Zone → Next Day Activity',
      body: parts.join('. ') + '.',
      detail: 'This shows whether you tend to train harder on high-recovery days. Ideally, green days should correlate with higher strain and red days with rest.',
      data: recoveryStrain
    });
  }

  // 6. Sleep consistency
  const sleepTimes = db.prepare(`
    SELECT sleep_date, start_at,
      CAST(strftime('%H', start_at) AS INTEGER) * 60 + CAST(strftime('%M', start_at) AS INTEGER) as onset_minutes
    FROM sleep_records
    WHERE user_id = ? AND source = 'whoop' AND (metadata_json IS NULL OR metadata_json NOT LIKE '%"nap":true%')
    ORDER BY sleep_date DESC LIMIT 30
  `).all(userId);

  if (sleepTimes.length >= 7) {
    const minutes = sleepTimes.map(s => s.onset_minutes > 720 ? s.onset_minutes - 1440 : s.onset_minutes);
    const mean = minutes.reduce((a, b) => a + b, 0) / minutes.length;
    const variance = minutes.reduce((s, m) => s + (m - mean) ** 2, 0) / minutes.length;
    const stdDev = Math.sqrt(variance);
    const avgOnset = mean < 0 ? mean + 1440 : mean;
    const avgHour = Math.floor(avgOnset / 60);
    const avgMin = Math.round(avgOnset % 60);
    const timeStr = `${avgHour > 12 ? avgHour - 12 : avgHour}:${String(avgMin).padStart(2, '0')} ${avgHour >= 12 ? 'PM' : 'AM'}`;

    insights.push({
      type: 'pattern',
      title: 'Sleep Consistency',
      body: `Your average bedtime is ${timeStr} with ±${Math.round(stdDev)} minutes variation over the last ${sleepTimes.length} nights.`,
      detail: stdDev < 30 ? 'Excellent consistency. A regular sleep schedule supports better recovery.' : stdDev < 60 ? 'Moderate consistency. Some variation is normal, but tightening your sleep window could improve recovery.' : 'High variation in bedtime. Irregular sleep schedules can reduce sleep quality even when total hours look fine.',
      data: { avg_onset_minutes: Math.round(avgOnset), std_dev_minutes: Math.round(stdDev), nights: sleepTimes.length }
    });
  }

  // 7. Best and worst recovery days
  const bestWorst = db.prepare(`
    SELECT date(recorded_at) as d, value as recovery,
      (SELECT total_duration_ms / 3600000.0 FROM sleep_records WHERE user_id = ? AND source = 'whoop' AND sleep_date = date(m.recorded_at) LIMIT 1) as sleep_hours,
      (SELECT value FROM metric_records WHERE user_id = ? AND source = 'whoop' AND metric_type = 'daily_strain' AND date(recorded_at) = date(m.recorded_at, '-1 day') LIMIT 1) as prev_strain
    FROM metric_records m
    WHERE user_id = ? AND source = 'whoop' AND metric_type = 'recovery_score'
    ORDER BY value DESC
  `).all(userId, userId, userId);

  if (bestWorst.length >= 5) {
    const top3 = bestWorst.slice(0, 3);
    const bottom3 = bestWorst.slice(-3).reverse();

    const topAvgSleep = top3.filter(r => r.sleep_hours).reduce((s, r) => s + r.sleep_hours, 0) / Math.max(top3.filter(r => r.sleep_hours).length, 1);
    const bottomAvgSleep = bottom3.filter(r => r.sleep_hours).reduce((s, r) => s + r.sleep_hours, 0) / Math.max(bottom3.filter(r => r.sleep_hours).length, 1);

    insights.push({
      type: 'pattern',
      title: 'What Drives Your Best vs Worst Recovery?',
      body: `Best 3 days (avg ${Math.round(top3.reduce((s, r) => s + r.recovery, 0) / 3)}% recovery): avg ${topAvgSleep.toFixed(1)}h sleep. Worst 3 days (avg ${Math.round(bottom3.reduce((s, r) => s + r.recovery, 0) / 3)}% recovery): avg ${bottomAvgSleep.toFixed(1)}h sleep.`,
      detail: 'Sleep duration is the strongest predictor of recovery. Other factors include previous-day strain, alcohol, and sleep consistency.',
      data: { best: top3, worst: bottom3 }
    });
  }

  // 8. Workout Impact on Recovery
  const workoutImpact = db.prepare(`
    SELECT
      CASE WHEN strain < 8 THEN 'low' WHEN strain <= 14 THEN 'moderate' ELSE 'high' END as intensity,
      ROUND(AVG(next_recovery), 1) as avg_next_recovery,
      COUNT(*) as workouts
    FROM (
      SELECT w.strain,
        (SELECT value FROM metric_records WHERE user_id = ? AND source = 'whoop' AND metric_type = 'recovery_score'
         AND date(recorded_at) = date(w.start_at, '+1 day') LIMIT 1) as next_recovery
      FROM workout_records w
      WHERE w.user_id = ? AND w.source = 'whoop' AND w.strain IS NOT NULL
    )
    WHERE next_recovery IS NOT NULL
    GROUP BY intensity
  `).all(userId, userId);

  if (workoutImpact.length > 0) {
    const parts = workoutImpact.map(w => `${w.intensity} strain (${w.workouts}x): ${w.avg_next_recovery}% next-day recovery`);
    insights.push({
      type: 'pattern',
      title: '🏋️ Workout Impact on Recovery',
      body: parts.join('. ') + '.',
      detail: 'Shows how workout intensity affects your next-day recovery. Higher strain should ideally be followed by adequate sleep to maintain recovery.'
    });
  }

  // 9. Sleep Quality vs Quantity
  const sleepQuality = db.prepare(`
    SELECT
      ROUND(AVG(total_duration_ms / 3600000.0), 1) as avg_total_hours,
      ROUND(AVG(CASE WHEN slow_wave_ms IS NOT NULL THEN slow_wave_ms * 100.0 / total_duration_ms END), 1) as avg_deep_pct,
      ROUND(AVG(CASE WHEN rem_ms IS NOT NULL THEN rem_ms * 100.0 / total_duration_ms END), 1) as avg_rem_pct,
      ROUND(AVG(CASE WHEN light_ms IS NOT NULL THEN light_ms * 100.0 / total_duration_ms END), 1) as avg_light_pct,
      COUNT(*) as nights
    FROM sleep_records
    WHERE user_id = ? AND source = 'whoop'
      AND (metadata_json IS NULL OR metadata_json NOT LIKE '%"nap":true%')
  `).get(userId);

  if (sleepQuality && sleepQuality.nights >= 7) {
    const deepStatus = sleepQuality.avg_deep_pct < 15 ? 'below the recommended 15-20%' : 'within the healthy 15-20% range';
    const remStatus = sleepQuality.avg_rem_pct < 20 ? 'below the recommended 20-25%' : 'within the healthy 20-25% range';
    insights.push({
      type: 'pattern',
      title: '😴 Sleep Quality Breakdown',
      body: `Over ${sleepQuality.nights} nights: ${sleepQuality.avg_total_hours}h avg total. Deep sleep: ${sleepQuality.avg_deep_pct}% (${deepStatus}). REM: ${sleepQuality.avg_rem_pct}% (${remStatus}). Light: ${sleepQuality.avg_light_pct}%.`,
      detail: 'Deep sleep is critical for physical recovery and immune function. REM supports memory consolidation and emotional regulation. Getting enough hours but low deep/REM percentages suggests sleep quality issues.'
    });
  }

  // 10. Weekend vs Weekday patterns
  const weekdayPattern = db.prepare(`
    SELECT
      CASE WHEN CAST(strftime('%w', sleep_date) AS INTEGER) IN (0, 6) THEN 'weekend' ELSE 'weekday' END as day_type,
      ROUND(AVG(total_duration_ms / 3600000.0), 2) as avg_hours,
      COUNT(*) as nights
    FROM sleep_records
    WHERE user_id = ? AND source = 'whoop'
      AND (metadata_json IS NULL OR metadata_json NOT LIKE '%"nap":true%')
    GROUP BY day_type
  `).all(userId);

  if (weekdayPattern.length === 2) {
    const weekday = weekdayPattern.find(r => r.day_type === 'weekday');
    const weekend = weekdayPattern.find(r => r.day_type === 'weekend');
    if (weekday && weekend) {
      const diff = Math.abs(weekend.avg_hours - weekday.avg_hours);
      const direction = weekend.avg_hours > weekday.avg_hours ? 'more' : 'less';
      insights.push({
        type: 'pattern',
        title: '📅 Weekend vs Weekday Sleep',
        body: `Weekdays: ${weekday.avg_hours}h avg (${weekday.nights} nights). Weekends: ${weekend.avg_hours}h avg (${weekend.nights} nights). You sleep ${(diff * 60).toFixed(0)} minutes ${direction} on weekends.`,
        detail: diff > 1 ? 'A difference of more than 1 hour suggests social jet lag — your body\'s clock shifts on weekends. This can reduce sleep quality even when total hours increase.' : 'Good consistency between weekdays and weekends. This supports a stable circadian rhythm.'
      });
    }
  }

  // 11. Optimal Sleep Window
  const sleepRecoveryCorr = db.prepare(`
    SELECT
      CASE
        WHEN s.total_duration_ms / 3600000.0 < 6.5 THEN 'under6.5h'
        WHEN s.total_duration_ms / 3600000.0 < 7.5 THEN '6.5-7.5h'
        WHEN s.total_duration_ms / 3600000.0 < 8.5 THEN '7.5-8.5h'
        WHEN s.total_duration_ms / 3600000.0 < 9.5 THEN '8.5-9.5h'
        ELSE 'over9.5h'
      END as bucket,
      ROUND(AVG(m.value), 1) as avg_recovery,
      COUNT(*) as nights
    FROM sleep_records s
    JOIN metric_records m ON m.user_id = ? AND m.source = 'whoop' AND m.metric_type = 'recovery_score'
      AND date(m.recorded_at) = s.sleep_date
    WHERE s.user_id = ? AND s.source = 'whoop'
      AND (s.metadata_json IS NULL OR s.metadata_json NOT LIKE '%"nap":true%')
    GROUP BY bucket
    HAVING nights >= 3
    ORDER BY avg_recovery DESC
  `).all(userId, userId);

  if (sleepRecoveryCorr.length >= 2) {
    const best = sleepRecoveryCorr[0];
    const parts = sleepRecoveryCorr.map(b => `${b.bucket}: ${b.avg_recovery}% recovery (${b.nights} nights)`);
    insights.push({
      type: 'pattern',
      title: '🎯 Your Optimal Sleep Duration',
      body: `Your best recovery (${best.avg_recovery}%) happens in the ${best.bucket} range. ${parts.join('. ')}.`,
      detail: 'More sleep isn\'t always better — oversleeping can indicate poor sleep quality or excessive sleep need from high strain. Find your sweet spot.'
    });
  }

  // 12. SpO2 / Medication Impact
  const spo2Trend = db.prepare(`
    SELECT date(recorded_at) as d, value
    FROM metric_records
    WHERE user_id = ? AND source = 'whoop' AND metric_type = 'spo2'
    ORDER BY recorded_at DESC
    LIMIT 14
  `).all(userId);

  if (spo2Trend.length >= 5) {
    const recent7 = spo2Trend.slice(0, 7);
    const prior7 = spo2Trend.slice(7);
    const recentAvg = recent7.reduce((s, r) => s + r.value, 0) / recent7.length;
    const priorAvg = prior7.length > 0 ? prior7.reduce((s, r) => s + r.value, 0) / prior7.length : null;
    const lowDays = recent7.filter(r => r.value < 90).length;

    if (lowDays > 0) {
      insights.push({
        type: 'comparison',
        title: '🫁 Blood Oxygen Impact',
        body: `SpO2 was below 90% on ${lowDays} of the last 7 days (avg ${recentAvg.toFixed(1)}%).${priorAvg ? ` Previous 7 days averaged ${priorAvg.toFixed(1)}%.` : ''}`,
        detail: 'Low SpO2 significantly depresses WHOOP recovery scores. If medication-related, your actual recovery state may be better than WHOOP reports. Consider this when interpreting your recovery scores.',
        data: { recent_avg: Math.round(recentAvg * 10) / 10, prior_avg: priorAvg ? Math.round(priorAvg * 10) / 10 : null, low_days: lowDays }
      });
    }
  }

  return res.json({ overlap_period: { start: overlapStart, end: overlapEnd }, insights });
});

module.exports = router;
