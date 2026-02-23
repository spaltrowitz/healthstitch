const express = require('express');
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { ingestMetricBatch, ingestSleepBatch, ingestWorkoutBatch } = require('../services/ingestService');
const { computeBaselines } = require('../services/baselineService');

const router = express.Router();

const upsertSyncStmt = db.prepare(`
  INSERT INTO apple_sync_state (user_id, last_sync_at)
  VALUES (?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    last_sync_at = excluded.last_sync_at,
    updated_at = datetime('now')
`);

router.post('/ingest', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const metrics = Array.isArray(req.body.metrics) ? req.body.metrics : [];
  const sleepSessions = Array.isArray(req.body.sleep_sessions) ? req.body.sleep_sessions : [];
  const workouts = Array.isArray(req.body.workouts) ? req.body.workouts : [];
  const lastSyncAt = req.body.last_sync_at ? new Date(req.body.last_sync_at).toISOString() : new Date().toISOString();

  ingestMetricBatch(userId, 'apple_watch', metrics);
  ingestSleepBatch(userId, 'apple_watch', sleepSessions);
  ingestWorkoutBatch(userId, 'apple_watch', workouts);
  upsertSyncStmt.run(userId, lastSyncAt);
  computeBaselines(userId);

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

module.exports = router;
