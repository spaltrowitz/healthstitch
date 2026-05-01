const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const activeRecoveryStmt = db.prepare(`
  SELECT id, reason, start_date, end_date, notes, created_at
  FROM recovery_periods
  WHERE user_id = ? AND end_date IS NULL
  ORDER BY start_date DESC
  LIMIT 1
`);

const historyStmt = db.prepare(`
  SELECT id, reason, start_date, end_date, notes, created_at
  FROM recovery_periods
  WHERE user_id = ?
  ORDER BY start_date DESC
  LIMIT 20
`);

const insertStmt = db.prepare(`
  INSERT INTO recovery_periods (id, user_id, reason, start_date, notes)
  VALUES (?, ?, ?, ?, ?)
`);

const endStmt = db.prepare(`
  UPDATE recovery_periods
  SET end_date = ?
  WHERE user_id = ? AND end_date IS NULL
`);

function dayNumber(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
}

router.get('/status', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const active = activeRecoveryStmt.get(userId);
  const history = historyStmt.all(userId);

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

router.post('/start', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const reason = String(req.body.reason || '').trim();
  const startDate = req.body.start_date || new Date().toISOString().slice(0, 10);
  const notes = req.body.notes || null;

  if (!reason) {
    return res.status(400).json({ error: 'Reason is required' });
  }

  const existing = activeRecoveryStmt.get(userId);
  if (existing) {
    return res.status(409).json({ error: 'Recovery mode is already active', active: existing });
  }

  const id = randomUUID();
  insertStmt.run(id, userId, reason, startDate, notes);

  return res.status(201).json({
    ok: true,
    recovery: { id, reason, start_date: startDate, notes, day_number: dayNumber(startDate) }
  });
});

router.post('/end', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const endDate = req.body.end_date || new Date().toISOString().slice(0, 10);

  const active = activeRecoveryStmt.get(userId);
  if (!active) {
    return res.status(404).json({ error: 'No active recovery period' });
  }

  endStmt.run(endDate, userId);

  return res.json({
    ok: true,
    recovery: { ...active, end_date: endDate }
  });
});

module.exports = router;
