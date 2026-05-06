const { randomUUID } = require('crypto');
const db = require('../db/client');

const DEFAULT_SLEEP_NEED_MS = 7.5 * 3600 * 1000; // 7h 30m
const MAX_DEBT_PENALTY_MS = 90 * 60 * 1000;       // 90 min cap
const DEBT_WINDOW_DAYS = 7;

const TIME_OF_DAY_MODIFIERS = [
  { startHour: 10, endHour: 12, modifier: 0.40 },
  { startHour: 12, endHour: 14, modifier: 0.50 },
  { startHour: 14, endHour: 16, modifier: 0.35 },
  { startHour: 16, endHour: 18, modifier: 0.20 },
  { startHour: 18, endHour: 24, modifier: 0.00 },
];

function getTimeOfDayModifier(startAt) {
  const hour = new Date(startAt).getHours();
  for (const range of TIME_OF_DAY_MODIFIERS) {
    if (hour >= range.startHour && hour < range.endHour) return range.modifier;
  }
  return 0;
}

function computeNapCredit(nap) {
  const deepMs = nap.deep_ms || 0;
  const remMs = nap.rem_ms || 0;
  const lightMs = nap.light_ms || 0;

  const stageCredit = (deepMs * 0.60) + (remMs * 0.05) + (lightMs * 0.35);
  const modifier = getTimeOfDayModifier(nap.start_at);

  return Math.round(stageCredit * modifier);
}

function isNap(sleepRecord) {
  const startHour = new Date(sleepRecord.start_at).getHours();
  const durationMs = sleepRecord.total_duration_ms || 0;
  const threeHoursMs = 3 * 3600 * 1000;
  return startHour >= 10 && startHour < 20 && durationMs < threeHoursMs && durationMs > 0;
}

async function detectAndStoreNaps(userId, date) {
  const { rows: sleeps } = await db.query(`
    SELECT * FROM sleep_records
    WHERE user_id = $1 AND sleep_date = $2::date
  `, [userId, date]);

  const naps = sleeps.filter(isNap);
  const stored = [];

  for (const nap of naps) {
    const creditMs = computeNapCredit(nap);
    const modifier = getTimeOfDayModifier(nap.start_at);

    await db.query(`
      INSERT INTO nap_records (id, user_id, source, nap_date, start_at, end_at, duration_ms, deep_ms, rem_ms, light_ms, credit_ms, credit_method, time_of_day_modifier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT(user_id, source, nap_date, start_at, end_at) DO UPDATE SET
        credit_ms = EXCLUDED.credit_ms,
        time_of_day_modifier = EXCLUDED.time_of_day_modifier
    `, [
      randomUUID(), userId, nap.source, date, nap.start_at, nap.end_at,
      nap.total_duration_ms, nap.slow_wave_ms, nap.rem_ms, nap.light_ms,
      creditMs, 'stage_weighted', modifier,
    ]);

    stored.push({ start_at: nap.start_at, duration_ms: nap.total_duration_ms, credit_ms: creditMs, modifier });
  }

  return stored;
}

async function getNighttimeSleep(userId, date) {
  const { rows } = await db.query(`
    SELECT * FROM sleep_records
    WHERE user_id = $1 AND sleep_date = $2::date
    ORDER BY total_duration_ms DESC
  `, [userId, date]);

  const nightSleeps = rows.filter(r => !isNap(r));
  if (nightSleeps.length === 0) return null;
  return nightSleeps[0];
}

async function computeSleepDebt(userId, date) {
  const { rows } = await db.query(`
    SELECT sleep_date, total_duration_ms FROM sleep_records
    WHERE user_id = $1
      AND sleep_date BETWEEN ($2::date - INTERVAL '${DEBT_WINDOW_DAYS} days') AND ($2::date - INTERVAL '1 day')
    ORDER BY sleep_date, total_duration_ms DESC
  `, [userId, date]);

  const byDate = {};
  for (const row of rows) {
    const d = row.sleep_date instanceof Date ? row.sleep_date.toISOString().slice(0, 10) : row.sleep_date;
    if (!byDate[d] || row.total_duration_ms > byDate[d]) {
      if (!isNapFromDuration(row.total_duration_ms)) {
        byDate[d] = row.total_duration_ms;
      }
    }
  }

  let debt = 0;
  for (let i = 1; i <= DEBT_WINDOW_DAYS; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const actual = byDate[dateStr] || 0;
    const deficit = DEFAULT_SLEEP_NEED_MS - actual;
    if (deficit > 0) debt += deficit;
  }

  return debt;
}

function isNapFromDuration(durationMs) {
  return durationMs < 3 * 3600 * 1000;
}

async function computeSleepNeed(userId, date) {
  const naps = await detectAndStoreNaps(userId, date);
  const totalNapCredit = naps.reduce((sum, n) => sum + n.credit_ms, 0);
  const debt = await computeSleepDebt(userId, date);

  const debtPenalty = Math.min(debt * 0.5, MAX_DEBT_PENALTY_MS);
  const baseNeed = DEFAULT_SLEEP_NEED_MS;
  const adjustedNeed = Math.max(baseNeed, baseNeed + debtPenalty - totalNapCredit);

  const nightSleep = await getNighttimeSleep(userId, date);

  return {
    base_need_ms: baseNeed,
    debt_ms: debt,
    debt_penalty_ms: Math.round(debtPenalty),
    nap_credit_ms: totalNapCredit,
    adjusted_need_ms: Math.round(adjustedNeed),
    naps,
    last_night: nightSleep ? {
      duration_ms: nightSleep.total_duration_ms,
      efficiency: nightSleep.sleep_efficiency,
      sws_ms: nightSleep.slow_wave_ms,
      rem_ms: nightSleep.rem_ms,
      source: nightSleep.source,
    } : null,
  };
}

module.exports = {
  computeNapCredit,
  isNap,
  detectAndStoreNaps,
  computeSleepNeed,
  getNighttimeSleep,
};
