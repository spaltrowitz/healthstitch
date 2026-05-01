const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const db = require('../db/client');
const { JWT_SECRET } = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) are required' });
  }

  const { rows: existing } = await db.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const hash = await bcrypt.hash(password, 10);
  const userId = randomUUID();
  await db.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [userId, email, hash]);

  const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ token, user: { id: userId, email } });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const { rows } = await db.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, user: { id: user.id, email: user.email } });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT id, email FROM users WHERE id = $1', [req.user.userId]);
  const user = rows[0];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user });
});

module.exports = router;
