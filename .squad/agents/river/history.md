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
- Baselines: `backend/src/services/baselineService.js`
- Dashboard API: `backend/src/routes/dashboardRoutes.js`
- Apple ingest route: `backend/src/routes/appleRoutes.js`
- iOS data source: `ios-companion/HealthSyncCompanion/HealthKitManager.swift`
- DB client: `backend/src/db/client.js` (better-sqlite3, WAL mode, FK enabled)
- Actual DB: `data/health_dashboard.sqlite`
