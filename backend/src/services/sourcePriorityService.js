const { randomUUID } = require('crypto');
const db = require('../db/client');

const DEFAULT_PRIORITIES = {
  sleep:          ['oura', 'whoop', 'garmin', 'apple_watch'],
  hrv:            ['whoop', 'oura', 'garmin', 'apple_watch'],
  resting_hr:     ['whoop', 'oura', 'garmin', 'apple_watch'],
  workout_hr:     ['garmin', 'apple_watch', 'whoop', 'oura'],
  gps_distance:   ['garmin', 'apple_watch'],
  steps:          ['garmin', 'apple_watch', 'oura'],
  spo2:           ['oura', 'whoop', 'garmin', 'apple_watch'],
  skin_temp:      ['oura', 'whoop', 'apple_watch', 'garmin'],
  stress:         ['garmin', 'oura', 'whoop'],
  ecg:            ['apple_watch'],
  respiratory:    ['oura', 'whoop', 'garmin', 'apple_watch'],
};

const DATA_QUALITY_RULES = {
  workout_hr: {
    apple_watch: (workout) => {
      const strength = ['strength_training', 'functional_fitness', 'traditional_strength_training'];
      if (strength.includes(workout?.sport_type)) {
        return { quality: 'degraded', reason: 'HR-based scoring underestimates non-cardiovascular exertion during strength training' };
      }
      return { quality: 'reliable', reason: null };
    },
    whoop: (workout) => {
      const strength = ['strength_training', 'functional_fitness', 'traditional_strength_training'];
      if (strength.includes(workout?.sport_type)) {
        return { quality: 'degraded', reason: 'PPG HR dropout during Valsalva maneuver (heavy lifting)' };
      }
      return { quality: 'reliable', reason: null };
    },
  },
  hrv: {
    apple_watch: () => ({ quality: 'reliable', reason: 'Uses SDNN method (not RMSSD). Correlated but not interchangeable.' }),
  },
  sleep: {
    apple_watch: () => ({ quality: 'reliable', reason: 'Deep sleep may be underestimated by ~43 min vs clinical PSG (Robbins et al.)' }),
  },
};

async function getPriority(userId, metricType) {
  const { rows } = await db.query(
    'SELECT priority_json FROM source_priority WHERE user_id = $1 AND metric_type = $2',
    [userId, metricType]
  );
  if (rows.length > 0) {
    return JSON.parse(rows[0].priority_json);
  }
  return DEFAULT_PRIORITIES[metricType] || [];
}

async function setPriority(userId, metricType, priorityArray) {
  await db.query(`
    INSERT INTO source_priority (id, user_id, metric_type, priority_json, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT(user_id, metric_type)
    DO UPDATE SET priority_json = EXCLUDED.priority_json, updated_at = NOW()
  `, [randomUUID(), userId, metricType, JSON.stringify(priorityArray)]);
}

async function getAllPriorities(userId) {
  const { rows } = await db.query(
    'SELECT metric_type, priority_json FROM source_priority WHERE user_id = $1',
    [userId]
  );
  const overrides = {};
  for (const row of rows) {
    overrides[row.metric_type] = JSON.parse(row.priority_json);
  }
  const result = {};
  for (const key of Object.keys(DEFAULT_PRIORITIES)) {
    result[key] = overrides[key] || DEFAULT_PRIORITIES[key];
  }
  return result;
}

function getDataQuality(metricType, source, context) {
  const rules = DATA_QUALITY_RULES[metricType];
  if (!rules) return { quality: 'reliable', reason: null };
  const rule = rules[source];
  if (!rule) return { quality: 'reliable', reason: null };
  return rule(context);
}

async function pickBestSource(userId, metricType, availableSources, context) {
  const priority = await getPriority(userId, metricType);
  for (const source of priority) {
    if (availableSources.includes(source)) {
      const quality = getDataQuality(metricType, source, context);
      return { source, quality, available_sources: availableSources };
    }
  }
  if (availableSources.length > 0) {
    const fallback = availableSources[0];
    return { source: fallback, quality: getDataQuality(metricType, fallback, context), available_sources: availableSources };
  }
  return { source: null, quality: { quality: 'no_data', reason: 'No sources available' }, available_sources: [] };
}

module.exports = {
  DEFAULT_PRIORITIES,
  getPriority,
  setPriority,
  getAllPriorities,
  getDataQuality,
  pickBestSource,
};
