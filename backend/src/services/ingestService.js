const { randomUUID } = require('crypto');
const db = require('../db/client');
const { updateAggregatesForWorkout } = require('./aggregateService');

async function ingestMetricBatch(userId, source, records = []) {
  if (records.length === 0) return;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const item of records) {
      const recordedAt = toIso(item.recorded_at || item.timestamp || item.date);
      const numericValue = Number(item.value);
      if (!recordedAt || Number.isNaN(numericValue) || !item.metric_type || !item.unit) continue;

      await client.query(`
        INSERT INTO metric_records (
          id, user_id, source, metric_type, value, unit, recorded_at, external_id, metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `, [
        randomUUID(),
        userId,
        source,
        item.metric_type,
        numericValue,
        item.unit,
        recordedAt,
        item.external_id || null,
        item.metadata ? JSON.stringify(item.metadata) : null
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function ingestSleepBatch(userId, source, sleeps = []) {
  if (sleeps.length === 0) return;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const item of sleeps) {
      const startAt = toIso(item.start_at || item.start);
      const endAt = toIso(item.end_at || item.end);
      const totalDuration = Number(item.total_duration_ms);
      if (!startAt || !endAt || Number.isNaN(totalDuration)) continue;

      const sleepDate = item.sleep_date || toSleepDate(startAt, endAt);

      await client.query(`
        INSERT INTO sleep_records (
          id, user_id, source, sleep_date, start_at, end_at, total_duration_ms, slow_wave_ms,
          rem_ms, light_ms, awake_ms, sleep_performance, sleep_need_ms, sleep_consistency,
          sleep_efficiency, respiratory_rate, disturbance_count, external_id, metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT DO NOTHING
      `, [
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
      ]);

      if (source === 'apple_watch' || source === 'whoop') {
        await client.query(`
          INSERT INTO metric_records (
            id, user_id, source, metric_type, value, unit, recorded_at, external_id, metadata_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING
        `, [
          randomUUID(),
          userId,
          source,
          'sleep_duration',
          totalDuration,
          'ms',
          endAt,
          item.external_id ? `${item.external_id}:duration` : null,
          null
        ]);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function ingestWorkoutBatch(userId, source, workouts = []) {
  if (workouts.length === 0) return;

  const insertedStartAts = [];

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const item of workouts) {
      const startAt = toIso(item.start_at || item.start);
      const endAt = toIso(item.end_at || item.end);
      const duration = Number(item.duration_ms);
      if (!startAt || !endAt || Number.isNaN(duration) || !item.sport_type) continue;

      const result = await client.query(`
        INSERT INTO workout_records (
          id, user_id, source, sport_type, start_at, end_at, duration_ms, avg_hr, max_hr,
          strain, energy_kj, energy_kcal, distance_m, hr_zone_json, external_id, metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT DO NOTHING
      `, [
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
      ]);
      if (result.rowCount > 0) insertedStartAts.push(startAt);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const seen = new Set();
  for (const startAt of insertedStartAts) {
    const dateKey = startAt.slice(0, 10);
    if (seen.has(dateKey)) continue;
    seen.add(dateKey);
    await updateAggregatesForWorkout(userId, startAt);
  }
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toSleepDate(startIso, endIso) {
  if (startIso) return startIso.slice(0, 10);
  return (endIso || '').slice(0, 10);
}

module.exports = {
  ingestMetricBatch,
  ingestSleepBatch,
  ingestWorkoutBatch
};
