# Project Context

- **Owner:** Shari Paltrowitz
- **Project:** HealthStitch — health data aggregation platform stitching together wearable data from Apple Watch, WHOOP, and other devices
- **Stack:** Node.js/Express backend, React/Vite frontend, Swift/SwiftUI iOS companion, SQLite database
- **Created:** 2026-04-27

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

## Cross-Project Lead Knowledge (injected 2026-05-02)

The following learnings come from Lead agents across Shari's other personal projects.
These patterns and corrections are relevant to any project you work on.

### From EatDiscounted (Keaton)
- **Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, better-sqlite3, SSE streaming, Python CLI
- **Ship-readiness audit pattern:** Architecture clean and well-typed, but critical blockers: no rate limiting on public API endpoint, no deployment config, zero tests, no ARIA attributes for accessibility.
- **Rate limiting is a critical blocker** for public-facing endpoints, especially with quota-limited external APIs (Google CSE = 100/day).
- **Response caching** multiplies capacity 10-50x — essential with external API quotas.
- **Unicode normalization bug** caused false positives/negatives in search matching. Always normalize unicode when comparing strings.
- **Accessibility from day one:** Zero ARIA attributes found. Retrofitting is harder than building in.
- **Deployment decision:** VPS (simpler) often beats managed platforms (Vercel) for side projects with SSE/streaming.
- **Product prioritization:** P0 shareability, P1 personalization, P2 discovery.

### From MyDailyWin (Revali, alumni: Hopper, Edna)
- **Stack:** Vanilla HTML/CSS/JS, Firebase (Hosting + Auth + Firestore), EmailJS, PWA
- **Code duplication is the #1 maintenance killer:** 65+ functions copy-pasted across 3 HTML files (12,703 total lines). Consolidation eliminated ~4,400 duplicated lines.
- **Consolidation strategy:** When codebases have 67%+ function overlap, merge into one canonical source. Phased: delete zero-unique files → migrate unique features → update routing → verify. 4 phases, ~5 hours total.
- **Firestore security:** `allow read/write: if request.auth != null` means any authenticated user can read/modify ANY user's data. Always scope rules to owner.
- **localStorage key contracts:** Inconsistent keys between admin/user pages caused data flow bugs. Document and verify key contracts across app surfaces.
- **innerHTML with user data (73 occurrences):** Sanitization existed in one file but not others. Security utilities must be shared across all surfaces.
- **Service worker versioning:** Static CACHE_NAME = stale cache forever. Always version.
- **Cross-tab sync:** localStorage doesn't auto-sync — need storage event listeners for multi-tab apps.
- **Hardcoded credentials:** EmailJS keys and Firebase config scattered across pages. Centralize secrets and config.

### From Slotted (Toph, alumni: Beard, Leo)
- **Stack:** React 19 + TS + Tailwind v4 + Vite, Firebase Functions + Express, Supabase PostgreSQL, Firebase Auth
- **Backend monolith anti-pattern:** Single file grew to 8,371 lines / 87+ endpoints. Biggest velocity bottleneck. Split before scaling team.
- **Security audit (5 critical findings):** Plaintext OAuth tokens in DB, data leaking between users, hardcoded PII in production, RCE vulnerability in dependency, RLS enabled on all 18 tables but zero policies defined.
- **RLS without policies = false security.** Defense-in-depth requires actual policies even if service role bypasses them. One architectural change can expose everything.
- **Token encryption:** Supabase Vault (pgsodium) with separate table. Handles key rotation natively. Protects against DB dump/backup exposure.
- **Race condition pattern:** Concurrent state transitions need DB-level serialization — AFTER UPDATE trigger with FOR UPDATE lock. App code keeps notification logic; DB handles atomic state transitions.
- **Bidirectional sync with external systems:** Track change source to prevent infinite loops. External system = source of truth for individual actions; your app = source of truth for aggregate/multi-party state.
- **Product design principles:** Privacy-first (never expose personal data between users), soft social language, AI as invisible infrastructure, reduce friction at happy moments, no social pressure features.
- **Progressive disclosure:** Show new users a simple experience; unlock features by milestones (usage, friend count, time on platform).
- **CORS:** Open CORS in production is a security flag. Restrict origins.
- **Invite/share codes:** 3-char codes are brute-forceable. Use sufficient entropy.

### From Scrunch (Sandy)
- **Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Supabase, React Query, React Router, Vitest. GitHub Pages deployment.
- **TypeScript 6 + Supabase type quirk:** `.select('*')` returns `never` unless Database type includes Views, Functions, Relationships fields. Pragmatic fix: cast with `(data as unknown as Type[])`.
- **PR conflict resolution principle:** When PRs conflict with architectural migrations (React Query), adapt incoming code to new architecture rather than reverting migration. Drop incompatible features and flag for re-implementation.
- **Performance audit:** Static imports defeat lazy-load optimizations (74KB seed file in every chunk). Auth loading gate creates blank screen on Supabase free tier cold start (1-3s).
- **Supabase cold-start mitigation:** Phase 1 offline-first (seed data, $0). Phase 2 Supabase Pro ($25/mo) when validated. Lowest risk path.
- **Legal framework for content integration:** Product names = factual (safe). Paraphrased descriptions = safe. Attribution essential. Video/images = copyrighted (never embed). "As featured in" not "endorsed by."
- **Toast convention:** All mutations must include success/error toast feedback. Team standard.
- **Image sourcing policy:** Only brand websites or open-license sources. Retailer CDNs prohibit hotlinking.
- **HashRouter for GitHub Pages:** SPA routing on GH Pages requires HashRouter.
