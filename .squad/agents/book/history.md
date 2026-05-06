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

## Cross-Project Designer/UX Writing Knowledge (injected 2026-05-02)

### From EatDiscounted (Verbal)
- **Emotional payoff in results:** Finding deals should feel like a win, not a status report. Apply to HealthStitch — "Your readiness score is up 12% this week" should feel encouraging, not clinical.
- **Community reports as social signal:** Surface community-contributed data on "not found" states. For HealthStitch, when a device can't sync, show what data IS available rather than just an error.

### From MyDailyWin (Sidon)
- **Celebration psychology:** Achievements, streaks, and milestones need proper celebration (modal + animation), not just toast notifications. HealthStitch health milestones ("30-day streak of HRV improvement") deserve celebration moments.
- **Dark mode must be universal across all pages.** Shared init script avoids jarring light↔dark transitions.

### From Slotted (Suki)
- **Emoji audit methodology:** 4-criteria test — if text label exists next to emoji, emoji is redundant. Apply to HealthStitch's tab labels and status indicators.
- **Settings pages minimize "teaching" copy.** Users chose to be on the page — label controls clearly, let them act.
- **Progressive disclosure by user stage:** New users vs. users with 30 days of data need different dashboard layouts. Temporal design > spatial.

### From Slotted (Ty Lee)
- **"Visual diet, not redesign":** Strip visual noise, then polish what remains.
- **Type scale:** 5 levels enforced globally. One accent color + grayscale for everything else.
- **Empty states need warmth:** When no data yet, show encouragement + single CTA ("Connect your first device"), not a void.

### From Scrunch (Jan)
- **Homepage: lead with mission, not features.** "Your health data, stitched together" as single powerful headline.
- **"No pre-browse gates, ever":** First screen must deliver value immediately. Don't gate dashboard behind lengthy onboarding.
- **44px minimum touch targets** on all interactive elements.
- **Copy verbosity scales with commitment:** Dashboard copy = short (scanning mode). About/help = longer (reading mode).
- **Remove non-functional UI:** "Coming soon" buttons erode trust. Remove until feature ships.
- **One mention is enough:** Don't repeat the same value prop across multiple sections.
