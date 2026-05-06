# Decisions Archive

> Archived decisions from decisions.md.

---

## 2026-04-30: WHOOP Continuous Sync — Phase 1

**By:** River (Data Engineer)

**What:** Implemented scheduled WHOOP data sync with per-user error isolation and exponential backoff.

**Key Decisions:**

---

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

---

## 2026-04-30: Apple Watch Continuous Sync — Phase 2

**Date:** 2026-04-30  
**By:** Wash (Backend Developer)

**What:** Implemented continuous background sync for Apple Watch with HKObserverQuery observers, HKAnchoredObjectQuery delta sync, background URLSession, Keychain JWT storage, and BGAppRefreshTask fallback.

**Key Decisions:**

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

---

## 2026-04-29: User directive — Model standardization

**By:** Shari Paltrowitz (via Copilot)

**What:** All squad agents should use claude-opus-4.6 for consistency, not claude-sonnet-4.5.

**Why:** User preference for unified model performance across the team.

---

---

## 2026-04-30: Scoping — PostgreSQL Migration + TestFlight Configuration

**Date:** 2026-04-30  
**By:** Wash (Backend Developer)

**What:** Comprehensive scoping document for two user directives: PostgreSQL migration and TestFlight distribution.

---

## 2026-04-30T19:15:00Z: User Directive — TestFlight Distribution

**By:** Shari Paltrowitz (via Copilot)

**What:** Use TestFlight for iOS app distribution. Apple Developer account is available (purchased by husband).

**Why:** Enables one-tap install for beta testers with real-time HealthKit background sync.

**Scoping:** See wash-postgres-testflight-scoping decision for TestFlight codebase prep details (Configuration.swift, ATS exception, version bumping script).

---

---

## 2026-04-30T19:15:00Z: User Directive — PostgreSQL Migration

**By:** Shari Paltrowitz (via Copilot)

**What:** Set up a data pipeline to send health data to a PostgreSQL server running on her Mac Mini. This replaces SQLite as the production database for multi-device access.

**Why:** User request — enables iOS app, web dashboard, and WHOOP scheduler to all connect to a central database instead of a local SQLite file.

**Scoping:** See wash-postgres-testflight-scoping decision for detailed approach (Option D: thin async wrapper, ~2 days effort).

---
