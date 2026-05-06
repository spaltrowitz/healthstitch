const { computeRecoveryScore } = require('./recoveryService');
const db = require('../db/client');

function msToHoursMin(ms) {
  if (!ms) return '0h 0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.round((ms % 3600000) / 60000);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function intensityRecommendation(recovery) {
  if (!recovery?.score) return { intensity: 'unknown', message: 'Insufficient data for a recommendation. Wear your device overnight for recovery tracking.' };
  if (recovery.score >= 67) return { intensity: 'high', message: 'Recovery is green. You\'re ready for high intensity today.' };
  if (recovery.score >= 50) return { intensity: 'moderate', message: 'Recovery is yellow. Moderate intensity recommended today.' };
  if (recovery.score >= 34) return { intensity: 'light', message: 'Recovery is yellow-low. Light activity or active recovery today.' };
  return { intensity: 'rest', message: 'Recovery is red. Rest or very light activity today. Prioritize sleep tonight.' };
}

function buildSleepMessage(sleepNeed) {
  const parts = [];

  if (sleepNeed.last_night) {
    const dur = msToHoursMin(sleepNeed.last_night.duration_ms);
    const eff = sleepNeed.last_night.efficiency != null
      ? ` (${Math.round(sleepNeed.last_night.efficiency)}% efficiency)`
      : '';
    parts.push(`You slept ${dur} last night${eff}.`);
  } else {
    parts.push('No sleep data recorded last night.');
  }

  const need = msToHoursMin(sleepNeed.adjusted_need_ms);
  parts.push(`You need ${need} tonight.`);

  if (sleepNeed.nap_credit_ms > 0) {
    const credit = Math.round(sleepNeed.nap_credit_ms / 60000);
    parts.push(`Your nap reduced fatigue by ${credit} minutes, but your circadian minimum remains ${msToHoursMin(sleepNeed.base_need_ms)}.`);
  }

  if (sleepNeed.debt_ms > 60 * 60 * 1000) {
    const debtMin = Math.round(sleepNeed.debt_ms / 60000);
    parts.push(`You have ${debtMin} minutes of accumulated sleep debt this week.`);
  }

  return parts.join(' ');
}

async function getWeekExertion(userId, date) {
  const { rows } = await db.query(`
    SELECT exertion_score FROM computed_daily_scores
    WHERE user_id = $1
      AND score_date BETWEEN ($2::date - INTERVAL '6 days') AND $2::date
      AND exertion_score IS NOT NULL
  `, [userId, date]);

  const scores = rows.map(r => r.exertion_score);
  const total = scores.reduce((a, b) => a + b, 0);
  const avg = scores.length > 0 ? Math.round(total / scores.length) : 0;
  return { week_total: Math.round(total), week_avg: avg, days: scores.length };
}

async function generateBriefing(userId, date) {
  const result = await computeRecoveryScore(userId, date);
  const weekExertion = await getWeekExertion(userId, date);

  const recommendation = intensityRecommendation(result.recovery);
  const sleepMessage = buildSleepMessage(result.sleep_need);

  if (result.sleep_need.debt_ms > 2 * 3600 * 1000 && result.recovery.zone !== 'red') {
    recommendation.message += ' Focus on sleep tonight — you have significant accumulated debt.';
  }

  return {
    date,
    recovery: {
      score: result.recovery.score,
      zone: result.recovery.zone,
      inputs: result.recovery.inputs,
      confidence: result.recovery.confidence,
      flags: result.recovery.flags,
    },
    exertion: {
      yesterday: result.exertion.daily_exertion,
      week_total: weekExertion.week_total,
      week_avg: weekExertion.week_avg,
    },
    sleep: {
      last_night: result.sleep_need.last_night,
      tonight_need_ms: result.sleep_need.adjusted_need_ms,
      sleep_debt_ms: result.sleep_need.debt_ms,
      nap_credit_ms: result.sleep_need.nap_credit_ms,
      naps: result.sleep_need.naps,
      message: sleepMessage,
    },
    recommendation,
    data_quality: {
      overall: result.recovery.confidence,
      flags: result.recovery.flags,
    },
  };
}

module.exports = { generateBriefing };
