# HealthStitch — Data Flow Architecture

> Multi-device health data aggregator stitching WHOOP and Apple Watch metrics with per-source baselines.

## Platform Summary

| Layer | Service |
|-------|---------|
| **Backend Hosting** | Home server (Node.js + Express, `192.168.0.3`) |
| **Frontend Hosting** | Home server (React + Vite, `localhost:5173`) |
| **Remote Access** | Cloudflare Tunnel (`*.trycloudflare.com`) |
| **Database** | PostgreSQL (local, `192.168.0.3:5432`, db: `sleepdata`) |
| **Auth** | JWT (bcryptjs, 7-day expiry) |
| **Wearable APIs** | WHOOP REST API v2 (OAuth 2.0) |
| **Mobile Companion** | iOS SwiftUI app → Apple HealthKit |
| **File Uploads** | Local disk (`/backend/uploads/`, auto-cleanup) |
| **Background Jobs** | node-cron (WHOOP sync every 30min, daily scores at 6AM UTC) |
| **Cloud Storage** | None (all local) |
| **Analytics** | None |

## Data Flow

```mermaid
flowchart TB
    subgraph Devices["⌚ Wearable Devices"]
        WHOOP["WHOOP Band\n• HRV (RMSSD)\n• Strain (0-21)\n• Sleep stages\n• Recovery score"]
        Apple["Apple Watch\n• HRV (SDNN)\n• Active energy (kcal)\n• VO2 Max\n• Sleep stages"]
    end

    subgraph iPhone["📱 iOS Companion App"]
        HK["Apple HealthKit\n(on-device)"]
        Swift["SwiftUI App\nbatch ingest (500 records)"]
    end

    subgraph HomeServer["🏠 Home Server (192.168.0.3)"]
        Backend["Express Backend\nNode.js :3000"]
        Frontend["React + Vite\nDashboard :5173"]
        Cron["node-cron\n• WHOOP sync (30min)\n• Daily scores (6AM)"]
        Uploads["Local Disk\n/backend/uploads/\n(CSV/XML, auto-cleanup)"]
        PG["PostgreSQL :5432\n• metric_records\n• sleep_records\n• workout_records\n• derived_baselines\n• whoop_tokens\n• apple_sync_state\n• recovery_periods"]
    end

    subgraph Cloud["☁️ Cloud Services"]
        WHOOPAPI["WHOOP API v2\napi.prod.whoop.com\n• /recovery\n• /activity/sleep\n• /cycle\n• /activity/workout"]
        CF["Cloudflare Tunnel\nRemote access\n(optional)"]
    end

    WHOOP -->|"syncs to\nWHOOP cloud"| WHOOPAPI
    Apple -->|"writes to"| HK
    HK -->|"batch read"| Swift
    Swift -->|"POST /api/apple/ingest\n(HTTPS, batches of 500)"| Backend

    Cron -->|"every 30min\nOAuth 2.0"| WHOOPAPI
    WHOOPAPI -->|"recovery, sleep,\nstrain, workouts"| Backend
    Backend -->|"store + compute\nper-source baselines"| PG

    Backend -->|"CSV/XML upload\nparse + import"| Uploads
    Uploads -->|"parsed records"| PG

    Frontend <-->|"JWT auth\ndashboard queries"| Backend
    CF -.->|"remote access\n(optional)"| Frontend

    style Devices fill:#fce4ec,stroke:#E91E63
    style iPhone fill:#e8f4fd,stroke:#2196F3
    style HomeServer fill:#e8f5e9,stroke:#4CAF50
    style Cloud fill:#fff3e0,stroke:#FF9800
```

## Key Data Flows

1. **WHOOP Sync**: WHOOP band → WHOOP Cloud → cron (30min) → OAuth API → PostgreSQL (per-source HRV baseline)
2. **Apple Watch Sync**: Apple Watch → HealthKit → iOS app → `POST /api/apple/ingest` → PostgreSQL (per-source HRV baseline)
3. **File Import**: User uploads WHOOP CSV or Apple Health XML → parsed → PostgreSQL
4. **Dashboard**: React frontend → JWT auth → Express API → PostgreSQL queries + derived baselines
5. **Remote Access**: Cloudflare Tunnel exposes dashboard externally (optional)

## Per-Source Baseline Logic

WHOOP RMSSD and Apple SDNN are **different statistical methods** — each device's HRV is compared only against its own 90-day rolling baseline. Morning check-in nests by source:

```json
{
  "hrv": {
    "whoop": { "value": 45, "metric_type": "hrv_rmssd", "baseline_90d": 42, "delta_pct": 7.1 },
    "apple_watch": { "value": 62, "metric_type": "hrv_sdnn", "baseline_90d": 58, "delta_pct": 6.9 }
  }
}
```
