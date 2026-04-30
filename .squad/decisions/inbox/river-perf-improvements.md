# Performance Improvements — Expression Indexes, Aggregates, Gap Indicators

**Date:** 2025-07  
**By:** River (Data Engineer)

**What:** Three performance improvements to the data layer:

### 1. Expression Indexes (migration 004)
Added four indexes optimized for the actual query patterns in dashboard routes:
- `date(recorded_at)` on metric_records (used by every trends GROUP BY)
- `date(start_at)` on sleep_records and workout_records
- Composite `(user_id, source, date(recorded_at))` on metric_records — covers the most common WHERE+GROUP pattern

### 2. Pre-Computed Aggregates (migration 005 + aggregateService.js)
- New `training_load_aggregates` table stores weekly and monthly training load rollups
- Workouts dashboard now reads pre-computed values instead of scanning raw workout rows
- Incremental: each workout ingest updates only the affected week/month
- `recomputeAll(userId)` available for backfill/repair

### 3. Gap Indicators in Trends API
- Trends endpoint now returns entries for every date in the requested range
- Each data point includes `has_data: boolean` so the frontend can distinguish missing data from zero values
- Enables proper gap rendering in charts (dotted lines, empty markers, etc.)

**Why:** 
- Expression indexes eliminate full-table-scan on date extraction for every dashboard request
- Aggregates make the workouts page O(1) for load summaries instead of scanning all workout rows
- Gap indicators fix a long-standing UI issue where missing days were silently interpolated

**Frontend Impact:**
- Trends API response shape changes: each series now includes `has_data` field on every point
- Workouts `weekly_load` and `monthly_load` now include `count`, `avg_strain`, `calories` fields alongside `load`

**Migration Notes:**
- Lazy-init pattern used for prepared statements referencing the new table (avoids import-order issues with migrations)
