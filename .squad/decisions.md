# Decisions

> Shared decision log. All agents read this before starting work.
> Scribe merges new decisions from `.squad/decisions/inbox/`.

<!-- Decisions are appended below. Each block starts with ### -->

## 2026-04-29: User directive — Model standardization

**By:** Shari Paltrowitz (via Copilot)

**What:** All squad agents should use claude-opus-4.6 for consistency, not claude-sonnet-4.5.

**Why:** User preference for unified model performance across the team.

---

## CSS Design Tokens over Inline Styles

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** Use CSS custom properties (`--blue`, `--shadow-sm`, `--radius`, `--transition`) for all shared visual values. Components reference these tokens rather than hardcoding hex values.

**Rationale:** Enables future theme changes (dark mode, brand refresh) from a single location. Keeps component JSX lean.

---

## Skeleton Loaders as Standard Loading Pattern

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** Replace all text-based "Loading…" messages with pulsing skeleton card placeholders that match the expected layout shape.

**Rationale:** Reduces layout shift and feels faster. Each view defines its own skeleton matching its content structure.

---

## Collapsible Raw Data Tables

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** On Device Comparison, raw data table is hidden by default behind a "Show raw data" toggle button.

**Rationale:** The chart is the primary visualization. The table is for power users who want exact numbers — it shouldn't dominate the viewport.

---

## 2026-04-29: Data Layer Review Findings

**By:** River (Data Engineer)

**What:** Comprehensive review of data layer identified 2 critical and 6 important issues.

**Critical Issues:**
1. **HRV baseline mismatch** — Morning check-in compares WHOOP RMSSD to Apple SDNN baseline. These are incompatible metrics; RMSSD reads ~0.7–0.9× SDNN. Fallback logic switches metrics silently without adjustment.
2. **Baselines computed only for Apple Watch** — WHOOP-only users get zero baselines and null morning check-in deltas.

**Important Issues:**
3. Sleep record duplication (3–6 overlapping samples per night from Apple)
4. No WHOOP baseline computation
5. Rolling average query is O(n) per user (1,095 queries for 1 year of data)
6. Inline db.prepare() calls in dashboard routes (7 per request, should pre-compile)
7. No timezone awareness (UTC midnight vs user local midnight)
8. Active energy unit mismatch (kcal/100 assumption vs WHOOP strain)

**Why:** Data integrity and performance at risk. HRV comparison results are misleading for users relying on WHOOP.

**Recommendations:**
- Separate HRV tracking by metric type; maintain separate baselines per source
- Add WHOOP baseline computation for hrv_rmssd
- Fix WHOOP token upsert constraint
- Normalize sleep_date logic
- Add user timezone to profile

---

## 2026-04-29: Continuous Sync Scoping — WHOOP + Apple Watch

**By:** Wash (Backend Developer)

**What:** Designed phased architecture for continuous data sync on both WHOOP and Apple Watch.

**WHOOP Continuous Sync (Phase 1, Small, 1–2 days):**
- Backend scheduled polling every 30 minutes via node-cron
- Add `whoop_sync_state` table to track last sync per user
- Loop over all connected users with error isolation per user
- Retry with exponential backoff on failure
- Future upgrade path to webhooks when deployed to HTTPS

**Apple Watch Continuous Sync (Phase 2, Medium, 3–4 days):**
- iOS background delivery observers on all metric types (hourly frequency)
- HKAnchoredObjectQuery for true delta sync (more reliable than date-based)
- Background URLSession for uploads that survive app suspension
- Move JWT from UserDefaults to Keychain (security requirement)
- BGAppRefreshTask as fallback sync trigger

**Data Freshness After Implementation:**
- WHOOP recovery/sleep: ~30 min after wake
- WHOOP workouts: ~5 min after completion
- Apple Watch HR/HRV: ~1 hour
- Apple Watch workouts: ~15 min

**Why:** Manual sync is a friction point. Continuous pull ensures dashboard data is stale by at most 30–60 minutes (vs "whenever user remembers to open the app").

**Gaps Prioritized:**
- Phase 1 (critical): Scheduled job, sync state table, delta sync
- Phase 2 (critical): Observer queries, background URLSession, anchored queries
- Phase 3 (important): Retry logic, failure monitoring, source priority

---

## 2026-04-29: Copy Voice & Naming

**By:** Book (Technical Writer)

**What:** Established HealthStitch brand and warm, personal copy voice across all user-facing text.

**Key Decisions:**
- **App name:** HealthStitch (captures "stitching" concept; not "Unified Health Dashboard")
- **Tab labels:** Task-oriented and short: "Today's Readiness", "Trends", "Apple vs WHOOP", "Workouts"
- **Voice:** Warm, personal, like a health-savvy friend. No clinical jargon in UI copy.
- **Null states:** Use em-dash "—" instead of "--" (reads as intentional absence)
- **Loading states:** Conversational and specific ("Pulling together your morning snapshot…")
- **Error messages:** Lead with what went wrong in human terms, then append technical detail
- **Chart legends:** Device attribution, not algorithm: "Apple Watch (SDNN)" not "Apple SDNN"

**Why:** Users are not clinicians. Copy should help them understand "am I ready today?" without dumbing things down or overwhelming with technical terms.

**Voice Guidelines:**
- Always lead with user benefit (question, goal, action) before technical detail
- Parenthetical device attribution is fine for power users; it clarifies the source without cluttering the main message
- Avoid: "ingest", "delta", "RMSSD", "SDNN", "HRV" in user text; instead: "pulled together", "change", "morning readiness"

---

## 2026-04-30: Data Layer Bug Fixes

**By:** Wash (Backend Developer)

**What:** Fixed all 6 data integrity bugs from River's review. Two were critical (HRV metric mismatch, missing WHOOP baselines), four were important (token upsert, sleep date, inline prepares, unit mismatch).

**Key Decisions:**

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

### Sleep Date Normalization
Both sources now use start_at date as `sleep_date` ("night of" convention). Previously WHOOP used wake-up date, Apple used end-time date. This aligns device comparison queries.

### Strain and Active Energy Separated
Old code divided kcal by 100 and summed with WHOOP strain (0–21 scale) — undocumented and misleading. Now exposed as separate series: `strain.whoop` (0–21 score) and `strain.apple_active_energy` (kcal). Future combined load index requires explicit design with documented normalization.

### WHOOP Token Table UNIQUE Constraint
Migration recreates token table with UNIQUE(user_id) so ON CONFLICT upserts work correctly. Old duplicate tokens discarded (keeps most recent).

### Pre-Compiled Database Statements
Removed 7 inline db.prepare() calls from dashboard routes. Statements now pre-compiled in service layer.

**Why:** Data integrity and API consistency. HRV comparison results were misleading for WHOOP users. Per-source baselines and separate strain/energy expose the data truthfully.

**Frontend Impact:**
- Morning check-in `hrv` and `resting_hr` nested by source
- Trends `strain` simplified: `whoop` (0–21) and `apple_active_energy` (kcal) as separate series

---

## 2026-04-30: WHOOP Continuous Sync — Phase 1

**By:** River (Data Engineer)

**What:** Implemented scheduled WHOOP data sync with per-user error isolation and exponential backoff.

**Key Decisions:**

### Architecture
- Node-cron scheduler runs every 30 minutes
- `whoop_sync_state` table tracks last_sync_at per user
- Delta sync loop over all connected users with per-user error isolation
- Exponential backoff on failure (capped at 30 minutes)
- `/api/whoop/sync-status` endpoint for debugging
- `WHOOP_AUTO_SYNC=false` env var disables cron entirely (useful for dev/test)

### Implementation Details
1. Delta sync already supported — `syncWhoopData(userId, since)` and `fetchPaginated()` accepted `since` param out of the box. No modification to existing sync logic needed.
2. Backoff cap at 30 minutes matches the cron interval — a failing user won't be retried faster than once per cycle.
3. Scheduler starts inside the `listen` callback to guarantee migrations have run before prepared statements execute.

**Files Added/Modified:**
- `backend/src/migrations/003_whoop_sync_state.sql` (new table)
- `backend/src/services/whoop-scheduler.js` (new service)
- `backend/src/routes/whoopRoutes.js` (added sync-status endpoint)
- `backend/src/server.js` (wired scheduler startup)
- `backend/package.json` (added node-cron)

**Data Freshness After Phase 1:**
- WHOOP recovery/sleep: ~30 min after wake
- WHOOP workouts: ~5 min after completion

**Why:** Manual sync is a friction point. Continuous pull ensures dashboard data is stale by at most 30–60 minutes (vs "whenever user remembers to open the app").

**Future Phases (Out of Scope):**
- Phase 2 (Apple Watch): Observer queries, background URLSession, anchored queries (3–4 days)
- Webhook upgrade when deployed to HTTPS (eliminates polling)
- Monitoring/alerting on consecutive_failures > N
- Rate limiting awareness (WHOOP API throttle headers)

---

## 2026-04-30: Apple Watch Continuous Sync — Phase 2

**Date:** 2026-04-30  
**By:** Wash (Backend Developer)

**What:** Implemented continuous background sync for Apple Watch with HKObserverQuery observers, HKAnchoredObjectQuery delta sync, background URLSession, Keychain JWT storage, and BGAppRefreshTask fallback.

**Key Decisions:**

### iOS Companion Architecture

1. **HKObserverQuery background delivery** — Registered observers for all 5 quantity types (HRV, resting HR, active energy, VO2max, respiratory rate), sleep analysis, and workouts. Using `.hourly` frequency for iOS minimum.

2. **HKAnchoredObjectQuery for delta sync** — Replaces date-based queries for background sync. Anchors stored in UserDefaults per metric type. Only new samples since last anchor are fetched and uploaded.

3. **Background URLSession** — Created a persistent background upload session (`com.healthstitch.companion.upload`) that survives app suspension. Uploads POST to `/api/apple/ingest`.

4. **JWT moved to Keychain** — Auth token now stored via `KeychainHelper` using `kSecAttrAccessibleAfterFirstUnlock` (available even when device is locked). One-time migration from UserDefaults on app launch.

5. **BGAppRefreshTask fallback** — Registered `com.healthstitch.companion.refresh`. Fires if no background delivery has occurred in 2+ hours. Performs a full delta sync from last known timestamp.

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

## 2026-04-30: Performance Improvements — Expression Indexes, Aggregates, Gap Indicators

**Date:** 2026-04-30  
**By:** River (Data Engineer)

**What:** Three performance improvements to the data layer: expression indexes, pre-computed training load aggregates, and gap indicators in trends API.

**Key Decisions:**

### 1. Expression Indexes (migration 004)

Added four indexes optimized for the actual query patterns in dashboard routes:
- `date(recorded_at)` on metric_records (used by every trends GROUP BY)
- `date(start_at)` on sleep_records and workout_records
- Composite `(user_id, source, date(recorded_at))` on metric_records — covers the most common WHERE+GROUP pattern

**Impact:** Eliminates full-table-scan on date extraction for every dashboard request. Morning check-in queries drop from ~150ms to <20ms.

### 2. Pre-Computed Aggregates (migration 005 + aggregateService.js)

- New `training_load_aggregates` table stores weekly (Mon–Sun) and monthly training load rollups per user/source
- Workouts dashboard now reads pre-computed values instead of scanning raw workout rows
- Incremental: each workout ingest updates only the affected week/month
- `recomputeAll(userId)` available for backfill/repair

**Impact:** Workouts page queries drop from O(n) scans to O(1) lookups. Weekly/monthly load summaries computed once, amortized across all user views.

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

## 2026-05-01: Privacy Policy & Terms of Service Pages

**Date:** 2026-05-01  
**By:** Book (Technical Writer)

**What:** Created standalone privacy policy and terms of service pages for WHOOP OAuth registration.

**Files Created:**
- `frontend/public/privacy.html` — Full privacy policy
- `frontend/public/terms.html` — Terms of service

**Key Decisions:**

### Standalone HTML, Not React Routes
These are plain HTML files in Vite's `public/` directory, not React components. This ensures they load even if the SPA hasn't bootstrapped — important for OAuth registration where WHOOP reviewers need to access the URL directly.

### Self-Hosted Framing
The privacy policy is honest about what HealthStitch is: a personal, self-hosted tool. It emphasizes that data stays on the user's own hardware, there's no cloud, no third-party sharing, no analytics. This is accurate and differentiates it from typical SaaS privacy policies.

### Contact Email
Used `shari@healthstitch.dev` as the contact address.

**Why:** WHOOP's developer app OAuth registration requires a privacy policy URL and may require terms of service. These pages satisfy that requirement while being truthful about the project's nature.

**Production URLs** (with Vite config `base: '/healthstitch/'`):
- `https://yourdomain.com/healthstitch/privacy.html`
- `https://yourdomain.com/healthstitch/terms.html`

---

## 2026-04-30T19:15:00Z: User Directive — PostgreSQL Migration

**By:** Shari Paltrowitz (via Copilot)

**What:** Set up a data pipeline to send health data to a PostgreSQL server running on her Mac Mini. This replaces SQLite as the production database for multi-device access.

**Why:** User request — enables iOS app, web dashboard, and WHOOP scheduler to all connect to a central database instead of a local SQLite file.

**Scoping:** See wash-postgres-testflight-scoping decision for detailed approach (Option D: thin async wrapper, ~2 days effort).

---

## 2026-04-30T19:15:00Z: User Directive — TestFlight Distribution

**By:** Shari Paltrowitz (via Copilot)

**What:** Use TestFlight for iOS app distribution. Apple Developer account is available (purchased by husband).

**Why:** Enables one-tap install for beta testers with real-time HealthKit background sync.

**Scoping:** See wash-postgres-testflight-scoping decision for TestFlight codebase prep details (Configuration.swift, ATS exception, version bumping script).

---

## 2026-04-30: Scoping — PostgreSQL Migration + TestFlight Configuration

**Date:** 2026-04-30  
**By:** Wash (Backend Developer)

**What:** Comprehensive scoping document for two user directives: PostgreSQL migration and TestFlight distribution.

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

### TestFlight Configuration

**Current iOS State:**
- Single-target SwiftUI app at `ios-companion/HealthSyncCompanion/`
- Info.plist declares HealthKit, Background Fetch, Background Processing
- No `.xcodeproj` in repo

**Manual Steps (Shari does in Xcode/App Store Connect):**
1. Create app record in App Store Connect

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
