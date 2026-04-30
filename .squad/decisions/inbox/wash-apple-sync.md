# Apple Watch Continuous Sync — Phase 2

**Date:** 2025-07-15  
**By:** Wash (Backend Developer)

## What Was Implemented

### iOS Companion App

1. **HKObserverQuery background delivery** — Registered observers for all 5 quantity types (HRV, resting HR, active energy, VO2max, respiratory rate), sleep analysis, and workouts. Using `.hourly` frequency.

2. **HKAnchoredObjectQuery for delta sync** — Replaces date-based queries for background sync. Anchors stored in UserDefaults per metric type. Only new samples since last anchor are fetched and uploaded.

3. **Background URLSession** — Created a persistent background upload session (`com.healthstitch.companion.upload`) that survives app suspension. Uploads POST to `/api/apple/ingest`.

4. **JWT moved to Keychain** — Auth token now stored via `KeychainHelper` using `kSecAttrAccessibleAfterFirstUnlock` (available even when device is locked). One-time migration from UserDefaults on app launch.

5. **BGAppRefreshTask fallback** — Registered `com.healthstitch.companion.refresh`. Fires if no background delivery has occurred in 2+ hours. Performs a full delta sync from last known timestamp.

### Backend

6. **Enhanced `apple_sync_state` table** — Added columns: `last_sync_status`, `metric_counts_json`, `consecutive_failures`, `last_error` (migration 004).

7. **`GET /api/apple/sync-status` endpoint** — Returns sync freshness including staleness_minutes, status, metric counts, and failure state. Authenticated.

## Key Decisions

- **Anchors in UserDefaults, JWT in Keychain** — Anchors aren't secrets and UserDefaults is fine for them. JWT is sensitive and needs Keychain for background access.
- **Hourly frequency** — iOS minimum for background delivery. Actual delivery may be faster depending on system budget.
- **BGAppRefreshTask as insurance** — Observer queries can silently stop in some iOS versions. The refresh task catches gaps.
- **Foreground manual sync unchanged** — Still uses date-based queries for the "Sync Now" button. Background uses anchored queries independently.

## Files Changed

- `ios-companion/HealthSyncCompanion/BackgroundSyncManager.swift` (new)
- `ios-companion/HealthSyncCompanion/KeychainHelper.swift` (new)
- `ios-companion/HealthSyncCompanion/HealthSyncCompanionApp.swift` (updated — AppDelegate, background session handler)
- `ios-companion/HealthSyncCompanion/ContentView.swift` (updated — Keychain-backed JWT)
- `ios-companion/HealthSyncCompanion/Info.plist` (updated — UIBackgroundModes, BGTaskSchedulerPermittedIdentifiers)
- `backend/src/routes/appleRoutes.js` (updated — sync-status endpoint, enhanced upsert)
- `backend/src/migrations/004_apple_sync_state_enhance.sql` (new)

## Testing Notes

- Background delivery requires a physical device — cannot be tested in Simulator
- BGAppRefreshTask can be triggered in debugger via `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.healthstitch.companion.refresh"]`
- Backend verified: `node -e "require('./src/app')"` passes
