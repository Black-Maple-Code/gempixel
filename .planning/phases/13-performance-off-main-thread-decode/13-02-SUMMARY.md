---
phase: 13-performance-off-main-thread-decode
plan: 02
subsystem: ui
tags: [preact, loading-overlay, error-banner, d-09, d-10, tailwind]

# Dependency graph
requires:
  - phase: 13-performance-off-main-thread-decode
    plan: 01
    provides: "loadingPhase ('preparing'|'matching') signal on MatchState + reactive error signal carrying worker-side decode failures"
provides:
  - "D-09 phase-labeled single loading overlay in App.tsx — indeterminate 'Preparing image…' during off-thread decode, determinate 'Matching colors: {progress}%' on first worker progress"
  - "D-10 stage-agnostic error-banner copy — 'Couldn't process the image: {matchError}' covering decode-stage and match-stage failures alike, text-only"
affects: [13-03 manual parity/UX gate]

# Tech tracking
tech-stack:
  added: []   # zero new npm deps — Tailwind animate-pulse + existing markup only
  patterns:
    - "Single loading surface, phase-branched on loadingPhase (indeterminate animate-pulse full-width bar vs determinate width:{progress}% bar) — no second visual surface (D-09)"
    - "Stage-agnostic error copy so one reactive banner reads correctly for every pipeline stage (D-10)"

key-files:
  created: []
  modified:
    - src/App.tsx

key-decisions:
  - "Indeterminate bar = same bar container (w-48 bg-slate-800 h-2 rounded-full overflow-hidden) with a full-width bg-indigo-500 animate-pulse inner bar (no width:{progress}%); determinate branch keeps the existing transition-all width fill verbatim"
  - "Both overlay branches wrapped in the single unchanged {loading && …} gate via a ternary, preserving mutual exclusion with the matchError banner"
  - "matchError stays a plain JSX text child — the two 'never dangerouslySetInnerHTML' mentions in App.tsx are comment invariants only, no attribute added (T-13-01)"

requirements-completed: [PERF-01]

# Metrics
duration: 5min
completed: 2026-07-12
status: complete
---

# Phase 13 Plan 02: Loading Overlay Phase Copy + Stage-Agnostic Error Banner Summary

**Wired the D-09 phase-labeled single loading overlay ('Preparing image…' indeterminate during off-thread decode → 'Matching colors: {progress}%' determinate on first worker progress) and the D-10 stage-agnostic error-banner copy in App.tsx, consuming the loadingPhase signal from Plan 13-01 — with the spinner-never-co-displays-with-banner invariant intact.**

## Performance
- **Duration:** ~5 min
- **Completed:** 2026-07-12
- **Tasks:** 2
- **Files modified:** 1 (src/App.tsx, as planned)

## Accomplishments
- Destructured `loadingPhase` from `useDiamondArtMatch(...)` (confirmed shape `'preparing' | 'matching'` against `useDiamondArtMatch.ts:47/90/221`).
- Branched the single loading overlay on `loadingPhase`: `'preparing'` renders the same bar container with a full-width `bg-indigo-500 animate-pulse` inner bar and the label "Preparing image…" (no percentage); `'matching'` keeps the existing determinate `style={{ width: \`${progress}%\` }}` fill and "Matching colors: {progress}%" label. The outer `{loading && ( … )}` gate is unchanged (D-09).
- Generalized the match-error banner copy from "Color matching failed:" to "Couldn't process the image: {matchError}" so a decode-stage message reads correctly; `{matchError}` remains a plain JSX text child, no `dangerouslySetInnerHTML` (D-10, T-13-01, ASVS V5). Updated the banner comment to note it now covers decode-stage failures.

## Task Commits
Each task was committed atomically:

1. **Task 1: Branch loading overlay on loadingPhase (indeterminate 'Preparing image…' → determinate 'Matching colors: {progress}%')** - `6623af3` (feat)
2. **Task 2: Generalize match-error banner copy to stage-agnostic string (D-10)** - `85b30fa` (feat)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified
- `src/App.tsx` - Added `loadingPhase` to the `useDiamondArtMatch` destructure (line ~395); phase-branched the loading overlay (lines ~1642) via a ternary inside the unchanged `{loading && …}` gate; generalized the matchError banner copy and comment (lines ~1652).

## Decisions Made
- The indeterminate bar reuses the exact existing bar container classes and swaps only the inner fill for a full-width `animate-pulse` bar — no new visual surface, honoring D-09's "one overlay" mandate.
- Ternary-branched both phases inside the single `{loading && …}` gate rather than duplicating the gate, keeping the mutual-exclusion-with-banner invariant structurally obvious.

## Deviations from Plan
None - plan executed exactly as written. Both tasks confined to `src/App.tsx`; zero new dependencies; no auth gates; no architectural changes.

## Known Stubs
None.

## Threat Flags
None — copy/markup edits only, no new network endpoints, auth paths, file access, or schema changes. T-13-01 (banner tampering) is mitigated at the display site: `{matchError}` stays a plain JSX text child.

## Issues Encountered
- Closing-gate grep for `dangerouslySetInnerHTML` matched two lines; both are comment-only invariant statements ("never dangerouslySetInnerHTML"), not attribute usage — verified the banner remains text-only.

## User Setup Required
None — no external service configuration; zero new npm dependencies.

## Next Phase Readiness
- The D-09 overlay and D-10 banner copy are now live in the UI; **Plan 13-03** is the remaining manual in-browser parity/UX gate (bit-identical decode parity D-11 + visual verification of the "Preparing image…" → "Matching colors" flip and the stage-agnostic banner), not automatable in the node Vitest env.

## Self-Check: PASSED
- `src/App.tsx` present on disk with `loadingPhase` destructured, "Preparing image…" and "Couldn't process the image:" copy present, "Color matching failed" absent.
- Both task commits (`6623af3`, `85b30fa`) present in git history.
- Closing gate: `npx tsc --noEmit` clean; `npx vitest run` 178/178 pass; `npx vite build` succeeds.

---
*Phase: 13-performance-off-main-thread-decode*
*Completed: 2026-07-12*
