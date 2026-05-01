const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, FRONTEND_URL } = require('../config');
const { requireAuth } = require('../middleware/auth');
const { getWhoopAuthUrl, exchangeCodeForToken, persistToken, syncWhoopData } = require('../services/whoopService');
const { computeBaselines } = require('../services/baselineService');
const { getSyncState } = require('../services/whoop-scheduler');

const router = express.Router();

router.get('/connect', requireAuth, (req, res) => {
  const state = jwt.sign({ userId: req.user.userId }, JWT_SECRET, { expiresIn: '10m' });
  const authUrl = getWhoopAuthUrl(state);
  return res.json({ auth_url: authUrl });
});

router.get('/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');

  if (!code || !state) {
    return res.status(400).send('Missing WHOOP callback code/state');
  }

  try {
    const parsed = jwt.verify(state, JWT_SECRET);
    const tokenData = await exchangeCodeForToken(code);
    await persistToken(parsed.userId, tokenData);
    await syncWhoopData(parsed.userId);
    await computeBaselines(parsed.userId);

    return res.send(`WHOOP connected. You can close this window and return to ${FRONTEND_URL}.`);
  } catch (error) {
    return res.status(500).send(`WHOOP OAuth failed: ${error.message}`);
  }
});

router.post('/sync', requireAuth, async (req, res) => {
  const since = req.body.since ? new Date(req.body.since).toISOString() : undefined;

  try {
    const counts = await syncWhoopData(req.user.userId, since);
    await computeBaselines(req.user.userId);
    return res.json({ ok: true, counts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/sync-status', requireAuth, async (req, res) => {
  const state = await getSyncState(req.user.userId);
  if (!state) {
    return res.json({ synced: false, message: 'No sync history yet' });
  }
  return res.json({
    synced: true,
    last_sync_at: state.last_sync_at,
    last_sync_status: state.last_sync_status,
    last_error: state.last_error,
    consecutive_failures: state.consecutive_failures,
    next_retry_at: state.next_retry_at
  });
});

module.exports = router;
