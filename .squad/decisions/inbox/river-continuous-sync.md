## WHOOP Continuous Sync — Phase 1 Complete

**Date:** 2025-07
**By:** River (Data Engineer)

**What:** Implemented scheduled WHOOP data sync with per-user error isolation and exponential backoff.

**Files added/modified:**
- `backend/src/migrations/003_whoop_sync_state.sql` (new table)
- `backend/src/services/whoop-scheduler.js` (new service)
- `backend/src/routes/whoopRoutes.js` (added sync-status endpoint)
- `backend/src/server.js` (wired scheduler startup)
- `backend/package.json` (added node-cron)

**Key decisions:**
1. Delta sync was already supported — `syncWhoopData(userId, since)` and `fetchPaginated()` accepted `since` param out of the box. No modification to existing sync logic needed.
2. Backoff cap at 30 minutes matches the cron interval — a failing user won't be retried faster than once per cycle.
3. Scheduler starts inside the `listen` callback to guarantee migrations have run before prepared statements execute.
4. `WHOOP_AUTO_SYNC=false` env var disables the cron entirely (useful for dev/test).

**Open items for future phases:**
- Webhook upgrade when deployed to HTTPS (eliminates polling)
- Monitoring/alerting on consecutive_failures > N
- Rate limiting awareness (WHOOP API throttle headers)
