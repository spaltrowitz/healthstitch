const express = require('express');
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { ingestMetricBatch, ingestSleepBatch, ingestWorkoutBatch } = require('../services/ingestService');
const { computeBaselines } = require('../services/baselineService');

const router = express.Router();

router.post('/ingest', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const metrics = Array.isArray(req.body.metrics) ? req.body.metrics : [];
  const sleepSessions = Array.isArray(req.body.sleep_sessions) ? req.body.sleep_sessions : [];
  const workouts = Array.isArray(req.body.workouts) ? req.body.workouts : [];
  const lastSyncAt = req.body.last_sync_at ? new Date(req.body.last_sync_at).toISOString() : new Date().toISOString();

  await ingestMetricBatch(userId, 'apple_watch', metrics);
  await ingestSleepBatch(userId, 'apple_watch', sleepSessions);
  await ingestWorkoutBatch(userId, 'apple_watch', workouts);

  const metricCounts = JSON.stringify({
    metrics: metrics.length,
    sleep_sessions: sleepSessions.length,
    workouts: workouts.length
  });

  await db.query(`
    INSERT INTO apple_sync_state (user_id, last_sync_at, last_sync_status, metric_counts_json)
    VALUES ($1, $2, 'success', $3)
    ON CONFLICT(user_id) DO UPDATE SET
      last_sync_at = EXCLUDED.last_sync_at,
      last_sync_status = 'success',
      metric_counts_json = EXCLUDED.metric_counts_json,
      consecutive_failures = 0,
      last_error = NULL,
      updated_at = NOW()
  `, [userId, lastSyncAt, metricCounts]);

  await computeBaselines(userId);

  return res.json({
    ok: true,
    ingested: {
      metrics: metrics.length,
      sleep_sessions: sleepSessions.length,
      workouts: workouts.length
    },
    last_sync_at: lastSyncAt
  });
});

router.get('/sync-status', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const { rows } = await db.query(`
    SELECT last_sync_at, last_sync_status, metric_counts_json, consecutive_failures, last_error, updated_at
    FROM apple_sync_state
    WHERE user_id = $1
  `, [userId]);

  const row = rows[0];
  if (!row) {
    return res.json({
      connected: false,
      last_sync_at: null,
      status: null,
      metric_counts: null,
      staleness_minutes: null
    });
  }

  const lastSyncAt = row.last_sync_at ? new Date(row.last_sync_at) : null;
  const stalenessMinutes = lastSyncAt
    ? Math.round((Date.now() - lastSyncAt.getTime()) / 60000)
    : null;

  return res.json({
    connected: true,
    last_sync_at: row.last_sync_at,
    status: row.last_sync_status,
    metric_counts: row.metric_counts_json ? JSON.parse(row.metric_counts_json) : null,
    staleness_minutes: stalenessMinutes,
    consecutive_failures: row.consecutive_failures,
    last_error: row.last_error
  });
});

module.exports = router;
