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

### 2025-07-15 — PostgreSQL + TestFlight Scoping

**Scope:** Analyzed full backend DB layer for Postgres migration + iOS TestFlight readiness.

**Key findings:**
- 45 prepared statements across 9 files, all synchronous (better-sqlite3)
- 3 transaction sites (ingestService, baselineService, aggregateService)
- Main SQLite-isms: `datetime('now')` (8×), `INSERT OR IGNORE` (3×), `date()` expressions (~20×), PRAGMAs (2×)
- `ON CONFLICT` upserts (5×) are PG-compatible as-is
- iOS app is HTTP-only — no DB awareness, just needs correct backend URL
- No .xcodeproj committed to repo — Xcode project settings are local only
- Recommended: Option D (thin pg.Pool wrapper) — 2 day estimate
- TestFlight critical path: ATS exception for LAN HTTP + build-time URL config

**Output:** `.squad/decisions/inbox/wash-postgres-testflight-scoping.md`

## Cross-Project Backend Knowledge (injected 2026-05-02)

The following learnings come from Backend agents across Shari's other personal projects.

### From EatDiscounted (Fenster)
- **API rate limiting:** Per-IP sliding window rate limiting (5/min on primary, 10/min on secondary, 20/min on reads). Return 429 + `Retry-After` header. Dead-code rate limit constants are a red flag — verify they're actually wired in.
- **In-memory caching:** TTL-based caching (1hr for API results, 5min for sitemaps). Key: `entity::source`. ~10-50x capacity multiplier for quota-limited APIs. Caveat: in-memory cache lost on deploy — needs Redis for multi-instance.
- **Search API migration:** Google CSE (100 free/day) → Brave Search (2,000 free/month). Lesson: always have a fallback search provider and know quota ceilings.
- **Direct API integrations:** Some services (Upside, Bilt) have public no-auth REST APIs. Check for direct APIs before building scrapers.
- **Unicode handling:** NFD decomposition + combining-mark stripping for transliteration. Special cases for ß→ss, æ→ae, œ→oe.
- **Security:** `.env.local` must be in `.gitignore` — check git history for prior exposure and rotate keys. Hardcoded salts are a risk. Remove dead code referencing sensitive constants.

### From MyDailyWin (Daruk, alumni: Dustin, Frozone)
- **Firebase Auth + Firestore ownership:** Document ownership via `ownerEmail` + `profiles/{id}/admins/{email}` subcollection. Firestore-only authority — never trust localStorage for authorization.
- **Cloud Functions (v2 onCall):** Callable Cloud Functions auto-authenticate via Firebase Auth tokens (no CORS headers needed). Cold start ~1-2s acceptable for non-critical paths.
- **EmailJS → Cloud Function migration:** Move client-side credentials server-side. Cloud Function via `firebase.functions().httpsCallable()`. Lesson: backend-owned credentials allow library swap without frontend changes.
- **CSP headers:** Content-Security-Policy in `firebase.json` — script-src 'self' + CDN whitelist, no unsafe-inline. Update `connect-src` when migrating APIs.
- **Firestore rules pitfalls:** `request.auth != null` alone is too permissive. Need per-user ownership scoping + field validation. `create: if true` = unauthenticated write risk. Use `exists()` guard for ownership checks.
- **XSS via innerHTML:** 45+ instances in MyDailyWin. OAuth-returned fields (e.g., `user.photoURL`) set via innerHTML = XSS vector. Always sanitize user-provided content.
- **PROFILE_ID validation:** `/^[a-zA-Z0-9_-]+$/` prevents path injection. Apply to user-controlled path segments.
- **localStorage limitations:** 20+ key patterns, no server-first strategy. Changes invisible until reload due to sync gap.

### From Slotted (Zuko, alumni: Roy, Sam)
- **Security (critical patterns):** Never hardcode admin secret fallbacks — use fail-closed (403 if env var unset). Strip sensitive fields (OAuth tokens, email, socialBattery) from API responses via `stripSensitive()`. Always add new token fields to the sensitive list.
- **OAuth token storage:** Supabase Vault encryption (not plaintext DB columns). `oauth_tokens` table stores vault secret UUIDs; SQL helpers are SECURITY DEFINER. Old columns renamed to `_deprecated` for rollback. Supabase deprecating pgsodium TCE — use Vault secret store directly.
- **CORS:** Whitelist specific origins. Default `callback(null, true)` = security hole. No-origin requests allowed intentionally for mobile/curl via `!origin` check.
- **Google webhooks:** Must always return 200 (even on errors) or Google deactivates the endpoint. For stale sync tokens (410), clear and retry immediately in the same call.
- **Notification dedup:** Cascading — 1hr by relatedUserId → 5min by relatedId → 10min by title. Use unique notification types for filter logic.
- **Race conditions:** AFTER UPDATE trigger + FOR UPDATE lock (atomic DB-level, not application-level). Use `ON CONFLICT` upserts instead of delete-then-insert.
- **API normalization:** Accept both camelCase and snake_case in request bodies for frontend compatibility.
- **Account deletion:** CASCADE + cancel created items + notify participants + clear OAuth tokens from Vault + delete blocked entries. Must handle all FK references.
- **RLS policies:** `get_current_user_id()` SECURITY DEFINER helper maps `auth.uid()` → internal UUID. Separate SELECT/INSERT/UPDATE/DELETE policies per table. Service_role bypasses RLS.
- **Duplicate detection:** Check for overlapping existing records before insert. Return 409 with existing ID.
- **Block/mute feature:** `blocked_users` table with RLS + migration. Check on invite + creation actions. Blocking removes existing relationships.
- **Friendship cooldown:** 30-day between deletion and re-creation via timestamp check.

### From Scrunch (Danny)
- **Supabase query optimization:** Use `select('id', { count: 'exact', head: true })` for count-only queries — transfers zero rows. Pattern: every count-only use case should use this.
- **Dedup performance:** Replace O(n²) `filter+findIndex` with O(n) Map-based dedup for list processing.
- **Parallel API calls:** Convert sequential `for` loops over external APIs to `Promise.all()`. Sequential fetches are the #1 latency killer.
- **TypeScript type drift:** When TS types drift from DB schema, the app silently degrades. `as unknown as Type` casts mask real errors. Use `supabase gen types` to keep types in sync.
- **Loading gate anti-pattern:** Blocking render until all queries resolve is the #1 perceived perf killer. Use `placeholderData` + `staleTime` in React Query. Render with defaults immediately, let data swap in reactively.
- **Search relevance:** Domain-aware keyword extraction with a vocabulary outperforms generic NLP. Reddit: 4-6 keyword terms optimal. Multi-query strategy (primary + fallback, deduped by URL) doubles relevant results.
- **Fallback UX:** Never disguise navigation/fallback as content items. Show clear error/no-results status with actionable next steps.
- **Image sourcing:** INCIDecoder GCS = highest hit rate. Ulta CDN: append `?w=400`, check placeholder hash `43eed7447d66573a67e2bc6e10858ab5`. Amazon/Walmart/Target all block automated access.
