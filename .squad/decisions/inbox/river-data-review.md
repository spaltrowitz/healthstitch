# Decision: Data Layer Review Findings

**Author:** River (Data Engineer)
**Date:** 2025-01-30
**Status:** Proposed

## Context

Comprehensive review of the entire data layer: schema, ingestion, analytics, data quality, statistical methodology, and performance.

## Findings

### 🔴 Critical

1. **HRV baseline mismatch in morning check-in** — The morning check-in endpoint compares today's WHOOP HRV (RMSSD metric, `hrv_rmssd`) against the Apple Watch baseline (`hrv_sdnn`, 90-day rolling average). SDNN and RMSSD are different statistical measures of HRV and are NOT directly comparable. RMSSD typically reads lower than SDNN. The `pctDelta()` calculation on line 122 of `dashboardRoutes.js` will produce a misleading negative delta when WHOOP data is used against an Apple baseline. The fallback logic (`todayHrv = todayWhoopHrv ?? todayAppleHrv`) silently switches the underlying metric without adjusting the comparison.

2. **Baselines only computed for Apple Watch** — `baselineService.js` hardcodes `source = 'apple_watch'` for all baseline computations. If a user only has WHOOP connected (no Apple Watch), they get zero baselines and the morning check-in deltas are all null. This is a product gap that should be intentional or addressed.

### 🟡 Important

3. **Sleep record duplication risk from Apple Watch** — The iOS companion sends every `HKCategorySample` of type `.sleepAnalysis` as a separate sleep record. Apple Health stores sleep as multiple overlapping samples (InBed, Asleep, Core, Deep, REM). Without stage-level aggregation on the iOS side, the backend will ingest 3-6 records per night, each with different start/end times. The dedupe index catches exact duplicates but not overlapping partial sessions for the same night.

4. **No WHOOP baseline computation** — Even when WHOOP provides RMSSD data, no baseline is derived for `hrv_rmssd`. A WHOOP-specific baseline would make the morning check-in meaningful for WHOOP-only users and enable proper same-metric comparison.

5. **Rolling average in baseline service is expensive** — `computeBaselines()` iterates over every distinct day a metric was recorded, running a windowed AVG query for each day. For a user with 1 year of daily data across 3 metrics, that's ~1,095 queries inside a transaction. This runs synchronously on every Apple ingest call. At scale this will block the response.

6. **Inline `db.prepare()` in dashboard routes** — The `/morning-checkin` endpoint calls `db.prepare()` 7 times per request. While better-sqlite3 caches compiled statements, this is wasteful compared to pre-compiling at module level (as done in `ingestService.js` and `whoopService.js`).

7. **No timezone awareness** — All timestamps are stored in UTC ISO format, which is correct. However, `dateString()` in dashboard routes uses `setUTCDate()` which means the "today" boundary is always UTC midnight, not the user's local midnight. A user in US Pacific viewing their morning check-in at 9pm will see tomorrow's (empty) data after 5pm local time.

8. **Active energy unit stored as 'kcal' but load calculation divides by 100** — In the trends endpoint (line 226), `active_energy` values are converted to load units by dividing by 100. This assumes a fixed scale (100 kcal = 1 load unit) with no documented rationale. The WHOOP strain scale (0-21) and kcal/100 are fundamentally different measures being summed together.

### 🟢 Suggestions

9. **Add composite index for date-based metric queries** — The trends endpoint groups by `date(recorded_at)`, but the index is on the raw `recorded_at` column. For large datasets, a generated column or expression index on `date(recorded_at)` would help. SQLite 3.31+ supports this.

10. **Pre-compute weekly/monthly aggregates** — The `/workouts` endpoint computes weekly and monthly load on every request. For historical data that won't change, a materialized view pattern (separate table updated on ingest) would be more efficient.

11. **Missing data gap handling in trends** — The trends API returns only days with data. If a device didn't sync for 3 days, the frontend gets a gap in the time series with no indication of missing data vs. zero values. Consider returning explicit null entries for gaps.

12. **WHOOP token table has wrong unique constraint** — The `tokenUpsertStmt` uses `ON CONFLICT(user_id)` but the table's primary key is `id` (a UUID), and `user_id` has no unique constraint. The upsert will always insert (never update). Should add `UNIQUE` on `user_id` or change the conflict target.

13. **Sleep date derived from end_at could be wrong** — Using `endAt.slice(0, 10)` for sleep_date means a sleep ending at 00:30 UTC on Jan 2 gets dated Jan 2, but the user slept on the night of Jan 1. WHOOP's own sleep_date concept uses the night the sleep started. This mismatch will cause Apple and WHOOP sleep records for the same night to have different sleep_dates, breaking device comparison.

## Recommendations

1. **Separate HRV tracking by method** — Never compare RMSSD to SDNN directly. Either maintain separate baselines per metric type, or apply a documented conversion factor (literature suggests RMSSD ≈ 0.7-0.9× SDNN but this varies individually).
2. **Add WHOOP baselines** — Extend `BASELINE_DEFS` to include `hrv_rmssd` from WHOOP source.
3. **Fix WHOOP token upsert** — Add `UNIQUE(user_id)` constraint to `whoop_tokens` table.
4. **Aggregate Apple sleep samples** — Group by night on the iOS side before uploading.
5. **Normalize sleep_date** — Use consistent logic: the calendar date when the user went to bed.
6. **Add user timezone to profile** — Store timezone, use it for "today" calculations.
