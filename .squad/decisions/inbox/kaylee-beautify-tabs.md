### CSS Design Tokens over Inline Styles
**Date:** 2025-07  
**By:** Kaylee  
**Decision:** Use CSS custom properties (`--blue`, `--shadow-sm`, `--radius`, `--transition`) for all shared visual values. Components reference these tokens rather than hardcoding hex values.  
**Rationale:** Enables future theme changes (dark mode, brand refresh) from a single location. Keeps component JSX lean.

### Skeleton Loaders as Standard Loading Pattern
**Date:** 2025-07  
**By:** Kaylee  
**Decision:** Replace all text-based "Loading…" messages with pulsing skeleton card placeholders that match the expected layout shape.  
**Rationale:** Reduces layout shift and feels faster. Each view defines its own skeleton matching its content structure.

### Collapsible Raw Data Tables
**Date:** 2025-07  
**By:** Kaylee  
**Decision:** On Device Comparison, raw data table is hidden by default behind a "Show raw data" toggle button.  
**Rationale:** The chart is the primary visualization. The table is for power users who want exact numbers — it shouldn't dominate the viewport.
