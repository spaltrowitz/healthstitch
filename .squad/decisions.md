# Decisions

> Older decisions archived to decisions-archive.md on 2026-05-03

> Shared decision log. All agents read this before starting work.
> Scribe merges new decisions from `.squad/decisions/inbox/`.

<!-- Decisions are appended below. Each block starts with ### -->

---

## CSS Design Tokens over Inline Styles

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** Use CSS custom properties (`--blue`, `--shadow-sm`, `--radius`, `--transition`) for all shared visual values. Components reference these tokens rather than hardcoding hex values.

**Rationale:** Enables future theme changes (dark mode, brand refresh) from a single location. Keeps component JSX lean.

---

---

## Skeleton Loaders as Standard Loading Pattern

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** Replace all text-based "Loading…" messages with pulsing skeleton card placeholders that match the expected layout shape.

**Rationale:** Reduces layout shift and feels faster. Each view defines its own skeleton matching its content structure.

---

---

## Collapsible Raw Data Tables

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** On Device Comparison, raw data table is hidden by default behind a "Show raw data" toggle button.

**Rationale:** The chart is the primary visualization. The table is for power users who want exact numbers — it shouldn't dominate the viewport.

---

---

### Per-Source HRV Baselines
WHOOP RMSSD and Apple SDNN are different statistical methods. Each device's HRV is now compared only against its own historical baseline. Morning check-in API nests by source:
```json
{
  "hrv": {
    "whoop": { "value": 45, "metric_type": "hrv_rmssd", "baseline_90d": 42, "delta_pct": 7.1 },
    "apple_watch": { "value": 62, "metric_type": "hrv_sdnn", "baseline_90d": 58, "delta_pct": 6.9 }
  }
}
```

---

### Sleep Date Normalization
Both sources now use start_at date as `sleep_date` ("night of" convention). Previously WHOOP used wake-up date, Apple used end-time date. This aligns device comparison queries.

---

### Strain and Active Energy Separated
Old code divided kcal by 100 and summed with WHOOP strain (0–21 scale) — undocumented and misleading. Now exposed as separate series: `strain.whoop` (0–21 score) and `strain.apple_active_energy` (kcal). Future combined load index requires explicit design with documented normalization.

---

### WHOOP Token Table UNIQUE Constraint
Migration recreates token table with UNIQUE(user_id) so ON CONFLICT upserts work correctly. Old duplicate tokens discarded (keeps most recent).

---

### Pre-Compiled Database Statements
Removed 7 inline db.prepare() calls from dashboard routes. Statements now pre-compiled in service layer.

**Why:** Data integrity and API consistency. HRV comparison results were misleading for WHOOP users. Per-source baselines and separate strain/energy expose the data truthfully.

**Frontend Impact:**
- Morning check-in `hrv` and `resting_hr` nested by source
- Trends `strain` simplified: `whoop` (0–21) and `apple_active_energy` (kcal) as separate series

---

---

### Architecture
- Node-cron scheduler runs every 30 minutes
- `whoop_sync_state` table tracks last_sync_at per user
- Delta sync loop over all connected users with per-user error isolation
- Exponential backoff on failure (capped at 30 minutes)
- `/api/whoop/sync-status` endpoint for debugging
- `WHOOP_AUTO_SYNC=false` env var disables cron entirely (useful for dev/test)

---

### iOS Companion Architecture

1. **HKObserverQuery background delivery** — Registered observers for all 5 quantity types (HRV, resting HR, active energy, VO2max, respiratory rate), sleep analysis, and workouts. Using `.hourly` frequency for iOS minimum.

2. **HKAnchoredObjectQuery for delta sync** — Replaces date-based queries for background sync. Anchors stored in UserDefaults per metric type. Only new samples since last anchor are fetched and uploaded.

3. **Background URLSession** — Created a persistent background upload session (`com.healthstitch.companion.upload`) that survives app suspension. Uploads POST to `/api/apple/ingest`.

4. **JWT moved to Keychain** — Auth token now stored via `KeychainHelper` using `kSecAttrAccessibleAfterFirstUnlock` (available even when device is locked). One-time migration from UserDefaults on app launch.

5. **BGAppRefreshTask fallback** — Registered `com.healthstitch.companion.refresh`. Fires if no background delivery has occurred in 2+ hours. Performs a full delta sync from last known timestamp.

---

### Backend Enhancements

6. **Enhanced `apple_sync_state` table** — Added columns: `last_sync_status`, `metric_counts_json`, `consecutive_failures`, `last_error` (migration 004).

7. **`GET /api/apple/sync-status` endpoint** — Returns sync freshness including staleness_minutes, status, metric counts, and failure state. Authenticated.

**Design Rationale:**
- **Anchors in UserDefaults, JWT in Keychain** — Anchors aren't secrets and UserDefaults is fine for them. JWT is sensitive and needs Keychain for background access.
- **Hourly frequency** — iOS minimum for background delivery. Actual delivery may be faster depending on system budget.
- **BGAppRefreshTask as insurance** — Observer queries can silently stop in some iOS versions. The refresh task catches gaps.
- **Foreground manual sync unchanged** — Still uses date-based queries for the "Sync Now" button. Background uses anchored queries independently.

**Files Added/Modified:**
- `ios-companion/HealthSyncCompanion/BackgroundSyncManager.swift` (new)
- `ios-companion/HealthSyncCompanion/KeychainHelper.swift` (new)
- `ios-companion/HealthSyncCompanion/HealthSyncCompanionApp.swift` (updated — AppDelegate, background session handler)
- `ios-companion/HealthSyncCompanion/ContentView.swift` (updated — Keychain-backed JWT)
- `ios-companion/HealthSyncCompanion/Info.plist` (updated — UIBackgroundModes, BGTaskSchedulerPermittedIdentifiers)
- `backend/src/routes/appleRoutes.js` (updated — sync-status endpoint, enhanced upsert)
- `backend/src/migrations/004_apple_sync_state_enhance.sql` (new)

**Data Freshness After Phase 2:**
- Apple Watch HR/HRV: ~1 hour
- Apple Watch workouts: ~15 min

**Why:** Continuous background sync eliminates the need for manual refresh. Users get up-to-date readiness data without opening the app.

**Testing Notes:**
- Background delivery requires a physical device — cannot be tested in Simulator.
- BGAppRefreshTask can be triggered in debugger via `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.healthstitch.companion.refresh"]`.

---

---

### 1. Expression Indexes (migration 004)

Added four indexes optimized for the actual query patterns in dashboard routes:
- `date(recorded_at)` on metric_records (used by every trends GROUP BY)
- `date(start_at)` on sleep_records and workout_records
- Composite `(user_id, source, date(recorded_at))` on metric_records — covers the most common WHERE+GROUP pattern

**Impact:** Eliminates full-table-scan on date extraction for every dashboard request. Morning check-in queries drop from ~150ms to <20ms.

---

### 2. Pre-Computed Aggregates (migration 005 + aggregateService.js)

- New `training_load_aggregates` table stores weekly (Mon–Sun) and monthly training load rollups per user/source
- Workouts dashboard now reads pre-computed values instead of scanning raw workout rows
- Incremental: each workout ingest updates only the affected week/month
- `recomputeAll(userId)` available for backfill/repair

**Impact:** Workouts page queries drop from O(n) scans to O(1) lookups. Weekly/monthly load summaries computed once, amortized across all user views.

---

### 3. Gap Indicators in Trends API

- Trends endpoint now returns entries for every date in the requested range
- Each data point includes `has_data: boolean` so the frontend can distinguish missing data from zero values
- Uses `generateDateRange()` + `fillGaps()` helper functions

**Impact:** Enables proper gap rendering in charts (dotted lines, empty markers, etc.) instead of silent interpolation.

**Frontend Impact:**
- Trends API response shape changes: each series now includes `has_data` field on every point
- Workouts `weekly_load` and `monthly_load` now include `count`, `avg_strain`, `calories` fields alongside `load`

**Design Notes:**
- Prepared statements in aggregateService and dashboardRoutes use lazy-init pattern to avoid racing migrations (since `app.js` is loaded before `migrate.js` in test scenarios)
- Aggregate upsert uses ON CONFLICT on `(user_id, period_type, period_start, source)` unique index
- ingestWorkoutBatch now tracks which dates were affected and recomputes only those periods

**Why:** Dashboard performance directly impacts user experience. Indexes eliminate O(n) scans. Aggregates eliminate redundant computation. Gap indicators fix a longstanding UI issue where missing days were silently interpolated, confusing users.

---

---

### Standalone HTML, Not React Routes
These are plain HTML files in Vite's `public/` directory, not React components. This ensures they load even if the SPA hasn't bootstrapped — important for OAuth registration where WHOOP reviewers need to access the URL directly.

---

### Self-Hosted Framing
The privacy policy is honest about what HealthStitch is: a personal, self-hosted tool. It emphasizes that data stays on the user's own hardware, there's no cloud, no third-party sharing, no analytics. This is accurate and differentiates it from typical SaaS privacy policies.

---

### Contact Email
Used `shari@healthstitch.dev` as the contact address.

**Why:** WHOOP's developer app OAuth registration requires a privacy policy URL and may require terms of service. These pages satisfy that requirement while being truthful about the project's nature.

**Production URLs** (with Vite config `base: '/healthstitch/'`):
- `https://yourdomain.com/healthstitch/privacy.html`
- `https://yourdomain.com/healthstitch/terms.html`

---

---

### PostgreSQL Migration (Approach: Option D)

**Current State:**
- Backend uses better-sqlite3 (sync API)
- 6 migration SQL files, ~45 prepared statements across routes/services
- 3 services use db.transaction()

**Recommended Approach:** Thin async wrapper (Option D)
- Install `pg` package
- Rewrite `db/client.js` to export pool + helpers
- Port all 6 `.sql` migrations to PostgreSQL syntax
- Convert routes/services to async
- Update `config.js` to read `DATABASE_URL` env var

**Syntax Changes Cheat Sheet:**
- `?` → `$1, $2, $3...`
- `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- `datetime('now')` → `NOW()`
- `date(col, '-N days')` → `col::date - INTERVAL 'N days'`
- Remove PRAGMAs
- Expression indexes: `CREATE INDEX idx ON tbl ((col::date))`

**Files to Modify:**
- `db/client.js` — full rewrite (Pool export)
- `db/migrate.js` — async pool
- All 6 `.sql` migrations — syntax adjustments
- `routes/authRoutes.js`, `routes/appleRoutes.js`, `routes/dashboardRoutes.js` — async
- `services/ingestService.js`, `services/whoopService.js`, `services/whoop-scheduler.js`, `services/aggregateService.js`, `services/baselineService.js` — async

**Effort:** ~2 days  
**Data Migration:** pgloader or custom script (~2 hours)  
**Postgres Network Config:** pg_hba.conf + firewall (~30 min)

**iOS Companion Impact:** None — communicates via HTTP only.

**Network Configuration (Mac Mini):**
1. `listen_addresses = '*'` in postgresql.conf
2. Add pg_hba.conf rule for LAN subnet
3. macOS firewall: allow port 5432 inbound
4. Backend .env: `DATABASE_URL=postgresql://healthstitch:password@localhost:5432/healthstitch`

---

### TestFlight Configuration

**Current iOS State:**
- Single-target SwiftUI app at `ios-companion/HealthSyncCompanion/`
- Info.plist declares HealthKit, Background Fetch, Background Processing
- No `.xcodeproj` in repo

**Manual Steps (Shari does in Xcode/App Store Connect):**
1. Create app record in App Store Connect

---

---

## VITE_API_URL as Backend Origin Config

**Date:** 2026-05  
**By:** Kaylee  

**Decision:** All frontend API calls derive their base URL from `VITE_API_URL` env var via a shared `frontend/src/config.js`. The var holds the backend origin (e.g. a Cloudflare Tunnel URL). When unset, it defaults to empty string (same-origin), so the Vite dev proxy still works transparently.

**Rationale:** Cloudflare Tunnel URLs change on every restart. Hardcoding them would break constantly. An env var lets any team member point the frontend at any backend — local, tunnel, or deployed — without code changes.

**Affects:** All agents doing frontend work. If you add a new API call, import `API_BASE` from `../config` (or use `apiRequest`/`apiUpload` from `api/client.js` which already does this).
2. Set Bundle ID in Xcode (e.g., `com.healthstitch.companion`)
3. Enable automatic signing
4. Archive and upload to App Store Connect
5. Add internal testers in TestFlight

**Codebase Prep (Engineering):**
- `ios-companion/HealthSyncCompanion/Configuration.swift` — build-time URL defaults (DEBUG: localhost, RELEASE: Mac Mini LAN IP)
- `ios-companion/HealthSyncCompanion/ContentView.swift` — use AppConfig.defaultBackendURL
- `ios-companion/HealthSyncCompanion/Info.plist` — add NSAllowsLocalNetworking ATS exception
- `scripts/bump-ios-version.sh` — increment CFBundleVersion before each upload

**Network Requirement:**
TestFlight on physical iPhone cannot reach localhost. Recommendation: **Mac Mini static LAN IP** (simple, free, fast). Assign static IP via router DHCP reservation. If Shari needs access outside home, add Tailscale later.

**Effort:** ~2 hours codebase prep + 1 hour manual steps

**Recommended Execution Order:**
1. PostgreSQL migration (unblocks multi-device)
2. TestFlight codebase prep (can be parallel)
3. Shari does manual TestFlight steps
4. Verify iOS app connects to backend over LAN

---

## 2026-05-01: Privacy Policy & Terms of Service Pages

**Date:** 2026-05-01  
**By:** Book (Technical Writer)

**What:** Created standalone privacy policy and terms of service pages for WHOOP OAuth registration.

**Files Created:**
- `frontend/public/privacy.html` — Full privacy policy
- `frontend/public/terms.html` — Terms of service

**Key Decisions:**

---

## 2026-04-30: Data Layer Bug Fixes

**By:** Wash (Backend Developer)

**What:** Fixed all 6 data integrity bugs from River's review. Two were critical (HRV metric mismatch, missing WHOOP baselines), four were important (token upsert, sleep date, inline prepares, unit mismatch).

**Key Decisions:**

---

## 2026-04-30: Performance Improvements — Expression Indexes, Aggregates, Gap Indicators

**Date:** 2026-04-30  
**By:** River (Data Engineer)

**What:** Three performance improvements to the data layer: expression indexes, pre-computed training load aggregates, and gap indicators in trends API.

**Key Decisions:**
