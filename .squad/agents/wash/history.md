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

### 2026-04-29 — Cross-Team Updates

📌 **Team update (2026-04-29T23:04:00Z):** River's data layer review identified critical HRV metric mismatch (WHOOP RMSSD ≠ Apple SDNN). Backend HRV comparison logic needs fixing. Also: baselines computed only for Apple Watch; WHOOP-only users get null deltas. Will affect sync implementation priorities. — River

📌 **Team update (2026-04-29T23:04:00Z):** Scoped phased continuous sync: Phase 1 (WHOOP scheduled polling, 1–2 days) highest ROI; Phase 2 (Apple Watch background delivery, 3–4 days) requires physical device testing. Data freshness improves from manual sync to ~30–60 min staleness. — Wash

### 2026-04-30 — Data Layer Bug Fixes (River's findings)

**Fixed 6 bugs from River's data review:**

1. **HRV apples-to-oranges (CRITICAL):** Morning check-in now maintains separate baselines per source/metric. WHOOP RMSSD compares against WHOOP RMSSD baseline; Apple SDNN against Apple SDNN baseline. API response restructured to `hrv.whoop` and `hrv.apple_watch` sub-objects.

2. **WHOOP baselines missing (CRITICAL):** `baselineService.js` now computes baselines for both sources. Added `hrv_rmssd`, `resting_hr`, and `sleep_duration` definitions for WHOOP. Also emit `sleep_duration` metric records during WHOOP sleep ingest.

3. **WHOOP token upsert broken:** Added migration `002_whoop_token_unique.sql` — recreates whoop_tokens with UNIQUE on user_id. Keeps only the most recent token per user.

4. **Sleep date inconsistency:** Normalized `sleep_date` to always use start_at date (the "night of" — when the user went to bed). Both Apple and WHOOP now use the same convention.

5. **Inline db.prepare() in dashboard routes:** Pre-compiled all morning check-in and device-comparison queries to module-level constants. Trends/workouts still use dynamic queries due to variable source/filter placeholders.

6. **Active energy unit normalization:** Removed the bogus combined "load" metric that divided kcal by 100 and added it to strain. Trends endpoint now returns `strain.whoop` and `strain.apple_active_energy` separately.

**API contract change:** Morning check-in `hrv` and `resting_hr` fields now nest by source instead of flattening to a single value. Frontend will need to handle both sub-objects.

### 2025-07-15 — Apple Watch Continuous Sync (Phase 2) Implemented

**What was built:**
- `BackgroundSyncManager` — singleton managing HKObserverQuery observers, HKAnchoredObjectQuery delta sync, background URLSession uploads, and BGAppRefreshTask fallback
- `KeychainHelper` — simple Keychain wrapper for JWT storage (kSecAttrAccessibleAfterFirstUnlock)
- AppDelegate wired to register background tasks, enable delivery, start observers on launch
- `GET /api/apple/sync-status` endpoint with staleness_minutes, metric_counts, failure tracking
- Migration 004 enhances apple_sync_state with status/counts/failure columns

**Architecture notes:**
- Background sync uses anchored queries (not date-based) — more reliable, no missed samples
- Anchors stored per-metric in UserDefaults; JWT in Keychain
- Background URLSession writes payload to temp file then uploads (required for background transfers)
- BGAppRefreshTask fires only if no observer has synced in 2+ hours (insurance policy)
- Foreground "Sync Now" path unchanged — still uses date-based queries via HealthKitManager

**Backend endpoint:**
- `GET /api/apple/sync-status` returns: connected, last_sync_at, status, metric_counts, staleness_minutes, consecutive_failures, last_error

**Testing caveat:** Background delivery and BGTasks require physical device. Simulator won't trigger observers.

### 2026-04-30 — Apple Watch Phase 2 & Performance Optimizations Spawned

📌 **Team update (2026-04-30T12:10:00Z):** Apple Watch Phase 2 spawned with Wash, Kaylee, River. Phase 2 adds background observers, anchored queries, Keychain JWT, BGAppRefreshTask, sync-status endpoint. Kaylee building SyncStatus UI component with 60s auto-refresh and green/amber/red freshness indicators. River adding expression indexes on date columns and pre-computed training_load_aggregates for O(1) workouts queries. — Scribe
