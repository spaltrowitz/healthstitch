# River — History

## Project Context

- **Project:** HealthStitch — health data aggregation platform
- **Stack:** Node.js/Express, React/Vite, Swift/SwiftUI, SQLite
- **Owner:** Shari Paltrowitz
- **Description:** Stitches together wearable data from Apple Watch, WHOOP, and other devices into a unified dashboard with baselines, trends, and cross-device comparison.

## Learnings

### Data Layer Review (2025-01-30)

**Schema:** Single migration at `backend/src/migrations/001_init.sql`. Tables: users, whoop_tokens, apple_sync_state, metric_records, sleep_records, workout_records, derived_baselines. Well-indexed with dedupe and query indexes. Uses TEXT UUIDs as PKs.

**Ingestion pipeline:**
- Apple Watch: iOS companion (`ios-companion/`) → `POST /api/apple/ingest` → `ingestService.js` (batch insert with transactions)
- WHOOP: OAuth2 flow → `whoopService.js` paginated API fetch → same ingestService
- Both paths trigger `computeBaselines()` after ingestion

**Baseline service:** `baselineService.js` — computes rolling averages for Apple Watch only, stored in derived_baselines table. Defined metrics: hrv_sdnn (90d), resting_hr (30d), sleep_duration (90d).

**Dashboard routes:** `dashboardRoutes.js` serves morning-checkin, trends, device-comparison, workouts endpoints. Uses inline prepared statements (not pre-compiled at module level for the dashboard route queries).

**Key file paths:**
- Schema: `backend/src/migrations/001_init.sql`
- Ingest: `backend/src/services/ingestService.js`
- WHOOP sync: `backend/src/services/whoopService.js`
- WHOOP scheduler: `backend/src/services/whoop-scheduler.js`
- Baselines: `backend/src/services/baselineService.js`
- Dashboard API: `backend/src/routes/dashboardRoutes.js`
- Apple ingest route: `backend/src/routes/appleRoutes.js`
- iOS data source: `ios-companion/HealthSyncCompanion/HealthKitManager.swift`
- DB client: `backend/src/db/client.js` (better-sqlite3, WAL mode, FK enabled)
- Actual DB: `data/health_dashboard.sqlite`

### WHOOP Continuous Sync Implementation (Phase 1)

**What was built:**
- Migration `003_whoop_sync_state.sql` — tracks per-user sync state with backoff fields
- `whoop-scheduler.js` — node-cron service, 30-min cycle, error-isolated per user, exponential backoff (1→2→4→8→…→30 min cap)
- `GET /api/whoop/sync-status` endpoint for frontend freshness display
- Wired into `server.js` with `WHOOP_AUTO_SYNC=false` kill switch

**Design notes:**
- `syncWhoopData()` already accepted a `since` parameter — no modification needed for delta sync
- `fetchPaginated()` passes `since` as WHOOP's `start` query param — this was already in place
- Pre-existing `002_whoop_token_unique.sql` migration fixed the UNIQUE constraint on `whoop_tokens.user_id`
- user_id is TEXT (UUID), not INTEGER — matched to existing schema
- Scheduler only starts after server listen callback to avoid racing migrations

### Performance Improvements (2025-07)

**Expression indexes added (migration 004):**
- `idx_metric_date_expr` on `metric_records(date(recorded_at))` — used by GROUP BY date queries in trends
- `idx_sleep_start_date_expr` on `sleep_records(date(start_at))` — morning check-in
- `idx_workout_start_date_expr` on `workout_records(date(start_at))` — workouts endpoint
- `idx_metric_user_source_date` composite on `metric_records(user_id, source, date(recorded_at))` — most common query pattern

**Pre-computed aggregates (migration 005 + aggregateService.js):**
- `training_load_aggregates` table stores weekly (Mon-Sun) and monthly rollups per user/source
- Workouts dashboard reads from aggregates instead of computing on the fly
- Incremental update via `updateAggregatesForWorkout()` called after each ingest
- `recomputeAll(userId)` available for full backfill

**Gap indicators in trends API:**
- Trends endpoint now fills missing dates with `{ date, has_data: false }` entries
- Frontend can distinguish "no data collected" from "value was zero"
- Uses `generateDateRange()` + `fillGaps()` helper functions

**Design notes:**
- Prepared statements in aggregateService and dashboardRoutes use lazy-init pattern to avoid racing migrations (since `app.js` is loaded before `migrate.js` in test scenarios)
- Aggregate upsert uses ON CONFLICT on `(user_id, period_type, period_start, source)` unique index
- ingestWorkoutBatch now tracks which dates were affected and recomputes only those periods
