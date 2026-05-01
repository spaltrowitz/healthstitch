const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function dayNumber(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
}

router.get('/status', requireAuth, async (req, res) => {
  const userId = req.user.userId;

  const { rows: activeRows } = await db.query(`
    SELECT id, reason, start_date, end_date, notes, created_at
    FROM recovery_periods
    WHERE user_id = $1 AND end_date IS NULL
    ORDER BY start_date DESC
    LIMIT 1
  `, [userId]);
  const active = activeRows[0] || null;

  const { rows: history } = await db.query(`
    SELECT id, reason, start_date, end_date, notes, created_at
    FROM recovery_periods
    WHERE user_id = $1
    ORDER BY start_date DESC
    LIMIT 20
  `, [userId]);

  return res.json({
    active: active ? {
      id: active.id,
      reason: active.reason,
      start_date: active.start_date,
      notes: active.notes,
      day_number: dayNumber(active.start_date)
    } : null,
    history
  });
});

router.post('/start', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const reason = String(req.body.reason || '').trim();
  const startDate = req.body.start_date || new Date().toISOString().slice(0, 10);
  const notes = req.body.notes || null;

  if (!reason) {
    return res.status(400).json({ error: 'Reason is required' });
  }

  const { rows: existingRows } = await db.query(`
    SELECT id, reason, start_date, end_date, notes, created_at
    FROM recovery_periods
    WHERE user_id = $1 AND end_date IS NULL
    ORDER BY start_date DESC
    LIMIT 1
  `, [userId]);

  if (existingRows.length > 0) {
    return res.status(409).json({ error: 'Recovery mode is already active', active: existingRows[0] });
  }

  const id = randomUUID();
  await db.query(`
    INSERT INTO recovery_periods (id, user_id, reason, start_date, notes)
    VALUES ($1, $2, $3, $4, $5)
  `, [id, userId, reason, startDate, notes]);

  return res.status(201).json({
    ok: true,
    recovery: { id, reason, start_date: startDate, notes, day_number: dayNumber(startDate) }
  });
});

router.post('/end', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const endDate = req.body.end_date || new Date().toISOString().slice(0, 10);

  const { rows: activeRows } = await db.query(`
    SELECT id, reason, start_date, end_date, notes, created_at
    FROM recovery_periods
    WHERE user_id = $1 AND end_date IS NULL
    ORDER BY start_date DESC
    LIMIT 1
  `, [userId]);

  const active = activeRows[0];
  if (!active) {
    return res.status(404).json({ error: 'No active recovery period' });
  }

  await db.query(`
    UPDATE recovery_periods
    SET end_date = $1
    WHERE user_id = $2 AND end_date IS NULL
  `, [endDate, userId]);

  return res.json({
    ok: true,
    recovery: { ...active, end_date: endDate }
  });
});

module.exports = router;
