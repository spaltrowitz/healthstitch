const axios = require('axios');
const { randomUUID } = require('crypto');
const db = require('../db/client');
const { WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, WHOOP_REDIRECT_URI } = require('../config');
const { ingestMetricBatch, ingestSleepBatch, ingestWorkoutBatch } = require('./ingestService');

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';

const tokenUpsertStmt = db.prepare(`
  INSERT INTO whoop_tokens (id, user_id, access_token, refresh_token, expires_at, scope)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id)
  DO UPDATE SET
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at,
    scope = excluded.scope,
    updated_at = datetime('now')
`);

const tokenByUserStmt = db.prepare(`
  SELECT user_id, access_token, refresh_token, expires_at
  FROM whoop_tokens
  WHERE user_id = ?
`);

function getWhoopAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID,
    redirect_uri: WHOOP_REDIRECT_URI,
    response_type: 'code',
    scope: 'offline read:recovery read:sleep read:cycles read:workout',
    state
  });

  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

function toIso(dateLike) {
  if (!dateLike) return null;
  const date = new Date(dateLike);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parsePagedRecords(payload) {
  if (Array.isArray(payload)) return { records: payload, nextToken: null };
  const records = payload?.records || payload?.data || [];
  const nextToken = payload?.next_token || payload?.nextToken || payload?.next_page_token || null;
  return { records, nextToken };
}

async function fetchPaginated(accessToken, path, since) {
  const all = [];
  let nextToken = null;

  do {
    const params = new URLSearchParams({ limit: '25' });
    if (since) params.set('start', since);
    if (nextToken) params.set('nextToken', nextToken);

    const response = await axios.get(`${WHOOP_API_BASE}${path}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const parsed = parsePagedRecords(response.data);
    all.push(...parsed.records);
    nextToken = parsed.nextToken;
  } while (nextToken);

  return all;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: WHOOP_REDIRECT_URI,
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET
  });

  const response = await axios.post(WHOOP_TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET
  });

  const response = await axios.post(WHOOP_TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data;
}

function persistToken(userId, tokenData) {
  const expiresAt = new Date(Date.now() + Number(tokenData.expires_in || 0) * 1000).toISOString();

  tokenUpsertStmt.run(
    randomUUID(),
    userId,
    tokenData.access_token,
    tokenData.refresh_token,
    expiresAt,
    tokenData.scope || null
  );
}

async function getValidAccessToken(userId) {
  const token = tokenByUserStmt.get(userId);
  if (!token) throw new Error('WHOOP account not connected');

  const expiresAtMs = new Date(token.expires_at).getTime();
  if (Number.isNaN(expiresAtMs) || expiresAtMs > Date.now() + 60_000) {
    return token.access_token;
  }

  const refreshed = await refreshAccessToken(token.refresh_token);
  persistToken(userId, refreshed);
  return refreshed.access_token;
}

function mapWhoopRecovery(records) {
  return records
    .map((item) => {
      const score = item.score || {};
      const recordedAt = toIso(item.created_at || item.updated_at || item.score_state?.created_at);
      if (!recordedAt) return null;

      return [
        {
          metric_type: 'recovery_score',
          value: Number(score.recovery_score ?? item.recovery_score),
          unit: 'percent',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:recovery` : null,
          metadata: item
        },
        {
          metric_type: 'hrv_rmssd',
          value: Number(score.hrv_rmssd_milli ?? score.hrv_rmssd ?? item.hrv_rmssd_milli),
          unit: 'ms',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:hrv` : null
        },
        {
          metric_type: 'resting_hr',
          value: Number(score.resting_heart_rate ?? item.resting_heart_rate),
          unit: 'bpm',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:rhr` : null
        },
        {
          metric_type: 'skin_temp_deviation',
          value: Number(score.skin_temp_celsius ?? item.skin_temp_celsius),
          unit: 'celsius',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:skin_temp` : null
        },
        {
          metric_type: 'spo2',
          value: Number(score.spo2_percentage ?? item.spo2_percentage),
          unit: 'percent',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:spo2` : null
        },
        {
          metric_type: 'respiratory_rate',
          value: Number(score.respiratory_rate ?? item.respiratory_rate),
          unit: 'breaths_per_min',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:resp` : null
        }
      ].filter((r) => Number.isFinite(r.value));
    })
    .flat();
}

function mapWhoopSleep(records) {
  return records
    .map((item) => {
      const score = item.score || {};
      const stage = score.stage_summary || item.stage_summary || {};
      const startAt = toIso(item.start || item.start_time || item.created_at);
      const endAt = toIso(item.end || item.end_time || item.updated_at);
      const totalDuration = Number(score.total_in_bed_time_milli ?? item.total_in_bed_time_milli);

      if (!startAt || !endAt || !Number.isFinite(totalDuration)) return null;

      const sleepDate = endAt.slice(0, 10);
      return {
        sleep_date: sleepDate,
        start_at: startAt,
        end_at: endAt,
        total_duration_ms: totalDuration,
        slow_wave_ms: Number(stage.slow_wave_sleep_time_milli ?? item.slow_wave_sleep_time_milli) || null,
        rem_ms: Number(stage.rem_sleep_time_milli ?? item.rem_sleep_time_milli) || null,
        light_ms: Number(stage.light_sleep_time_milli ?? item.light_sleep_time_milli) || null,
        awake_ms: Number(stage.awake_time_milli ?? item.awake_time_milli) || null,
        sleep_performance: Number(score.sleep_performance_percentage ?? item.sleep_performance_percentage) || null,
        sleep_need_ms: Number(score.sleep_needed?.need_from_sleep_debt_milli ?? 0)
          + Number(score.sleep_needed?.need_from_strain_milli ?? 0)
          + Number(score.sleep_needed?.baseline_milli ?? item.sleep_need_milli ?? 0),
        sleep_consistency: Number(score.sleep_consistency_percentage ?? item.sleep_consistency_percentage) || null,
        sleep_efficiency: Number(score.sleep_efficiency_percentage ?? item.sleep_efficiency_percentage) || null,
        respiratory_rate: Number(score.respiratory_rate ?? item.respiratory_rate) || null,
        disturbance_count: Number(score.disturbance_count ?? item.disturbance_count) || null,
        external_id: item.id || null,
        metadata: item
      };
    })
    .filter(Boolean);
}

function mapWhoopStrain(records) {
  return records
    .map((item) => {
      const score = item.score || {};
      const recordedAt = toIso(item.created_at || item.updated_at || item.start);
      if (!recordedAt) return null;

      return [
        {
          metric_type: 'daily_strain',
          value: Number(score.strain ?? item.strain),
          unit: 'score',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:strain` : null,
          metadata: item
        },
        {
          metric_type: 'max_hr',
          value: Number(score.max_heart_rate ?? item.max_heart_rate),
          unit: 'bpm',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:max_hr` : null
        },
        {
          metric_type: 'avg_hr',
          value: Number(score.average_heart_rate ?? item.average_heart_rate),
          unit: 'bpm',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:avg_hr` : null
        },
        {
          metric_type: 'energy_kj',
          value: Number(score.kilojoule ?? item.kilojoule),
          unit: 'kj',
          recorded_at: recordedAt,
          external_id: item.id ? `${item.id}:kj` : null
        }
      ].filter((r) => Number.isFinite(r.value));
    })
    .flat();
}

function mapWhoopWorkouts(records) {
  return records
    .map((item) => {
      const startAt = toIso(item.start || item.start_time);
      const endAt = toIso(item.end || item.end_time);
      const durationMs = Number(item.duration_milli ?? item.duration_ms);
      if (!startAt || !endAt || !Number.isFinite(durationMs)) return null;

      return {
        sport_type: item.sport_name || item.sport_type || 'Workout',
        start_at: startAt,
        end_at: endAt,
        duration_ms: durationMs,
        avg_hr: Number(item.average_heart_rate) || null,
        max_hr: Number(item.max_heart_rate) || null,
        strain: Number(item.score?.strain ?? item.strain) || null,
        energy_kj: Number(item.score?.kilojoule ?? item.kilojoule) || null,
        energy_kcal: Number(item.score?.kilojoule ?? item.kilojoule) ? Number(item.score?.kilojoule ?? item.kilojoule) * 0.239006 : null,
        distance_m: Number(item.distance_meter ?? item.distance_m) || null,
        hr_zones: item.score?.zone_duration || item.zone_duration || null,
        external_id: item.id || null,
        metadata: item
      };
    })
    .filter(Boolean);
}

async function syncWhoopData(userId, since) {
  const accessToken = await getValidAccessToken(userId);

  const [recovery, sleep, strain, workouts] = await Promise.all([
    fetchPaginated(accessToken, '/recovery', since),
    fetchPaginated(accessToken, '/activity/sleep', since),
    fetchPaginated(accessToken, '/activity/cycle', since),
    fetchPaginated(accessToken, '/activity/workout', since)
  ]);

  ingestMetricBatch(userId, 'whoop', mapWhoopRecovery(recovery));
  ingestSleepBatch(userId, 'whoop', mapWhoopSleep(sleep));
  ingestMetricBatch(userId, 'whoop', mapWhoopStrain(strain));
  ingestWorkoutBatch(userId, 'whoop', mapWhoopWorkouts(workouts));

  return {
    recovery: recovery.length,
    sleep: sleep.length,
    strain: strain.length,
    workouts: workouts.length
  };
}

module.exports = {
  getWhoopAuthUrl,
  exchangeCodeForToken,
  persistToken,
  syncWhoopData
};
