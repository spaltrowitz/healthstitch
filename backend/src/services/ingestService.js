const { randomUUID } = require('crypto');
const db = require('../db/client');

const insertMetricStmt = db.prepare(`
  INSERT OR IGNORE INTO metric_records (
    id, user_id, source, metric_type, value, unit, recorded_at, external_id, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertSleepStmt = db.prepare(`
  INSERT OR IGNORE INTO sleep_records (
    id, user_id, source, sleep_date, start_at, end_at, total_duration_ms, slow_wave_ms,
    rem_ms, light_ms, awake_ms, sleep_performance, sleep_need_ms, sleep_consistency,
    sleep_efficiency, respiratory_rate, disturbance_count, external_id, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertWorkoutStmt = db.prepare(`
  INSERT OR IGNORE INTO workout_records (
    id, user_id, source, sport_type, start_at, end_at, duration_ms, avg_hr, max_hr,
    strain, energy_kj, energy_kcal, distance_m, hr_zone_json, external_id, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toSleepDate(startIso, endIso) {
  // Normalize to "night of" — the date when the user went to bed.
  // Use start_at date so both sources align on the same night.
  if (startIso) return startIso.slice(0, 10);
  return (endIso || '').slice(0, 10);
}

function ingestMetricBatch(userId, source, records = []) {
  const tx = db.transaction((items) => {
    for (const item of items) {
      const recordedAt = toIso(item.recorded_at || item.timestamp || item.date);
      const numericValue = Number(item.value);
      if (!recordedAt || Number.isNaN(numericValue) || !item.metric_type || !item.unit) continue;

      insertMetricStmt.run(
        randomUUID(),
        userId,
        source,
        item.metric_type,
        numericValue,
        item.unit,
        recordedAt,
        item.external_id || null,
        item.metadata ? JSON.stringify(item.metadata) : null
      );
    }
  });

  tx(records);
}

function ingestSleepBatch(userId, source, sleeps = []) {
  const tx = db.transaction((items) => {
    for (const item of items) {
      const startAt = toIso(item.start_at || item.start);
      const endAt = toIso(item.end_at || item.end);
      const totalDuration = Number(item.total_duration_ms);
      if (!startAt || !endAt || Number.isNaN(totalDuration)) continue;

      const sleepDate = item.sleep_date || toSleepDate(startAt, endAt);

      insertSleepStmt.run(
        randomUUID(),
        userId,
        source,
        sleepDate,
        startAt,
        endAt,
        totalDuration,
        item.slow_wave_ms ?? null,
        item.rem_ms ?? null,
        item.light_ms ?? null,
        item.awake_ms ?? null,
        item.sleep_performance ?? null,
        item.sleep_need_ms ?? null,
        item.sleep_consistency ?? null,
        item.sleep_efficiency ?? null,
        item.respiratory_rate ?? null,
        item.disturbance_count ?? null,
        item.external_id || null,
        item.metadata ? JSON.stringify(item.metadata) : null
      );

      if (source === 'apple_watch') {
        insertMetricStmt.run(
          randomUUID(),
          userId,
          source,
          'sleep_duration',
          totalDuration,
          'ms',
          endAt,
          item.external_id ? `${item.external_id}:duration` : null,
          null
        );
      }

      if (source === 'whoop') {
        insertMetricStmt.run(
          randomUUID(),
          userId,
          source,
          'sleep_duration',
          totalDuration,
          'ms',
          endAt,
          item.external_id ? `${item.external_id}:duration` : null,
          null
        );
      }
    }
  });

  tx(sleeps);
}

function ingestWorkoutBatch(userId, source, workouts = []) {
  const tx = db.transaction((items) => {
    for (const item of items) {
      const startAt = toIso(item.start_at || item.start);
      const endAt = toIso(item.end_at || item.end);
      const duration = Number(item.duration_ms);
      if (!startAt || !endAt || Number.isNaN(duration) || !item.sport_type) continue;

      insertWorkoutStmt.run(
        randomUUID(),
        userId,
        source,
        item.sport_type,
        startAt,
        endAt,
        duration,
        item.avg_hr ?? null,
        item.max_hr ?? null,
        item.strain ?? null,
        item.energy_kj ?? null,
        item.energy_kcal ?? null,
        item.distance_m ?? null,
        item.hr_zones ? JSON.stringify(item.hr_zones) : null,
        item.external_id || null,
        item.metadata ? JSON.stringify(item.metadata) : null
      );
    }
  });

  tx(workouts);
}

module.exports = {
  ingestMetricBatch,
  ingestSleepBatch,
  ingestWorkoutBatch
};
