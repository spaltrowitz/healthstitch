const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { generateBriefing } = require('../services/morningBriefingService');
const { computeRecoveryScore } = require('../services/recoveryService');
const { scoreWorkout, getDailyExertion } = require('../services/exertionService');
const { getAllPriorities, setPriority } = require('../services/sourcePriorityService');
const db = require('../db/client');

const router = express.Router();

router.get('/daily/:date', requireAuth, async (req, res) => {
  try {
    const result = await computeRecoveryScore(req.user.id, req.params.date);
    res.json(result);
  } catch (err) {
    console.error('scores/daily error:', err);
    res.status(500).json({ error: 'Failed to compute daily scores' });
  }
});

router.get('/briefing', requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const briefing = await generateBriefing(req.user.id, date);
    res.json(briefing);
  } catch (err) {
    console.error('scores/briefing error:', err);
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});

router.get('/workout/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM computed_workout_scores WHERE workout_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      const result = await scoreWorkout(req.user.id, req.params.id);
      if (!result) return res.status(404).json({ error: 'Workout not found' });
      return res.json(result);
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('scores/workout error:', err);
    res.status(500).json({ error: 'Failed to get workout score' });
  }
});

router.get('/trends', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const { rows } = await db.query(`
      SELECT score_date, recovery_score, recovery_zone, exertion_score,
             sleep_need_ms, adjusted_sleep_need_ms, sleep_debt_ms,
             fatigue_reduction_ms, data_quality_json
      FROM computed_daily_scores
      WHERE user_id = $1
        AND score_date >= (CURRENT_DATE - ($2 || ' days')::INTERVAL)
      ORDER BY score_date
    `, [req.user.id, days]);
    res.json({ days, scores: rows });
  } catch (err) {
    console.error('scores/trends error:', err);
    res.status(500).json({ error: 'Failed to get score trends' });
  }
});

router.get('/source-priority', requireAuth, async (req, res) => {
  try {
    const priorities = await getAllPriorities(req.user.id);
    res.json(priorities);
  } catch (err) {
    console.error('source-priority get error:', err);
    res.status(500).json({ error: 'Failed to get source priorities' });
  }
});

router.post('/source-priority', requireAuth, async (req, res) => {
  try {
    const { metric_type, priority } = req.body;
    if (!metric_type || !Array.isArray(priority)) {
      return res.status(400).json({ error: 'metric_type (string) and priority (array) required' });
    }
    await setPriority(req.user.id, metric_type, priority);
    res.json({ ok: true, metric_type, priority });
  } catch (err) {
    console.error('source-priority set error:', err);
    res.status(500).json({ error: 'Failed to set source priority' });
  }
});

module.exports = router;
