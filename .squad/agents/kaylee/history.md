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
