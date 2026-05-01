const cron = require('node-cron');
const db = require('../db/client');
const { syncWhoopData } = require('./whoopService');
const { computeBaselines } = require('./baselineService');

function computeBackoff(failures) {
  const minutes = Math.min(Math.pow(2, failures - 1), 30);
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function syncUserWithIsolation(user) {
  const now = new Date().toISOString();

  if (user.next_retry_at && new Date(user.next_retry_at) > new Date()) {
    return;
  }

  const since = user.last_sync_at || undefined;

  try {
    const counts = await syncWhoopData(user.user_id, since);
    await computeBaselines(user.user_id);

    await db.query(`
      INSERT INTO whoop_sync_state (user_id, last_sync_at, last_sync_status, last_error, consecutive_failures, next_retry_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(user_id)
      DO UPDATE SET
        last_sync_at = EXCLUDED.last_sync_at,
        last_sync_status = EXCLUDED.last_sync_status,
        last_error = EXCLUDED.last_error,
        consecutive_failures = EXCLUDED.consecutive_failures,
        next_retry_at = EXCLUDED.next_retry_at
    `, [user.user_id, now, 'success', null, 0, null]);

    console.log(`[whoop-sync] user=${user.user_id} success counts=${JSON.stringify(counts)}`);
  } catch (error) {
    const failures = (user.consecutive_failures || 0) + 1;
    const nextRetry = computeBackoff(failures);

    await db.query(`
      INSERT INTO whoop_sync_state (user_id, last_sync_at, last_sync_status, last_error, consecutive_failures, next_retry_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(user_id)
      DO UPDATE SET
        last_sync_at = EXCLUDED.last_sync_at,
        last_sync_status = EXCLUDED.last_sync_status,
        last_error = EXCLUDED.last_error,
        consecutive_failures = EXCLUDED.consecutive_failures,
        next_retry_at = EXCLUDED.next_retry_at
    `, [user.user_id, null, 'error', error.message, failures, nextRetry]);

    console.log(`[whoop-sync] user=${user.user_id} error="${error.message}" failures=${failures} retry_at=${nextRetry}`);
  }
}

async function runSyncCycle() {
  const { rows: users } = await db.query(`
    SELECT wt.user_id, ws.last_sync_at, ws.next_retry_at, ws.consecutive_failures
    FROM whoop_tokens wt
    LEFT JOIN whoop_sync_state ws ON ws.user_id = wt.user_id
  `);

  console.log(`[whoop-sync] Starting sync cycle for ${users.length} user(s)`);

  for (const user of users) {
    await syncUserWithIsolation(user);
  }

  console.log(`[whoop-sync] Cycle complete`);
}

let task = null;

function startScheduler() {
  if (task) return;
  task = cron.schedule('*/30 * * * *', () => {
    runSyncCycle().catch((err) => {
      console.error(`[whoop-sync] Unexpected cycle error: ${err.message}`);
    });
  });
  console.log('[whoop-sync] Scheduler started (every 30 minutes)');
}

function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
}

async function getSyncState(userId) {
  const { rows } = await db.query(
    'SELECT * FROM whoop_sync_state WHERE user_id = $1',
    [userId]
  );
  return rows[0] || null;
}

module.exports = { startScheduler, stopScheduler, runSyncCycle, getSyncState };
