# Scoping: PostgreSQL Migration + TestFlight Configuration

**Author:** Wash (Backend Dev)  
**Date:** 2025-07-15  
**Status:** Scoping — awaiting decision

---

## 1. PostgreSQL Migration

### Current State

The backend uses **better-sqlite3** (synchronous API) with:
- 1 client module (`db/client.js`) — 12 lines, creates DB + sets PRAGMAs
- 1 migration runner (`db/migrate.js`) — reads `.sql` files, tracks in `schema_migrations`
- 6 migration SQL files defining 7 tables + ~15 indexes
- **~45 prepared statements** across 4 route files and 5 service files
- 3 services use `db.transaction()` (ingestService, baselineService, aggregateService)

### SQLite-Specific Syntax Inventory

| Pattern | Count | Postgres Equivalent |
|---------|-------|-------------------|
| `datetime('now')` in DDL defaults | 8 | `NOW()` or `CURRENT_TIMESTAMP` |
| `date(column)` in queries (expression) | ~20 | `column::date` or `DATE(column)` — works as-is in PG |
| `date(?, '-N days')` arithmetic | 2 | `?::date - INTERVAL 'N days'` |
| `ON CONFLICT(...) DO UPDATE` | 5 | Same syntax — PG supports this ✓ |
| `INSERT OR IGNORE` | 3 | `INSERT ... ON CONFLICT DO NOTHING` |
| `PRAGMA journal_mode/foreign_keys` | 2 | Not needed in PG (WAL is default, FKs always enforced) |
| `INTEGER PRIMARY KEY` | 0 | N/A — all PKs are TEXT UUIDs ✓ |
| Partial indexes (`WHERE external_id IS NOT NULL`) | 3 | Supported in PG ✓ |
| Expression indexes (`date(column)`) | 4 | Supported but syntax is `CREATE INDEX ... ON tbl ((column::date))` |
| `CHECK(...)` constraints | 2 | Same syntax ✓ |
| `db.prepare().run/get/all()` (synchronous) | 45 | Must become async (`pool.query()`) |
| `db.transaction(() => {...})` | 3 | Must become `BEGIN/COMMIT` with async client |

### Key Architectural Concern

**The big difference is sync vs. async.** better-sqlite3 is fully synchronous — every `stmt.run()` and `stmt.get()` returns immediately. PostgreSQL drivers (pg, node-postgres) are async. This means:
- Every route handler and service function touching the DB must become `async`
- Prepared statement caching at module level (currently done everywhere) won't work the same way — PG prepared statements are per-connection
- Transactions require holding a single client from the pool

### Approach Options

#### Option A: Direct rewrite (better-sqlite3 → pg)

Replace the `db/client.js` module with a `pg.Pool`, rewrite all queries.

**Effort:** ~2-3 days  
**Pros:** No new dependencies beyond `pg`. Full control. Clean result.  
**Cons:** Every file that touches DB needs async/await added. ~45 query sites to update. Expression indexes need syntax adjustment. `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`. `datetime('now')` → `NOW()`. Date arithmetic needs rewrite.

**Files to modify:**
- `db/client.js` — full rewrite (Pool export)
- `db/migrate.js` — rewrite to use async pool
- All 6 `.sql` migration files — syntax adjustments
- `routes/authRoutes.js` — 3 queries → async
- `routes/appleRoutes.js` — 2 queries → async
- `routes/whoopRoutes.js` — 0 direct queries (delegates to whoopService)
- `routes/dashboardRoutes.js` — ~20 queries → async (heaviest file)
- `services/ingestService.js` — 3 transactions → async
- `services/whoopService.js` — 2 queries → async
- `services/whoop-scheduler.js` — 3 queries → async
- `services/aggregateService.js` — ~8 queries → async
- `services/baselineService.js` — 3 queries + 1 transaction → async

#### Option B: Knex.js query builder

Add Knex as an abstraction layer. Rewrite raw SQL into Knex's chainable API.

**Effort:** ~3-4 days  
**Pros:** DB-agnostic (could switch back to SQLite for tests). Built-in migration system. Connection pooling handled.  
**Cons:** Larger rewrite — 45 raw SQL queries need complete rewrite into Knex's API. Adds dependency. Expression indexes and complex GROUP BY queries are awkward in Knex. Knex migrations would replace our current system.

**Not recommended.** The codebase has complex analytical queries (dashboard trends, device comparisons, rolling averages) that are cleaner as raw SQL. Knex would obscure them for no real gain.

#### Option C: Drizzle ORM

Type-safe ORM with schema-as-code.

**Effort:** ~4-5 days  
**Pros:** Type safety, schema declarations, migrations generated from schema diffs.  
**Cons:** This is a plain JS project (no TypeScript) — Drizzle's main value prop is wasted. Would need to add TypeScript or lose the point. Much larger refactor than needed.

**Not recommended** for this project's current stack.

#### Option D: Thin async wrapper (Recommended)

Replace `db/client.js` with a module exporting a `pg.Pool` plus a thin helper that mimics the better-sqlite3 API shape:

```js
// db/client.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(), // for transactions
  pool,
};
```

Then create helper functions:
```js
// Usage: const row = await db.queryOne('SELECT ...', [params])
// Usage: const rows = await db.queryAll('SELECT ...', [params])
// Usage: await db.run('INSERT ...', [params])
```

**Effort:** ~2 days  
**Pros:** Minimal abstraction. Queries stay as raw SQL (just swap `?` → `$1, $2...`). No big framework. Easy to understand.  
**Cons:** Still need to make everything async. Placeholder syntax change (`?` → `$1`).

### Recommended Approach: Option D

**Migration plan:**
1. Install `pg` package
2. Rewrite `db/client.js` to export pool + helpers
3. Rewrite `db/migrate.js` to run async
4. Port all 6 `.sql` migrations to PostgreSQL syntax
5. Convert each service/route file to async (one at a time, test after each)
6. Update `config.js` to read `DATABASE_URL` env var
7. Add a `scripts/pg-setup.sh` for local Postgres initialization

**Syntax changes cheat sheet:**
- `?` → `$1, $2, $3...`
- `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- `datetime('now')` → `NOW()`
- `date(col, '-N days')` → `col::date - INTERVAL 'N days'`
- `date(col)` → `col::date` (or keep `DATE(col)` — both work)
- Remove PRAGMAs
- Expression indexes: `CREATE INDEX idx ON tbl ((col::date))`

### iOS Companion App Impact

**None.** The iOS app communicates via HTTP to `/api/apple/ingest` and `/api/auth/*`. It has no awareness of the database layer. The `backendURL` is already configurable in the app UI. No changes needed.

### Network Configuration (Mac Mini)

For multi-device access to Postgres on the Mac Mini:

1. **postgresql.conf:** `listen_addresses = '*'` (or specific LAN subnet)
2. **pg_hba.conf:** Add `host all all 192.168.x.0/24 scram-sha-256`
3. **macOS firewall:** Allow port 5432 inbound
4. **Backend .env:** `DATABASE_URL=postgresql://healthstitch:password@localhost:5432/healthstitch`
5. For remote clients (WHOOP scheduler on another machine): use the Mac Mini's LAN IP in their `DATABASE_URL`

### Data Migration

Existing SQLite data needs a one-time export/import:
- Write a `scripts/migrate-sqlite-to-pg.js` that reads all tables from SQLite and bulk-inserts into Postgres
- Or use `pgloader` (one command: `pgloader health_dashboard.sqlite postgresql:///healthstitch`)

---

## 2. TestFlight Configuration

### Current iOS Project State

- **Structure:** Single-target SwiftUI app at `ios-companion/HealthSyncCompanion/`
- **No `.xcodeproj` found in the repo** — likely uses Swift Package Manager or hasn't been committed
- **Info.plist:** Present, declares HealthKit usage + background modes
- **Bundle ID:** Uses `$(PRODUCT_BUNDLE_IDENTIFIER)` placeholder — set in Xcode project settings
- **Version:** 1.0 (1)
- **Capabilities already declared:** HealthKit read/write, Background Fetch, Background Processing
- **No build schemes or xcconfig files** in the repo

### What Shari Needs to Do (Manual — Xcode/App Store Connect)

#### App Store Connect Setup
1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new App record:
   - Platform: iOS
   - Name: "HealthSync Companion" (or similar)
   - Bundle ID: Register in Developer portal first (e.g., `com.healthstitch.companion`)
   - SKU: `healthsync-companion`
   - Primary Language: English
3. Accept any agreements (Paid Apps agreement even for free/TestFlight-only)

#### Xcode Project Configuration
1. **Team:** Select your Apple Developer team in Signing & Capabilities
2. **Bundle Identifier:** Set to match what you registered (e.g., `com.healthstitch.companion`)
3. **Signing:** Enable "Automatically manage signing"
4. **Capabilities tab — verify:**
   - HealthKit (already in Info.plist)
   - Background Modes: Background fetch + Background processing (already in Info.plist)
5. **Deployment target:** Set minimum iOS version (recommend iOS 16+)
6. **Build number:** Must increment for each TestFlight upload

#### TestFlight Upload Steps
1. In Xcode: Product → Archive (select "Any iOS Device" as destination)
2. In Organizer: Distribute App → App Store Connect → Upload
3. Wait for Apple's processing (~15-30 min)
4. In App Store Connect → TestFlight: Add internal testers (your Apple ID)
5. Accept compliance/encryption questions (HealthStitch uses HTTPS only — select "Yes, but only standard encryption")

### What We Can Pre-Configure in the Codebase

#### 1. Environment-based Backend URL

The app currently uses `@AppStorage("backend_url")` with a `localhost:3000` default. For TestFlight, it needs to hit the Mac Mini's real address.

**Recommended:** Add a build-time configuration so TestFlight builds default to the LAN address:

```swift
// Configuration.swift
enum AppConfig {
    #if DEBUG
    static let defaultBackendURL = "http://localhost:3000/"
    #else
    static let defaultBackendURL = "http://192.168.x.x:3000/"  // Mac Mini LAN IP
    #endif
}
```

Then in ContentView: `@AppStorage("backend_url") private var backendURLString = AppConfig.defaultBackendURL`

#### 2. Build Schemes

Create two schemes in the Xcode project:
- **Debug** — hits localhost, for simulator development
- **Release** — hits Mac Mini IP, used for Archive → TestFlight

#### 3. Xcode Cloud / CI (Optional)

Not needed for initial TestFlight — Shari can archive manually. But if desired later, an `xcodebuild` script could automate this.

#### 4. Version Bumping

Add a `scripts/bump-ios-version.sh` that increments `CFBundleVersion` in Info.plist (required before each TestFlight upload).

### Network Requirement: TestFlight ↔ Backend

**Critical:** A TestFlight build on a physical iPhone cannot reach `localhost`. Options:

| Option | Pros | Cons |
|--------|------|------|
| **Mac Mini LAN IP** (e.g., `192.168.1.50:3000`) | Simple, free, fast | Only works on same WiFi network. iPhone must be on same LAN. |
| **Tailscale/ZeroTier VPN** | Works from anywhere, secure, free tier | Requires Tailscale on both devices. Adds IP that changes. |
| **Cloudflare Tunnel** | Public URL, HTTPS, free | Requires `cloudflared` daemon on Mac Mini. More moving parts. |
| **Static LAN IP + mDNS** | `macmini.local:3000` — human-readable | Only works on LAN. mDNS can be flaky. |

**Recommendation:** Start with **Mac Mini static LAN IP**. Assign a static IP via router DHCP reservation. Set that in the Release build config. If Shari needs access outside home, add Tailscale later.

### App Transport Security (ATS)

iOS blocks plain HTTP by default. Since the Mac Mini is on LAN (not HTTPS), we need an ATS exception in Info.plist:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

This allows HTTP to LAN addresses without disabling ATS globally. **Already sufficient for LAN-only use.**

If using a tunnel with HTTPS, this isn't needed.

### Files We Should Add/Modify

| File | Change |
|------|--------|
| `ios-companion/HealthSyncCompanion/Configuration.swift` | New — build-time URL defaults |
| `ios-companion/HealthSyncCompanion/ContentView.swift` | Use `AppConfig.defaultBackendURL` |
| `ios-companion/HealthSyncCompanion/Info.plist` | Add `NSAllowsLocalNetworking` ATS exception |
| `scripts/bump-ios-version.sh` | New — increment build number |

---

## Summary & Effort Estimates

| Task | Approach | Effort | Risk |
|------|----------|--------|------|
| PostgreSQL migration | Option D (thin async wrapper) | **2 days** | Medium — async conversion touches every file |
| Data migration script | pgloader or custom script | **2 hours** | Low |
| Postgres network config | pg_hba.conf + firewall | **30 min** | Low |
| TestFlight codebase prep | Config + ATS + scripts | **2 hours** | Low |
| TestFlight manual steps | Shari does in Xcode/ASC | **1 hour** | Low (just following steps) |

**Total engineering effort:** ~2.5 days

### Recommended Execution Order
1. PostgreSQL migration (unblocks multi-device)
2. TestFlight codebase prep (can be done in parallel)
3. Shari does TestFlight manual steps
4. Verify iOS app connects to backend over LAN
