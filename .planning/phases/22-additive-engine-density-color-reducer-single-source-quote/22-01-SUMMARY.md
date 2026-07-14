---
phase: 22-additive-engine-density-color-reducer-single-source-quote
plan: 01
subsystem: engine
tags: [density, grid-to-inch, ciede2000-adjacent, quote, strangler, typescript, vitest]

# Dependency graph
requires:
  - phase: 20-atelier-design-system-canvas-first-shell
    provides: "theme-param retirement (D-07 quarantine) that left stale engine comment markers to clean up"
provides:
  - "src/engine/density.ts — the single 2.5mm/dot (10 dots/inch) density source: gridToInches + formatInches + DOTS_PER_INCH/MM_PER_DOT constants (QUOTE-01)"
  - "Reconciliation test binding gridToInches to calculateCanvasCost's /10 so displayed size and canvas cost can never diverge"
  - "Removal of the two engine stale Phase-20 theme-param comment markers (SC5)"
affects: [phase-23-ui-wiring, SizeCard, canvas-cost, quote, supplies]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single reconciled density source — one grid→inch path, guarded against a second 10.16 constant forking the truth"
    - "Fail-soft render-path math — non-finite axis degrades to 0, never NaN/throw"

key-files:
  created:
    - src/engine/density.ts
    - src/engine/__tests__/density.test.ts
  modified:
    - src/engine/export.ts
    - src/engine/viewer.ts

key-decisions:
  - "Placed density in a new engine/density.ts module (Claude's discretion in CONTEXT) rather than colocating, mirroring smoothing.ts pure-engine conventions"
  - "Kept DOTS_PER_INCH=10 (not 10.16) with a JSDoc guard so canvas cost and displayed size stay byte-identical to the app's long-standing /10 convention"
  - "gridToInches returns plain numbers; formatInches produces the display string — callers do math on the number"

patterns-established:
  - "Single-source density: every inch figure derives from grid dims through one helper; no second constant, no hard-coded mock inch label"
  - "Reconciliation test binds a new helper to an existing implicit path (calculateCanvasCost /10) so the two can never drift"

requirements-completed: [QUOTE-01]

coverage:
  - id: D1
    description: "engine/density.ts: gridToInches maps grid dims to inches at 10 dots/inch, reconciled with calculateCanvasCost's /10; formatInches 1-dp; non-finite axis degrades to 0"
    requirement: "QUOTE-01"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/density.test.ts#density helper (QUOTE-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stale Phase-20 theme-param comment markers removed from export.ts (x2) and viewer.ts (x1); no signature/behavior change"
    requirement: "QUOTE-01"
    verification:
      - kind: automated
        ref: "grep 'remove theme param' src/engine → 0 matches; npx tsc --noEmit exit 0; npm test 301 passing"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-14
status: complete
---

# Phase 22 Plan 01: Additive Engine — Single 2.5mm/dot Density Source Summary

**A pure `engine/density.ts` (`gridToInches` + `formatInches` at 10 dots/inch) reconciled byte-identically with `calculateCanvasCost`'s `/10`, plus removal of the two stale engine theme-param comment markers — the single density source for QUOTE-01.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-14T12:33:00Z
- **Completed:** 2026-07-14T12:36:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 edited)

## Accomplishments
- Created `src/engine/density.ts` — the one grid→inch density path: `gridToInches(cols,rows)` returns `{ widthIn: cols/10, heightIn: rows/10 }` with each axis finite-guarded (non-finite → 0, never NaN/throw), plus `formatInches` (1-dp round-half-up) and exported `DOTS_PER_INCH=10` / `MM_PER_DOT=2.5` constants.
- Added `density.test.ts` proving reconciliation: `gridToInches(120,160) === { widthIn: 12, heightIn: 16 }`, `widthIn === cols/DOTS_PER_INCH`, derived area matches `calculateCanvasCost`'s internal grid→/10 area, plus the NaN-guard and `formatInches` rounding cases.
- Deleted the two stale `// PHASE 22: remove theme param` markers in `export.ts` and the one in `viewer.ts` (SC5) — comment-only, `symbolFontPx(basePx, symbol)` already takes no theme arg.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create engine/density.ts** - `0a7c067` (feat)
2. **Task 2: Create density.test.ts reconciliation** - `7d6d293` (test)
3. **Task 3: Delete stale theme-param comment markers** - `015876c` (chore)

## Files Created/Modified
- `src/engine/density.ts` - The single density source: gridToInches, formatInches, DOTS_PER_INCH, MM_PER_DOT (created)
- `src/engine/__tests__/density.test.ts` - Reconciliation + guard + rounding tests (created)
- `src/engine/export.ts` - Removed two stale theme-param comment markers (modified)
- `src/engine/viewer.ts` - Removed one stale theme-param comment marker (modified)

## Decisions Made
- **New module over colocation:** `engine/density.ts` mirrors `smoothing.ts` pure-engine conventions (named exports, JSDoc, no Preact/DOM), keeping the density path discoverable and single-purpose (Claude's discretion per CONTEXT).
- **DOTS_PER_INCH=10, not 10.16:** kept the app's long-standing `/10` divisor with an explicit JSDoc guard so canvas cost and displayed size stay byte-identical; a 10.16 constant would fork the density truth (QUOTE-01).
- **Numbers from gridToInches, string from formatInches:** callers do math on the numeric inches; the display string is produced separately, matching App.tsx's `fmt` precedent.

## Deviations from Plan

None - plan executed exactly as written. All three tasks landed on their planned files with no auto-fixes required.

## Issues Encountered
- The two `export.ts` markers had byte-identical surrounding context, so the first Edit reported a non-unique match; resolved by replacing the comment line via `replace_all` (still comment-only, no code touched). No behavior impact.

## Threat Surface
- T-22-D1 (Tampering — non-finite grid dim into `gridToInches`) mitigated: each axis is finite-guarded to 0 and covered by the NaN-guard test case.
- T-22-D2 (Supply chain) mitigated: zero new dependencies; `package.json` untouched (verified in diff).

## Verification Evidence
- `npx tsc --noEmit` exits 0 (strict mode).
- `npx vitest run src/engine/__tests__/density.test.ts` — 4/4 pass.
- `npm test` — 301 passing across 29 files (baseline was 297/28; count only grew, SC5 honored).
- `git diff --stat` across the three task commits shows only density.ts, density.test.ts, export.ts, viewer.ts — App.tsx and package.json untouched (strangler discipline).

## Next Phase Readiness
- The single density source is ready for Phase 23 wiring: SizeCard's derived-inches prop, canvas cost, and any inch label read `gridToInches`/`formatInches` — no hard-coded mock inch label can survive.
- Sibling plans 22-02/03/04 (color reducer, quote selector, hook `detectedColorCount`) are independent additive engine work; this plan touched none of their surfaces.

## Self-Check: PASSED

- density.ts, density.test.ts, 22-01-SUMMARY.md all exist on disk.
- Task commits 0a7c067, 7d6d293, 015876c all present in git log.

---
*Phase: 22-additive-engine-density-color-reducer-single-source-quote*
*Completed: 2026-07-14*
