# Project Context

- **Owner:** Shari Paltrowitz
- **Project:** HealthStitch — health data aggregation platform stitching together wearable data from Apple Watch, WHOOP, and other devices
- **Stack:** Node.js/Express backend, React/Vite frontend, Swift/SwiftUI iOS companion, SQLite database
- **Created:** 2026-04-27

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

## Cross-Project Tester Knowledge (injected 2026-05-02)

The following learnings come from Tester agents across Shari's other personal projects.

### From EatDiscounted (McManus — Tester)
- **Zero tests = zero confidence:** Project launched with no test framework. First audit: 🔴 not ship-ready. Vitest installed, 65 tests written in one session (38 matching + 27 checkers). Set up test framework early — don't wait until launch.
- **Unicode normalization bugs:** `norm()` stripped accented chars ("Café" → "caf"), destroyed CJK/Cyrillic (→ ""). `"".includes("")` is true in JS → false positives. Always test with non-ASCII input (relevant for medical terms, patient names in HealthStitch).
- **Empty catch blocks hide failures:** `catch {}` silently swallowed errors. Users couldn't distinguish failures from empty results. Error states must be visually distinct.
- **External API mock patterns:** Mock `fetch` globally with `vi.fn()`, set API keys in `beforeEach`, test success and failure paths (403/429/500, timeouts, malformed JSON). Verify cache prevents redundant calls. Relevant for wearable API integrations.
- **SSE streaming:** Untested at launch. Streaming data (SSE, WebSocket) needs explicit test coverage — verify client can parse server output.
- **Dead code detection:** Testing revealed defined+tested function never called anywhere. Tests can surface dead code paths.

### From MyDailyWin (Purah — Tester)
- **Multi-surface state sync is a minefield:** Admin writes `hr_admin_{profile}`, user reads `hr_state_{profile}`. Legacy profile uses unsuffixed keys → silent data splits. When backend/frontend/iOS share state, map ALL read/write paths and verify consistency.
- **Undefined function bugs in vanilla JS:** `saveState` called but never defined. Without TypeScript, these only surface at runtime. HealthStitch uses Node.js/Express — ensure server-side code has equivalent build-time checks.
- **Profile-aware testing:** Functions using default-only keys broke for other profiles. Always test with non-default configurations (relevant for multi-device, multi-user scenarios).
- **Parallel agent commits break integrity:** 4 agents committing to shared files: missing HTML closing tags, CSP gaps, FOUC. After parallel work, do structural integrity sweep.
- **Bug bash methodology:** Systematic sweep across all flows (onboarding → auth → admin → settings → payout). Found 6 bugs (1 critical). Apply same systematic approach to HealthStitch data flows.
- **Firebase config consistency:** Old project IDs lingering across files = critical runtime risk. Check all config references match when project settings change.

### From MyDailyWin (Helen — Alumni Tester)
- **Independent verification validates findings:** Three testers independently found the same core bugs. Systematic code review catches real issues regardless of reviewer.
- **Shared-state architecture testing:** Multiple pages sharing localStorage creates combinatorial testing surface. Same applies to any multi-client architecture (web + iOS in HealthStitch).

### From MyDailyWin (Robin — Alumni Tester)
- **Architectural issues persist:** Same storage key mismatches found by every tester rotation. These are design-level problems that require architectural fixes, not patches.

### From MyDailyWin (Riju — Security)
- **CSP hardening pattern:** Eliminated `unsafe-inline` via `data-action` + event delegation. CSP meta tag must be in `<head>` before external resources.
- **Open redirect vulnerability:** `?redirect=` param allowed arbitrary redirects. Validate redirect targets. Relevant for HealthStitch auth flows.
- **innerHTML XSS:** User-controlled data rendered without escaping. Sanitize all dynamic content — especially health data displayed in UI.
- **Auth ≠ authorization:** Firestore rules with auth-only checks let any authenticated user access others' data. For HealthStitch (health data = highly sensitive), ownership scoping is critical. SQLite may need equivalent access controls.
- **Service worker cache versioning:** Adding new assets requires cache version bump. Relevant if HealthStitch uses PWA/caching.

### From Slotted-AI (Sokka — Tester)
- **Payload key mismatches:** Backend camelCase vs. snake_case inconsistency caused ~10 of 16 test failures. Establish and enforce a naming convention early. Inspect each endpoint's `req.body` destructuring.
- **Polling helper for async assertions:** `waitFor<T>(fn, predicate, maxAttempts, delayMs)` — 5 attempts × 1s. Essential for testing async operations (relevant for wearable data sync, health metric calculations).
- **Response mapping mismatches:** Backend `{ friendshipId }` vs. client `{ id }` → requests to `/resource/undefined`. Verify API response shapes match client expectations — especially between Express backend and React/Swift clients.
- **E2E test debugging:** Categorize failures systematically: payload mismatches, response mapping, timing, stale state. Systematic categorization > random fixing.
- **Account deletion cascade:** Deletion left orphaned records (FK violations). Test delete flows across all related tables — critical for HIPAA/health data deletion requirements.
- **Security audit findings:** Tokens leaked via `select(*)` not filtering SENSITIVE_FIELDS. Hardcoded secret fallbacks. List endpoints exposing private data. For health data, audit every endpoint's response for PHI leakage.
- **Destructive sync pattern:** DELETE all → INSERT new creates brief zero-data window. Wearable data sync should preserve continuity — test for data gaps during sync operations.
- **9400-line monolith backend:** All routes in one `index.ts` file. In-memory rate limiter resets on cold start. Consider modularization early for HealthStitch backend.

### From Slotted-AI (Josh — Alumni Tester)
- **Webhook testing:** Always return HTTP 200, even for errors (providers deactivate on 4xx). Webhooks are signals, not payloads — fetch actual data separately. Relevant for wearable device webhooks (Apple Watch, WHOOP).
- **OAuth token handling:** Handle expired vs. revoked tokens differently (retry vs. disconnect). Time comparisons must use absolute UTC. Relevant for wearable API OAuth flows.
- **Edge cases in sync:** Multi-source moves = delete + create with new IDs. Stale sync tokens need full re-sync. Full re-sync must NOT duplicate non-app data.

### From Slotted-AI (Nate — Alumni Tester)
- **Incremental sync via tokens:** Sync tokens enable fetching only changes since last sync. Stale token (410 Gone) → full re-sync fallback. Directly applicable to wearable data sync architecture.
- **Deterministic ID patterns:** Predictable IDs (`app-{recordId}-{userId}@domain`) simplify testing. Consider for HealthStitch data records.

### From Scrunch (Rizzo — Tester)
- No testing learnings recorded yet (project in early stage). Stack: React 19, TypeScript, Vite, Tailwind CSS 4, Supabase, Vitest.
