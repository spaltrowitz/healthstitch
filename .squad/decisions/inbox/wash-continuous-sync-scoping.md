# Continuous Sync Scoping — WHOOP + Apple Watch

**Author:** Wash (Backend Dev)  
**Date:** 2025-07-15  
**Status:** Research / Proposal (not implementing)

---

## 1. Current State

### WHOOP Data Sync (backend-initiated)

**How it works today:** Manual trigger only. User hits `POST /api/whoop/sync` or completes OAuth callback, which calls `syncWhoopData()`. This pulls all four data types (recovery, sleep, cycles/strain, workouts) from the WHOOP Developer API v2 with pagination, maps them to our schema, and ingests via `ingestService`.

**What's already built:**
- ✅ Full OAuth2 flow (authorization code grant)
- ✅ Token persistence in `whoop_tokens` table (access_token, refresh_token, expires_at)
- ✅ **Token refresh** — `getValidAccessToken()` checks expiry (with 60s buffer) and auto-refreshes. This is working.
- ✅ Paginated fetch across all endpoints
- ✅ Delta sync support — `syncWhoopData(userId, since)` accepts a `since` timestamp
- ✅ Deduplication via `INSERT OR IGNORE` + unique indexes on external_id
- ✅ Baseline recomputation after each sync

**What's NOT built:**
- ❌ No scheduled/automatic sync — only user-triggered
- ❌ No sync state tracking for WHOOP (no "last successful sync at" record)
- ❌ No error handling beyond returning 500 to the client
- ❌ No retry logic
- ❌ No webhook receiver

### Apple Watch Data Sync (iOS-push model)

**How it works today:** The iOS companion app (`HealthSyncCompanion`) is a foreground-only manual sync. User opens app, taps "Sync Now," which:
1. Calls `HealthKitManager.fetchUpdates(since:)` — queries HRV, resting HR, active energy, VO2max, respiratory rate, sleep, workouts
2. Chunks data and POSTs to `POST /api/apple/ingest` via `SyncService.uploadBatches()`
3. Backend ingests and updates `apple_sync_state.last_sync_at`

**What's already built:**
- ✅ HealthKit permission request
- ✅ Delta fetch using `since` timestamp from last sync
- ✅ Batch upload with chunking (500 records per request)
- ✅ Backend ingest endpoint with deduplication
- ✅ Sync state tracking (`apple_sync_state` table)

**What's NOT built:**
- ❌ No background delivery observers (HealthKit can push updates to suspended apps)
- ❌ No `BGTaskScheduler` for periodic refresh
- ❌ No background `URLSession` for uploads when app is suspended
- ❌ User must manually open app and tap sync
- ❌ No error retry
- ❌ JWT token stored in `@AppStorage` (UserDefaults) — should be Keychain

---

## 2. WHOOP Continuous Pull

### What the WHOOP API Supports

| Feature | Status | Notes |
|---------|--------|-------|
| OAuth2 + refresh tokens | ✅ Supported | Tokens expire in ~60min, refresh works indefinitely unless revoked |
| Webhooks | ✅ Available | WHOOP supports webhook subscriptions for event notifications |
| Polling | ✅ Works now | Using `start` param for delta queries |
| Rate limits | ~100 req/min | Undocumented officially; empirically ~100/min per app |
| Data types | Recovery, Sleep, Cycles (strain), Workouts, Body measurements | All available via REST |
| Data freshness | Recovery/sleep finalize ~30min after wake; workouts within minutes | Strain cycles close at end of day |

### Recommended Approach: Scheduled Polling (with webhook upgrade path)

**Why polling first:**
- Webhooks require a publicly-accessible HTTPS endpoint (we're currently localhost)
- Polling is simpler, works in dev, and our token refresh already handles it
- WHOOP data updates infrequently (sleep: 1x/day, recovery: 1x/day, workouts: few/day)

**Polling schedule:**
- Every 15 minutes during 5AM–10AM (catch morning recovery/sleep finalization)
- Every 60 minutes rest of day (catch workouts)
- Alternatively: just every 30 minutes, 24/7 (simpler, still within rate limits)

**Implementation needs:**

| Task | Effort | Description |
|------|--------|-------------|
| Add `node-cron` or `node-schedule` | Small | Schedule `syncWhoopData()` for all connected users |
| Add `whoop_sync_state` table | Small | Track last successful sync per user (like `apple_sync_state`) |
| Loop over all connected users | Small | Query `whoop_tokens` for all users, sync each |
| Error isolation per user | Small | One user's failure shouldn't block others |
| Retry with exponential backoff | Medium | Failed syncs retry 3x with increasing delay |
| Webhook receiver endpoint | Medium | `POST /api/whoop/webhook` — for future upgrade |
| Sync status dashboard data | Small | Expose last sync time, error count to frontend |

### Future: Webhook Upgrade

When we deploy to a real server with HTTPS:
- Register webhook subscription via WHOOP API
- Receive event notifications (new recovery, new workout, etc.)
- Use notification as a trigger to pull specific data immediately
- Keep polling as fallback for missed events

---

## 3. Apple Watch Continuous Pull

### How HealthKit Background Delivery Works

HealthKit offers `enableBackgroundDelivery(for:frequency:)` which wakes your app when new samples of a given type are written. This is the correct mechanism for continuous Apple Watch sync.

**Supported frequencies:** `.immediate`, `.hourly`, `.daily`  
**Key constraint:** App gets ~30 seconds of background execution time when woken.

### Data Types Supporting Background Delivery

All our current types support it:
- `HKQuantityType.heartRateVariabilitySDNN` ✅
- `HKQuantityType.restingHeartRate` ✅
- `HKQuantityType.activeEnergyBurned` ✅
- `HKQuantityType.vo2Max` ✅
- `HKQuantityType.respiratoryRate` ✅
- `HKCategoryType.sleepAnalysis` ✅
- `HKWorkoutType` ✅

### Implementation Needs

| Task | Effort | Description |
|------|--------|-------------|
| Add `HKObserverQuery` for each type | Medium | Register observers that fire on new data |
| Call `enableBackgroundDelivery` at app launch | Small | Enables wake-on-new-data |
| Add `BGAppRefreshTask` as fallback | Medium | Periodic sync even without new HealthKit data |
| Background `URLSession` for uploads | Medium | Upload survives app suspension; system manages retries |
| Move JWT to Keychain | Small | Security requirement for background access |
| Add `Info.plist` background modes | Small | `processing`, `fetch` capabilities |
| Anchor-based queries instead of date-based | Medium | Use `HKAnchoredObjectQuery` for true delta sync (more reliable than date comparison) |
| Handle `completionHandler` correctly | Small | Must call background fetch completion handler |

### Battery/Performance Implications

- `.hourly` frequency is recommended (not `.immediate`) for most types
- Active energy can use `.immediate` since it's already high-frequency
- Background URLSession is battery-efficient (system batches uploads with other network activity)
- Estimated impact: negligible — HealthKit background delivery is specifically designed for this

### Push Architecture

```
Apple Watch → HealthKit Store → Observer fires → iOS app wakes
→ Anchored query (only new samples) → Background URLSession POST → Backend ingest
```

---

## 4. Architecture Proposal

### WHOOP: Backend Scheduled Sync

```
┌─────────────────────────────────────────────┐
│  node-cron (every 30 min)                    │
│  ├─ Query all users with whoop_tokens        │
│  ├─ For each user:                           │
│  │   ├─ getValidAccessToken() (auto-refresh) │
│  │   ├─ syncWhoopData(userId, lastSyncAt)    │
│  │   ├─ Update whoop_sync_state              │
│  │   └─ computeBaselines()                   │
│  └─ Log results, record failures             │
└─────────────────────────────────────────────┘
```

### Apple Watch: iOS Background Delivery

```
┌─────────────────────────────────────────────────┐
│  App Launch                                      │
│  ├─ enableBackgroundDelivery (all types, hourly) │
│  └─ Register HKObserverQuery per type            │
│                                                  │
│  On Observer Fire:                               │
│  ├─ HKAnchoredObjectQuery (delta only)           │
│  ├─ Batch into HealthPayload                     │
│  ├─ Background URLSession upload                 │
│  └─ Update local anchor                          │
│                                                  │
│  Fallback: BGAppRefreshTask every ~2 hours       │
└─────────────────────────────────────────────────┘
```

### Conflict Resolution

Already handled well:
- `INSERT OR IGNORE` with unique indexes on `external_id` prevents duplicates
- Date-range deduplication indexes catch records without external IDs
- Both WHOOP and Apple Watch provide stable IDs (WHOOP `id`, HealthKit `uuid`)

One addition needed: if both WHOOP and Apple Watch report the same metric (e.g., resting HR), they're stored with different `source` values. The dashboard/baseline service should prefer one source per metric type or merge intelligently.

### Error Handling & Retry

**WHOOP (backend):**
- Wrap each user's sync in try/catch; log failure, continue to next user
- On HTTP 401: attempt token refresh once, then mark token as invalid
- On HTTP 429 (rate limit): back off, retry after delay
- After 3 consecutive failures for a user: pause their sync, notify via dashboard

**Apple Watch (iOS):**
- Background URLSession handles retry automatically for network errors
- On 401: surface in-app notification to re-authenticate
- Store failed payloads locally (CoreData/file) for retry on next wake

### Data Freshness Expectations

| Source | Realistic Freshness | Explanation |
|--------|-------------------|-------------|
| WHOOP Recovery | ~30 min after waking | WHOOP finalizes recovery score ~30min post-wake |
| WHOOP Sleep | ~30 min after waking | Same as recovery |
| WHOOP Workouts | ~5 min after completion | Available almost immediately |
| WHOOP Strain | End of day | Cycle closes at next sleep onset |
| Apple Watch HR/HRV | ~1 hour | Background delivery hourly cadence |
| Apple Watch Workouts | ~15 min | Observer fires on workout save |
| Apple Watch Sleep | ~1 hour after waking | Dependent on Apple's sleep detection |

**Bottom line:** With continuous sync, dashboard data would be 30–60 minutes stale at worst, compared to "whenever user remembers to open the app" today.

---

## 5. Gaps and Blockers

### Critical (must-have for continuous sync)

| Gap | Source | Effort | Notes |
|-----|--------|--------|-------|
| Scheduled sync job (node-cron) | WHOOP | Small | Core infrastructure; 1 new file |
| `whoop_sync_state` table + migration | WHOOP | Small | Track last sync per user |
| HKObserverQuery + background delivery | Apple | Medium | Core iOS change; ~100 lines |
| Background URLSession | Apple | Medium | Replace foreground URLSession.shared |
| HKAnchoredObjectQuery (delta sync) | Apple | Medium | Replace date-based queries with anchors |
| iOS background mode entitlements | Apple | Small | Info.plist + capabilities |

### Important (should-have)

| Gap | Source | Effort | Notes |
|-----|--------|--------|-------|
| Retry logic with backoff | Both | Medium | Backend: per-user retry. iOS: local queue |
| Sync failure monitoring | Both | Medium | Log table or external alerting |
| JWT → Keychain migration | Apple | Small | Security fix for background access |
| Source priority for overlapping metrics | Both | Small | Config: prefer WHOOP for recovery, Apple for HR |
| Graceful degradation on token revocation | WHOOP | Small | Mark user as disconnected, surface in UI |

### Nice-to-have (future)

| Gap | Source | Effort | Notes |
|-----|--------|--------|-------|
| WHOOP webhook receiver | WHOOP | Medium | Requires deployed HTTPS endpoint |
| Real-time dashboard updates (SSE/WS) | Both | Large | Push fresh data to frontend |
| Multi-device Apple Watch support | Apple | Small | Already handled by HealthKit aggregation |
| Sync health dashboard in frontend | Both | Medium | Show sync status, last pull, error states |

---

## 6. Recommended Sequence

**Phase 1 — WHOOP Continuous (Small, ~1-2 days):**
1. Add `whoop_sync_state` migration
2. Add `node-cron` dependency
3. Create `backend/src/jobs/whoopSyncJob.js`
4. Wire into server startup
5. Test with real token

**Phase 2 — Apple Watch Background (Medium, ~3-4 days):**
1. Add background mode capabilities
2. Implement `HKObserverQuery` + `enableBackgroundDelivery`
3. Switch to `HKAnchoredObjectQuery` for true deltas
4. Replace `URLSession.shared` with background session
5. Move JWT to Keychain
6. Test on physical device (simulators can't test background delivery)

**Phase 3 — Resilience (Medium, ~2 days):**
1. Retry logic for both paths
2. Sync state visibility in API/dashboard
3. Error alerting (even just console logs with structure)

---

## Decision

**Recommendation:** Start with Phase 1 (WHOOP scheduled sync). It's the highest value for the lowest effort — the token refresh already works, the sync function already supports delta queries, and we just need to call it on a schedule. Phase 2 requires iOS development and physical device testing, so it's a bigger lift.
