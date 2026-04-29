# Project Context

- **Owner:** Shari Paltrowitz
- **Project:** HealthStitch — health data aggregation platform stitching together wearable data from Apple Watch, WHOOP, and other devices
- **Stack:** Node.js/Express backend, React/Vite frontend, Swift/SwiftUI iOS companion, SQLite database
- **Created:** 2026-04-27

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-07-15 — Continuous Sync Architecture Review

**WHOOP sync path:**
- `backend/src/services/whoopService.js` — OAuth2, token refresh (already working), paginated fetch, data mapping
- `backend/src/routes/whoopRoutes.js` — `/connect`, `/callback`, `/sync` (manual trigger only)
- Token refresh is implemented in `getValidAccessToken()` with 60s buffer before expiry
- `syncWhoopData(userId, since)` already supports delta sync via `since` param
- No scheduled job exists — sync is user-triggered only
- No `whoop_sync_state` table (unlike Apple which has `apple_sync_state`)

**Apple Watch sync path:**
- `ios-companion/HealthSyncCompanion/` — SwiftUI app, foreground-only manual sync
- `HealthKitManager.swift` — queries HRV, resting HR, active energy, VO2max, respiratory rate, sleep, workouts
- `SyncService.swift` — chunked upload to `POST /api/apple/ingest`
- `backend/src/routes/appleRoutes.js` — receives batches, ingests, updates `apple_sync_state`
- No background delivery, no observer queries, no BGTaskScheduler
- JWT stored in UserDefaults (`@AppStorage`) — should be Keychain for background access

**Deduplication strategy:**
- `INSERT OR IGNORE` with unique indexes on (user_id, source, external_id) and date-range combos
- Both sources provide stable external IDs (WHOOP `id`, HealthKit `uuid`)

**Key architectural decision:**
- WHOOP = backend-pull model (server fetches from WHOOP API)
- Apple Watch = iOS-push model (iOS app pushes to our backend)
- These are fundamentally different and both need separate continuous sync strategies
