# Session: Apple Sync Phase 2 & Performance Optimizations

**Date:** 2026-04-30T121000Z  
**Team:** Wash, Kaylee, River  
**Scope:** Apple Watch background sync, sync status UI, performance indexes  

## Spawned Agents

1. **Wash** — Phase 2: HKObserverQuery, HKAnchoredObjectQuery, background URLSession, Keychain JWT, BGAppRefreshTask, `/api/apple/sync-status`
2. **Kaylee** — SyncStatus component: green/amber/red, auto-refresh 60s, 404 handling
3. **River** — Expression indexes on dates, pre-computed training_load_aggregates, gap indicators in trends API

## Expected Outcomes

- WHOOP + Apple Watch background sync fully automated
- Sync status visible in real-time in UI with freshness indicator
- Dashboard queries optimized via indexes and aggregates
- Data freshness: WHOOP ~30 min, Apple Watch ~1 hour

## Decisions to Merge

- `wash-apple-sync.md` — Apple Watch Phase 2 implementation details
- `river-perf-improvements.md` — Performance improvements (indexes, aggregates, gap indicators)

## Notes

- All agents run in parallel (background mode, claude-opus-4.6)
- Scribe will merge decisions and cross-propagate to history.md files
- Frontend will need update for new API shapes (per-source HRV/RHR, strain separated by source)
