# Unified Health Dashboard (MVP)

Full-stack MVP that ingests Apple Watch (via HealthKit companion iOS app) and WHOOP REST API v2 data, stores both sources side-by-side, computes Apple-based rolling baselines, and visualizes everything in a single dashboard.

## Stack
- Backend: Node.js + Express + SQLite
- Frontend: React (Vite) + Recharts
- iOS companion: SwiftUI + HealthKit
- Auth: JWT

## Repository structure
```text
backend/
  src/
    app.js
    server.js
    config.js
    db/
    migrations/
    middleware/
    routes/
    services/
frontend/
  src/
    api/
    components/
    views/
ios-companion/
  HealthSyncCompanion/
.env.example
README.md
```

## Data model summary
- `metric_records`: raw/time-series metrics with `user_id`, `source`, `metric_type`, `value`, `unit`, `recorded_at`
- `sleep_records`: normalized sleep sessions/stages + WHOOP sleep metadata
- `workout_records`: normalized workouts from both sources
- `derived_baselines`: stored Apple Watch rolling baselines (HRV 90d, resting HR 30d, sleep duration 90d)
- `whoop_tokens`, `apple_sync_state`, `users`

The schema preserves each source independently (never merged or overwritten) and includes indexes on `(user_id, source, metric_type, recorded_at)`.

## Environment variables
Copy `.env.example` to `.env` at repo root.

Required values:
- `WHOOP_CLIENT_ID`
- `WHOOP_CLIENT_SECRET`
- `WHOOP_REDIRECT_URI` (for Codespace/local use `http://localhost:3000/api/whoop/callback` or `http://localhost:3000/auth/whoop/callback`)
- `JWT_SECRET`
- `BACKEND_URL`
- `PORT`
- `DB_PATH`
- `FRONTEND_URL`

## WHOOP OAuth registration (developer.whoop.com)
1. Create a WHOOP developer app at `developer.whoop.com`.
2. Add redirect URI: `http://localhost:3000/api/whoop/callback` (or `/auth/whoop/callback`).
3. Copy client ID/secret into `.env`.
4. In the web app: login, click **Connect WHOOP**, complete OAuth, then click **Sync WHOOP**.

## Run in GitHub Codespaces
### 1) Backend
```bash
cd backend
npm install
npm run migrate
npm run dev
```
Backend runs on `http://localhost:3000`.

### 2) Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173` and proxies `/api` to the backend.

### 3) Initial workflow
1. Register an account in the dashboard (JWT returned).
2. Connect WHOOP and run sync.
3. Build/run the iOS companion app on iPhone and paste JWT + backend URL.
4. Tap **Sync Now** to send full historical Apple Health data in batches.

## API overview
### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### WHOOP
- `GET /api/whoop/connect` (auth required)
- `GET /api/whoop/callback`
- `POST /api/whoop/sync` (auth required)

### Apple Health ingest
- `POST /api/apple/ingest` (auth required; batched payload)

### Dashboard views
- `GET /api/dashboard/morning-checkin`
- `GET /api/dashboard/trends?range=7|30|90|180|all&source=apple_watch|whoop|both`
- `GET /api/dashboard/device-comparison?metric=sleep_duration|resting_hr&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/dashboard/workouts?source=apple_watch|whoop|both&from=YYYY-MM-DD&to=YYYY-MM-DD&sport=all|<sport>`

## Frontend views implemented
1. Morning Check-In (default)
2. Trends Dashboard
3. Device Comparison
4. Workout Log

## iOS companion app notes
- Uses Swift/SwiftUI and HealthKit read permissions.
- First sync is full history; subsequent syncs are incremental (`last_sync_at`).
- Uploads in batches of 500 records to `/api/apple/ingest`.
- **Simulator limitation:** HealthKit simulator data is not representative; test on physical iPhone.

## iOS signing + provisioning (Apple Developer account)
1. Open `ios-companion` in Xcode and add a new iOS App target if needed, then include files in `HealthSyncCompanion/`.
2. In Xcode: **Settings > Accounts** and sign in with your Apple Developer account.
3. In target **Signing & Capabilities**:
   - Enable **Automatically manage signing**
   - Choose your Team
   - Set a unique Bundle Identifier
   - Add **HealthKit** capability
4. Connect your iPhone, trust the machine, choose iPhone as run destination.
5. Build/run once to provision profile and verify Health permissions prompt appears.
6. For TestFlight distribution:
   - Archive in Xcode
   - Upload to App Store Connect
   - Add internal testers and install via TestFlight.

## Notes for extensibility
- Schema `source` values are extensible (`apple_watch`, `whoop`, future `oura`, `garmin`).
- New devices can be added as new ingestion modules writing to existing normalized tables.
- Tables already include `user_id` for future multi-user expansion and Postgres migration.

## Roadmap

### V1 (current)
- Apple Watch data (via iOS companion or file upload)
- WHOOP data (via OAuth API or file upload)
- Morning Check-In, Trends Dashboard, Device Comparison, Workout Log
- Rolling baselines (HRV 90d, RHR 30d, sleep 90d)

### V2 — Additional wearables & fertility tracking
- Oura Ring (upload/ingest support)
- Garmin (upload/ingest support)
- Fitbit (upload/ingest support)
- Natural Cycles (upload/ingest support)

### V3 — Lifestyle & body composition
- Smart scale integration (eufy Life — weight, body fat %, BMI, lean mass)
- MyFitnessPal (nutrition — calories, macros, meal logging)
- Perfectly Snug smart topper (sleep environment — bed temperature, surface data)
- Other health lifestyle apps (Peloton, Strong, SleepWatch, etc.)
- Body composition trends and correlation with recovery/performance

### Feature Backlog
- **Recovery Mode / Injury Pause** — User-activated mode for injury, surgery, illness, or any out-of-normal-routine period. While active: data is still tracked but excluded from baseline calculations, recommendations shift to recovery-focused guidance (not "ready to train"), insights acknowledge the abnormal period instead of flagging metrics as concerning. This addresses a real gap — neither WHOOP nor Apple Watch handle this today.
- **Apple Sign-In** (priority) — Core users have Apple Watches and Apple IDs. Required by App Store if any third-party sign-in is offered. Add as primary auth method.
- **Google Sign-In** (secondary) — For Android/Garmin/Fitbit users without Apple devices. Add alongside Apple Sign-In.
- **Device Placement Profiles** — Track where each device is worn (left/right wrist, bicep, ankle, finger) to contextualize metric deltas. A 4 bpm RHR difference is normal for dual-wrist placement but may indicate a problem for same-wrist devices. Supports WHOOP (wrist, bicep, ankle), Oura (specific finger), Apple Watch (wrist), Garmin (wrist).
- **Migrate SQLite → PostgreSQL** — Move from file-based SQLite to hosted Postgres (e.g., Supabase, RDS) for multi-device access, cloud deployment, concurrent users, and better scalability. Schema is already Postgres-compatible (`user_id` foreign keys, standard SQL types). Enables deploying the backend to any cloud host without disk persistence concerns.
- **Device Value Analysis** — "Which device is worth keeping?" Compares what unique data each device provides, what overlaps, and whether a subscription device (WHOOP ~$30/mo, Oura ~$6/mo) adds enough value over free alternatives (Apple Watch). Factors: unique metrics only that device provides, accuracy comparison on shared metrics, actionable insights each device enables, cost per unique insight. Helps users decide which subscriptions to keep or cancel.
- **AI Health Chat** — Conversational interface that can answer questions about your data across all devices. Unlike WHOOP's chatbot (WHOOP data only), HealthStitch AI sees all sources and can explain cross-device discrepancies, suggest optimizations, and provide personalized guidance based on your full health picture.
