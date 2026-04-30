# Decision: Data Layer Bug Fixes

**Date:** 2026-04-30  
**By:** Wash (Backend Dev)

## What Changed

Fixed 6 data integrity bugs identified by River. Two were critical (wrong HRV comparisons, missing WHOOP baselines), four were important (token upsert, sleep date alignment, inline prepares, unit mixing).

## Key Decisions

### 1. Per-source baselines (no cross-comparison)

WHOOP RMSSD and Apple SDNN are different statistical methods. Each device's HRV is now compared only against its own historical baseline. The morning check-in API response nests by source:

```json
{
  "hrv": {
    "whoop": { "value": 45, "metric_type": "hrv_rmssd", "baseline_90d": 42, "delta_pct": 7.1 },
    "apple_watch": { "value": 62, "metric_type": "hrv_sdnn", "baseline_90d": 58, "delta_pct": 6.9 }
  }
}
```

### 2. Sleep date = "night of" (start_at date)

Both sources now use the date the user went to bed as `sleep_date`. Previously WHOOP used wake-up date, Apple used end-time date. This aligns device comparison queries.

### 3. Strain and active energy are separate

The old code divided kcal by 100 and summed with WHOOP strain (0–21 scale) — undocumented and misleading. These are now exposed as separate series: `strain.whoop` (0–21 score) and `strain.apple_active_energy` (kcal). If a combined load index is needed later, it should be explicitly designed with documented normalization.

### 4. WHOOP token table has UNIQUE(user_id)

Migration recreates the table with a UNIQUE constraint on `user_id` so `ON CONFLICT` upserts work correctly. Old duplicate tokens are discarded (keeps most recent).

## Frontend Impact

- Morning check-in response shape changed for `hrv` and `resting_hr` fields (nested by source)
- Trends `strain` field changed from `{ whoop, apple_load, rolling_7d_load }` to `{ whoop, apple_active_energy }`
- Kaylee will need to update the dashboard components to render per-source HRV/RHR
