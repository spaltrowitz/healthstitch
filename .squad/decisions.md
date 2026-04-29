# Decisions

> Shared decision log. All agents read this before starting work.
> Scribe merges new decisions from `.squad/decisions/inbox/`.

<!-- Decisions are appended below. Each block starts with ### -->

## 2026-04-29: User directive — Model standardization

**By:** Shari Paltrowitz (via Copilot)

**What:** All squad agents should use claude-opus-4.6 for consistency, not claude-sonnet-4.5.

**Why:** User preference for unified model performance across the team.

---

## CSS Design Tokens over Inline Styles

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** Use CSS custom properties (`--blue`, `--shadow-sm`, `--radius`, `--transition`) for all shared visual values. Components reference these tokens rather than hardcoding hex values.

**Rationale:** Enables future theme changes (dark mode, brand refresh) from a single location. Keeps component JSX lean.

---

## Skeleton Loaders as Standard Loading Pattern

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** Replace all text-based "Loading…" messages with pulsing skeleton card placeholders that match the expected layout shape.

**Rationale:** Reduces layout shift and feels faster. Each view defines its own skeleton matching its content structure.

---

## Collapsible Raw Data Tables

**Date:** 2025-07  
**By:** Kaylee  

**Decision:** On Device Comparison, raw data table is hidden by default behind a "Show raw data" toggle button.

**Rationale:** The chart is the primary visualization. The table is for power users who want exact numbers — it shouldn't dominate the viewport.

---

## 2026-04-29: Data Layer Review Findings

**By:** River (Data Engineer)

**What:** Comprehensive review of data layer identified 2 critical and 6 important issues.

**Critical Issues:**
1. **HRV baseline mismatch** — Morning check-in compares WHOOP RMSSD to Apple SDNN baseline. These are incompatible metrics; RMSSD reads ~0.7–0.9× SDNN. Fallback logic switches metrics silently without adjustment.
2. **Baselines computed only for Apple Watch** — WHOOP-only users get zero baselines and null morning check-in deltas.

**Important Issues:**
3. Sleep record duplication (3–6 overlapping samples per night from Apple)
4. No WHOOP baseline computation
5. Rolling average query is O(n) per user (1,095 queries for 1 year of data)
6. Inline db.prepare() calls in dashboard routes (7 per request, should pre-compile)
7. No timezone awareness (UTC midnight vs user local midnight)
8. Active energy unit mismatch (kcal/100 assumption vs WHOOP strain)

**Why:** Data integrity and performance at risk. HRV comparison results are misleading for users relying on WHOOP.

**Recommendations:**
- Separate HRV tracking by metric type; maintain separate baselines per source
- Add WHOOP baseline computation for hrv_rmssd
- Fix WHOOP token upsert constraint
- Normalize sleep_date logic
- Add user timezone to profile

---

## 2026-04-29: Continuous Sync Scoping — WHOOP + Apple Watch

**By:** Wash (Backend Developer)

**What:** Designed phased architecture for continuous data sync on both WHOOP and Apple Watch.

**WHOOP Continuous Sync (Phase 1, Small, 1–2 days):**
- Backend scheduled polling every 30 minutes via node-cron
- Add `whoop_sync_state` table to track last sync per user
- Loop over all connected users with error isolation per user
- Retry with exponential backoff on failure
- Future upgrade path to webhooks when deployed to HTTPS

**Apple Watch Continuous Sync (Phase 2, Medium, 3–4 days):**
- iOS background delivery observers on all metric types (hourly frequency)
- HKAnchoredObjectQuery for true delta sync (more reliable than date-based)
- Background URLSession for uploads that survive app suspension
- Move JWT from UserDefaults to Keychain (security requirement)
- BGAppRefreshTask as fallback sync trigger

**Data Freshness After Implementation:**
- WHOOP recovery/sleep: ~30 min after wake
- WHOOP workouts: ~5 min after completion
- Apple Watch HR/HRV: ~1 hour
- Apple Watch workouts: ~15 min

**Why:** Manual sync is a friction point. Continuous pull ensures dashboard data is stale by at most 30–60 minutes (vs "whenever user remembers to open the app").

**Gaps Prioritized:**
- Phase 1 (critical): Scheduled job, sync state table, delta sync
- Phase 2 (critical): Observer queries, background URLSession, anchored queries
- Phase 3 (important): Retry logic, failure monitoring, source priority

---

## 2026-04-29: Copy Voice & Naming

**By:** Book (Technical Writer)

**What:** Established HealthStitch brand and warm, personal copy voice across all user-facing text.

**Key Decisions:**
- **App name:** HealthStitch (captures "stitching" concept; not "Unified Health Dashboard")
- **Tab labels:** Task-oriented and short: "Today's Readiness", "Trends", "Apple vs WHOOP", "Workouts"
- **Voice:** Warm, personal, like a health-savvy friend. No clinical jargon in UI copy.
- **Null states:** Use em-dash "—" instead of "--" (reads as intentional absence)
- **Loading states:** Conversational and specific ("Pulling together your morning snapshot…")
- **Error messages:** Lead with what went wrong in human terms, then append technical detail
- **Chart legends:** Device attribution, not algorithm: "Apple Watch (SDNN)" not "Apple SDNN"

**Why:** Users are not clinicians. Copy should help them understand "am I ready today?" without dumbing things down or overwhelming with technical terms.

**Voice Guidelines:**
- Always lead with user benefit (question, goal, action) before technical detail
- Parenthetical device attribution is fine for power users; it clarifies the source without cluttering the main message
- Avoid: "ingest", "delta", "RMSSD", "SDNN", "HRV" in user text; instead: "pulled together", "change", "morning readiness"
