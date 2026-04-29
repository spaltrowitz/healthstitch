# HealthStitch

> Health data aggregation platform — stitches together wearable data from Apple Watch, WHOOP, and more.

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. Does not generate domain artifacts. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Mal | Lead | `.squad/agents/mal/charter.md` | ✅ Active |
| Kaylee | Frontend Dev | `.squad/agents/kaylee/charter.md` | ✅ Active |
| Wash | Backend Dev | `.squad/agents/wash/charter.md` | ✅ Active |
| Zoe | Tester | `.squad/agents/zoe/charter.md` | ✅ Active |
| River | Data Engineer | `.squad/agents/river/charter.md` | ✅ Active |
| Book | Technical Writer | `.squad/agents/book/charter.md` | ✅ Active |
| Scribe | Session Logger | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation
- Documentation fixes and README updates

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control)
- Performance-critical paths requiring benchmarking
- Changes requiring cross-team discussion

## Project Context

- **Owner:** Shari Paltrowitz
- **Stack:** Node.js/Express, React/Vite, Swift/SwiftUI, SQLite
- **Description:** Health data aggregation platform that stitches together wearable data from Apple Watch, WHOOP, and other devices into a unified dashboard with baselines, trends, and cross-device comparison.
- **Created:** 2026-04-27
