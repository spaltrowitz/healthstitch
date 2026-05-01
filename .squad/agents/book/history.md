# Book — History

## Project Context

- **Project:** HealthStitch — health data aggregation platform
- **Stack:** Node.js/Express, React/Vite, Swift/SwiftUI, SQLite
- **Owner:** Shari Paltrowitz
- **Description:** Stitches together wearable data from Apple Watch, WHOOP, and other devices into a unified dashboard with baselines, trends, and cross-device comparison.

## Learnings

- **Voice:** Smart, personal, encouraging — like a health-savvy friend, not a medical device. Avoid clinical jargon (e.g., "ingest", "delta", "SDNN") in user-facing text; parenthetical device attribution is fine.
- **App name:** "HealthStitch" — captures the stitching-together concept better than "Unified Health Dashboard".
- **Null states:** Use em-dash "—" instead of "--" for missing data; reads as intentional absence rather than a bug.
- **Loading states:** Conversational and specific ("Pulling together your morning snapshot…") rather than generic ("Loading...").
- **Error framing:** Always lead with what the user wanted ("Couldn't load your readiness data") before appending the technical message.
- **Tab labels:** Task-oriented and short: "Today's Readiness", "Trends", "Apple vs WHOOP", "Workouts".
- **Key files:** App.jsx (auth + nav), MorningCheckIn.jsx, TrendsDashboard.jsx, DeviceComparison.jsx, WorkoutLog.jsx, DateRangeSelector.jsx, SourceToggle.jsx
- **Legal pages:** `frontend/public/privacy.html` and `frontend/public/terms.html` are standalone HTML (not React routes) so they load without the SPA. Inline CSS, no dependencies. Styled to match Apple-esque clean aesthetic. Cross-linked in footers. Contact email: shari@healthstitch.dev.
- **Public directory:** Vite serves `frontend/public/` as static assets. With `base: '/healthstitch/'`, files are accessible at `/healthstitch/privacy.html`. For WHOOP OAuth registration, the privacy URL is `https://healthstitch.yourdomain.com/healthstitch/privacy.html`.
