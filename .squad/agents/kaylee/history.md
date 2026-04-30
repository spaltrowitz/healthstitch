# Project Context

- **Owner:** Shari Paltrowitz
- **Project:** HealthStitch — health data aggregation platform stitching together wearable data from Apple Watch, WHOOP, and other devices
- **Stack:** Node.js/Express backend, React/Vite frontend, Swift/SwiftUI iOS companion, SQLite database
- **Created:** 2026-04-27

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### Beautification Pass (2025-07)
- **CSS design system**: Added CSS custom properties for colors, shadows, radius, transitions. Segmented tab bar with pill-style active state. Card hover elevation. Skeleton loaders. Typography hierarchy (h2=1.5rem/700, h3=0.95rem/600/uppercase). Focus rings on inputs.
- **Morning Check-In**: Hero circular readiness gauge (color-coded green/amber/red), delta badges for HRV/RHR, distinct recommendation card with blue left border + gradient background.
- **Trends Dashboard**: 2-column `charts-grid` layout for paired charts, skeleton loaders, benefit-oriented chart titles ("How well are you recovering?"), thicker strokes + rounded bar tops.
- **Device Comparison**: Stat cards for avg delta + device agreement %, collapsible raw data table behind toggle button, dashed delta line in chart.
- **Workout Log**: Sport filter uses pill/chip buttons dynamically derived from workout data. Empty fields render blank instead of "--". Charts in 2-col grid.
- **Global**: Emoji icons in tab labels. All loading states are skeleton cards. Consistent shadow/radius/hover treatment.
- **Key files**: `styles.css` (design tokens), all 4 view components, `App.jsx` (tab labels).

### 2026-04-29 — Cross-Team Updates

📌 **Team update (2026-04-29T23:04:00Z):** Book established HealthStitch brand, warm copy voice, and task-oriented tab labels ("Today's Readiness", "Trends", "Apple vs WHOOP", "Workouts"). Update UI copy to reflect new voice and naming conventions. — Book

📌 **Team update (2026-04-29T23:04:00Z):** River's data layer review found critical HRV metric mismatch (WHOOP RMSSD vs Apple SDNN) affecting morning check-in deltas. Will need UI handling for metric clarity and potential baseline gaps for WHOOP-only users. — River

### 2026-04-30 — API Shape Migration (Wash's data fixes)

- **Morning Check-In API**: `hrv` and `resting_hr` are now per-source nested objects (`hrv.whoop`, `hrv.apple_watch`, `resting_hr.whoop`, `resting_hr.apple_watch`) each with own `value`, `baseline_*`, and `delta_pct`. Updated MorningCheckIn view to show both sources side by side with device labels (Apple Watch SDNN vs WHOOP RMSSD).
- **Trends API**: `strain` is now `{ whoop: [...], apple_active_energy: [...] }` — no more combined `apple_load` key or `rolling_7d_load`. Field in apple entries is `apple_active_energy_kcal`. Removed 7d rolling load chart that referenced removed data.
- **Pattern**: When API returns per-source data, conditionally render each source only if its value is non-null. Graceful fallback when one device has no data.

### 2026-04-30 — API Shape Changes (Data Fixes)

📌 **Team update (2026-04-30T11:50:00Z):** Wash completed data layer bug fixes. Morning check-in `hrv` and `resting_hr` now nested by source (whoop/apple_watch). Trends `strain` field changed: removed `apple_load` + `rolling_7d_load` confusion; now exposes `whoop` (0–21 score) and `apple_active_energy` (kcal) separately. Update dashboard components to reflect new nested structure. — Wash

📌 **Team update (2026-04-30T11:50:00Z):** River completed WHOOP continuous sync Phase 1. Scheduler runs every 30 minutes with per-user error isolation and exponential backoff. WHOOP recovery/sleep refreshes ~30 min after wake; workouts ~5 min after completion. Dashboard data now auto-updates. — River
