# HealthStitch Phase 1: "The Coach" — Implementation Plan

> **Status:** Draft — awaiting approval
> **Squad routing:** Mal (arch) → River (methodology) → Wash (impl) → Zoe (tests)
> **Research:** See `research.md` sections 8, 9, 12, 17

---

## Goal

Build WHOOP-equivalent coaching intelligence on top of Apple Watch HealthKit data, with scientifically superior methodology where WHOOP has documented flaws.

## Features

1. **Recovery Score** (0–100, green/yellow/red)
2. **Exertion Score** (per-workout + daily)
3. **Smart Sleep Need** (corrected nap model)
4. **Morning Briefing** (API endpoint)
5. **Multi-device source priority** (deduplication layer)

---

## Capability Assessment

### What the squad CAN build (Wash + River)
- ✅ All algorithm implementations (TRIMP, RMSSD derivation, Gompertz, nap credit)
- ✅ New Postgres migrations, services, routes following existing patterns
- ✅ Baseline computation enhancements (already have `baselineService.js` pattern)
- ✅ Aggregate/rollup tables (already have `aggregateService.js` pattern)
- ✅ Multi-source deduplication queries
- ✅ REST API endpoints for morning briefing
- ✅ Data quality flags and confidence indicators

### Limitations to note
- ⚠️ **RMSSD from Apple Watch** requires raw IBIs via `HKHeartbeatSeriesQuery` — the iOS companion app must be updated to capture and upload these. I can write the Swift code but can't build/test it on a simulator from this environment.
- ⚠️ **Until raw IBIs are available**, Recovery Score falls back to SDNN-based scoring (less ideal but functional). SDNN is already being ingested.
- ⚠️ **Day strain (non-workout)** is limited by Apple Watch's ~5-min background HR sampling. Workout strain is accurate (~1Hz). We should be honest about this in the API response.
- ⚠️ **Lean body mass** for future age scoring requires smart scale or manual entry — no passive measurement.
- ⚠️ **ML model training** is not possible — all scoring uses formula-based approaches (which is what WHOOP actually does per the patents).

---

## Architecture (Mal's domain)

### New tables

```sql
-- Computed daily scores
CREATE TABLE computed_daily_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  score_date DATE NOT NULL,
  recovery_score DOUBLE PRECISION,        -- 0-100
  recovery_zone TEXT,                      -- green/yellow/red
  exertion_score DOUBLE PRECISION,         -- 0-100 (daily total)
  sleep_need_ms BIGINT,                    -- circadian need in ms
  fatigue_reduction_ms BIGINT,             -- nap credit (partial, not 1:1)
  adjusted_sleep_need_ms BIGINT,           -- need after fatigue reduction
  sleep_debt_ms BIGINT,                    -- accumulated debt
  data_quality_json TEXT,                  -- flags per metric
  inputs_json TEXT,                        -- raw inputs used for transparency
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_daily_scores_unique
  ON computed_daily_scores(user_id, score_date);

-- Per-workout exertion scores
CREATE TABLE computed_workout_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  trimp_score DOUBLE PRECISION,            -- Banister TRIMP
  exertion_score DOUBLE PRECISION,         -- normalized 0-100
  hr_zone_json TEXT,                       -- time in each zone
  data_quality TEXT,                       -- reliable/degraded/unreliable
  data_quality_reason TEXT,                -- why degraded (e.g., "strength training")
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (workout_id) REFERENCES workout_records(id)
);

CREATE UNIQUE INDEX idx_workout_scores_unique
  ON computed_workout_scores(user_id, workout_id);

-- Nap records (separate from sleep_records)
CREATE TABLE nap_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  nap_date DATE NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  duration_ms BIGINT NOT NULL,
  deep_ms BIGINT,
  rem_ms BIGINT,
  light_ms BIGINT,
  credit_ms BIGINT,                        -- stage-weighted partial credit
  credit_method TEXT NOT NULL DEFAULT 'stage_weighted',
  time_of_day_modifier DOUBLE PRECISION,   -- 0.0-0.5 based on nap timing
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_nap_dedupe
  ON nap_records(user_id, source, nap_date, start_at, end_at);

-- Source priority configuration
CREATE TABLE source_priority (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,               -- e.g., 'sleep', 'workout_hr', 'hrv', 'steps'
  priority_json TEXT NOT NULL,             -- ordered array: ["oura", "whoop", "apple_watch", "garmin"]
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_source_priority_unique
  ON source_priority(user_id, metric_type);
```

### New services

```
backend/src/services/
  recoveryService.js      -- Recovery Score computation
  exertionService.js      -- TRIMP + Exertion Score
  sleepNeedService.js     -- Smart Sleep Need + nap credit
  morningBriefingService.js -- Aggregates all scores into briefing
  sourcePriorityService.js -- Multi-device deduplication
```

### New routes

```
GET  /api/scores/daily/:date        -- Recovery, exertion, sleep need for a date
GET  /api/scores/briefing           -- Morning briefing (today's scores + recommendations)
GET  /api/scores/workout/:id        -- Per-workout exertion details
GET  /api/scores/trends             -- Score trends over time
POST /api/settings/source-priority  -- Update source priority per metric
GET  /api/settings/source-priority  -- Get current priorities
```

---

## Feature 1: Recovery Score (River's methodology + Wash's implementation)

### Algorithm: RMSSD-based recovery (SDNN fallback)

```
Inputs:
  - HRV (RMSSD preferred, SDNN fallback) from last night's sleep
  - Resting heart rate from last night
  - Sleep efficiency (time asleep / time in bed)
  - SWS % (deep sleep / total sleep)
  - 7-day rolling baselines for HRV and RHR

Computation:
  1. hrv_delta = (hrv_today - baseline_7d) / baseline_7d
  2. rhr_delta = (baseline_7d - rhr_today) / baseline_7d  // inverted: lower is better
  3. sleep_efficiency_score = sleep_efficiency * 100        // 0-100
  4. sws_score = min(sws_pct / 0.20, 1.0) * 100           // 20% SWS = perfect

  Weighted combination:
    recovery = (hrv_delta_score * 0.35) + (rhr_delta_score * 0.25) +
               (sleep_efficiency_score * 0.25) + (sws_score * 0.15)

  Normalize to 0-100, clamp.

Zones:
  green:  67-100
  yellow: 34-66
  red:    0-33

Data quality flags:
  - "hrv_method": "rmssd" | "sdnn_fallback"
  - "missing_inputs": ["sws"] if deep sleep data unavailable
  - "confidence": "high" | "medium" | "low"
```

### River's domain rules
- RMSSD and SDNN are NEVER mixed in the same baseline window
- If source switches mid-baseline, reset the baseline
- Flag when SDNN is used as fallback so users know
- 7-day baseline requires minimum 4 of 7 nights with data

---

## Feature 2: Exertion Score (River's methodology + Wash's implementation)

### Algorithm: Banister TRIMP (no patent risk)

```
Per-workout:
  For each HR sample during workout (from workout_records.hr_zone_json or metric_records):
    hrr = (hr - rhr) / (max_hr - rhr)
    trimp_sample = duration_seconds * hrr * e^(1.92 * hrr)
    // Sum all samples

  trimp_total = Σ trimp_sample

  Normalize to 0-100:
    exertion = min(trimp_total / personal_max_trimp, 1.0) * 100
    // personal_max_trimp = 90th percentile of user's historical TRIMP scores

Daily:
  day_exertion = sum of all workout exertion scores for the day
  // Capped at 100

Max HR estimation:
  1. User-provided (best)
  2. Observed max from historical workout data (good)
  3. Tanaka formula: 208 - (0.7 * age) (fallback — better than 220-age)

Data quality flags:
  - sport_type in ["strength_training", "functional_fitness", "yoga"]:
      quality = "degraded"
      reason = "HR-based scoring underestimates non-cardiovascular exertion"
  - If avg_hr is suspiciously low for sport_type:
      quality = "unreliable"
      reason = "Possible optical HR dropout during high-intensity exercise"
```

---

## Feature 3: Smart Sleep Need (River's methodology + Wash's implementation)

### Algorithm: Circadian need + stage-weighted nap credit

```
Base sleep need:
  - Default: 7.5 hours (adjustable per user)
  - Age-adjusted: slightly higher for <25, slightly lower for >65

Sleep debt accumulation:
  debt = Σ (need - actual_sleep) over trailing 7 days
  // Debt only accumulates from nighttime sleep shortfall

Nap credit (NOT 1:1):
  For each nap detected (sleep_record where start_at is between 10am-8pm):

  Stage-weighted credit:
    sws_credit = nap.deep_ms * 0.60      // 60% credit for deep sleep
    rem_credit = nap.rem_ms * 0.05        // 5% credit (virtually none in afternoon naps)
    light_credit = nap.light_ms * 0.35    // 35% credit for light sleep
    stage_credit = sws_credit + rem_credit + light_credit

  Time-of-day modifier:
    if nap between 12pm-2pm:  modifier = 0.50   // best nap window
    if nap between 2pm-4pm:   modifier = 0.35
    if nap between 4pm-6pm:   modifier = 0.20   // disrupts nighttime sleep
    if nap after 6pm:         modifier = 0.00   // harmful, no credit
    if nap before 12pm:       modifier = 0.40   // morning nap, moderate credit

  final_credit = stage_credit * modifier

  // A 2-hour nap at 2pm with typical staging:
  // deep: 30min, rem: 5min, light: 85min
  // credit = (30*0.6 + 5*0.05 + 85*0.35) * 0.35 = (18 + 0.25 + 29.75) * 0.35 = 16.8 min
  // vs WHOOP's 120 min (1:1 credit)

Nap detection:
  Any sleep_record where:
    - start_at hour is between 10:00 and 20:00
    - duration < 3 hours
  → classify as nap, move to nap_records table

Tonight's adjusted need:
  adjusted_need = base_need + (debt_penalty * 0.5) - nap_fatigue_credit
  // debt_penalty: extra time needed to pay down debt (capped at +90 min)
  // nap_fatigue_credit: reduces fatigue but NOT below base_need

  Display to user:
    "Your body needs 7h 30m of sleep tonight."
    "Your nap reduced fatigue by 17 minutes, but your circadian minimum remains 7h 30m."
    "You have 45 minutes of accumulated sleep debt from this week."
```

---

## Feature 4: Morning Briefing (Wash's implementation)

### API: `GET /api/scores/briefing`

```json
{
  "date": "2026-05-06",
  "recovery": {
    "score": 72,
    "zone": "yellow",
    "inputs": {
      "hrv": { "value": 45, "method": "sdnn_fallback", "baseline_7d": 48, "delta_pct": -6.3 },
      "rhr": { "value": 58, "baseline_7d": 56, "delta_pct": 3.6 },
      "sleep_efficiency": 0.85,
      "sws_pct": 0.18
    },
    "confidence": "medium",
    "flags": ["Using SDNN (Apple Watch). RMSSD preferred — enable raw IBI sync for better accuracy."]
  },
  "exertion": {
    "yesterday": 64,
    "week_total": 312,
    "week_avg": 52
  },
  "sleep": {
    "last_night": {
      "duration_ms": 24120000,
      "efficiency": 0.85,
      "source": "apple_watch"
    },
    "tonight_need_ms": 27000000,
    "sleep_debt_ms": 2700000,
    "nap_credit_ms": 0,
    "message": "You slept 6h 42m last night (85% efficiency). You need 7h 30m tonight. You have 45 min of accumulated sleep debt."
  },
  "recommendation": {
    "intensity": "moderate",
    "message": "Recovery is yellow. Moderate intensity recommended today. Focus on sleep tonight — you haven't met your sleep need in 3 days."
  },
  "data_quality": {
    "overall": "good",
    "flags": [
      "HRV uses SDNN (Apple Watch default). For RMSSD-based recovery, enable raw IBI sync."
    ]
  }
}
```

---

## Feature 5: Multi-Device Source Priority (River's methodology + Wash's implementation)

### Default priority chains (from research.md)

```javascript
const DEFAULT_PRIORITIES = {
  sleep:          ['oura', 'whoop', 'garmin', 'apple_watch'],
  hrv:            ['whoop', 'oura', 'garmin', 'apple_watch'],
  resting_hr:     ['whoop', 'oura', 'garmin', 'apple_watch'],
  workout_hr:     ['garmin', 'apple_watch', 'whoop', 'oura'],
  gps_distance:   ['garmin', 'apple_watch'],
  steps:          ['garmin', 'apple_watch', 'oura'],
  spo2:           ['oura', 'whoop', 'garmin', 'apple_watch'],
  skin_temp:      ['oura', 'whoop', 'apple_watch', 'garmin'],
  stress:         ['garmin', 'oura', 'whoop'],
  ecg:            ['apple_watch'],
  respiratory:    ['oura', 'whoop', 'garmin', 'apple_watch'],
};
```

### Deduplication logic

```
For each metric on a given date:
  1. Query all sources that have data for that date
  2. Pick the highest-priority source that has data
  3. Return that source's data with `preferred_source` and `available_sources` metadata
  4. If user has overridden priority, use their config from source_priority table
```

### Data quality overlay

```
For each metric, flag quality:
  - workout_hr from apple_watch during sport_type "strength_training" → "degraded"
  - hrv from apple_watch → "sdnn_method" (not RMSSD)
  - sleep from apple_watch → "deep_sleep_may_be_underestimated" (Robbins study: -43 min)
  - hrv from any device on a night with <4 hours sleep → "insufficient_sleep_window"
```

---

## Implementation Order

| Phase | What | Who | Depends On |
|-------|------|-----|-----------|
| 1a | Migration: `computed_daily_scores`, `computed_workout_scores`, `nap_records`, `source_priority` | Wash | — |
| 1b | `sourcePriorityService.js` + default priorities | Wash + River | 1a |
| 1c | `exertionService.js` (Banister TRIMP) | Wash + River | 1a |
| 1d | `sleepNeedService.js` (nap detection + credit) | Wash + River | 1a |
| 1e | `recoveryService.js` (SDNN-based initially) | Wash + River | 1a, 1b, 1c, 1d |
| 2a | `morningBriefingService.js` | Wash | 1b-1e |
| 2b | API routes for scores + briefing | Wash | 2a |
| 2c | Cron job to compute daily scores | Wash | 2a |
| 3 | Tests | Zoe | 2b |

---

## Files to Create

```
backend/src/migrations/006_computed_scores.sql
backend/src/services/recoveryService.js
backend/src/services/exertionService.js
backend/src/services/sleepNeedService.js
backend/src/services/morningBriefingService.js
backend/src/services/sourcePriorityService.js
backend/src/routes/scoresRoutes.js
```

## Files to Modify

```
backend/src/app.js                    -- register new routes
backend/src/services/ingestService.js -- nap detection on sleep ingest
```

---

## Todo List

- [ ] 1a: Write migration 006_computed_scores.sql
- [ ] 1b: Implement sourcePriorityService.js
- [ ] 1c: Implement exertionService.js (Banister TRIMP)
- [ ] 1d: Implement sleepNeedService.js (nap detection + stage-weighted credit)
- [ ] 1e: Implement recoveryService.js (SDNN-based, RMSSD-ready)
- [ ] 2a: Implement morningBriefingService.js
- [ ] 2b: Implement scoresRoutes.js (API endpoints)
- [ ] 2c: Add cron job for daily score computation
- [ ] 2d: Wire routes into app.js
- [ ] 3: Tests (Zoe)
