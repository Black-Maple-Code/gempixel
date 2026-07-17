---
phase: 24-mobile-responsive-touch-pass
plan: 01
subsystem: ui
tags: [tailwind-v4, container-queries, responsive, css, preact, mobile]

# Dependency graph
requires:
  - phase: 23-the-four-screens-in-flow-order
    provides: The Atelier 4-step journey (Upload → Refine → Supplies → Order) wired into AtelierShell + App shell body with the single-mount CanvasViewer and display:contents step panels
  - phase: 20-atelier-design-system-canvas-first-shell
    provides: App-owns-state (D-01) and single-mount viewer never remounts (D-14) — the invariants the reflow honors
provides:
  - Container-query reflow of the Atelier shell to a single portrait column at ~300px (Tailwind v4 @container on AtelierShell root)
  - Shell body flips flex-row → flex-col below 640px and becomes the single mobile scroll region
  - Canvas-first sticky ~45dvh Refine preview pane pinned above a full-width scrolling controls rail
  - RefineScreen rail relaxed to full-width on mobile (base w-[360px] preserved)
  - index.css cleaned of dead legacy drawer CSS; live .viewport-hud rules preserved
affects: [24-02 (touch pinch/pan), 24-03 (regression proof), 25 (strangler close / legacy Step + drawer remnant removal)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 container queries — @container on a real ancestor box + descendant-only @max-[640px]:* overrides (first use in codebase)"
    - "Responsive = descendant-only overrides; desktop base classes untouched (provably unregressed)"

key-files:
  created: []
  modified:
    - src/features/wizard/AtelierShell.tsx - Root <div> carries @container (container-type: inline-size)
    - src/App.tsx - Shell body flips @max-[640px]:flex-col + overflow-y-auto; canvas <main> becomes sticky canvas-first pane
    - src/features/screens/RefineScreen.tsx - Root <section> relaxes @max-[640px]:w-full + border-l-0
    - src/index.css - Dead drawer @media block deleted; .viewport-hud + .viewport-dots preserved

key-decisions:
  - "container-type lives on the AtelierShell root box (not the display:contents shell body, not the flex-row body itself — a container styles descendants, never itself)"
  - "Used arbitrary @max-[640px] (valid Tailwind v4) as the flip point per D-02"
  - "@max-[640px]:overflow-y-auto makes the shell body the single mobile scroll region so position:sticky has a scroll ancestor"
  - "Kept the sticky pane (D-03 primary); did NOT apply the drop-sticky fallback (no cramping observed at build time; deferred to UAT)"

patterns-established:
  - "Pattern 1: Tailwind v4 @container container queries with descendant-only @max-[640px]:* mobile overrides"
  - "Pattern 2: Single-mount viewer is CSS-reordered into a sticky pane, never conditionally mounted per breakpoint"

requirements-completed: [MOBILE-01]

coverage:
  - id: D1
    description: "At ~300px the shell reflows to a single portrait column driven by a container query (@container on AtelierShell root + @max-[640px]:flex-col on shell body)"
    requirement: MOBILE-01
    verification:
      - kind: manual_procedural
        ref: "Resize shell to ~300px in browser; confirm single portrait column"
        status: unknown
    human_judgment: true
    rationale: "Visual reflow correctness at ~300px requires human observation; full regression proof owned by Plan 03"
  - id: D2
    description: "Refine is canvas-first with a sticky ~45dvh preview pane above a full-width scrolling controls rail; every control stays inline (no drawer markup)"
    requirement: MOBILE-01
    verification:
      - kind: manual_procedural
        ref: "On Refine at mobile width, confirm sticky canvas pane pinned above scrolling rail; no drawer/overlay"
        status: unknown
    human_judgment: true
    rationale: "Sticky-pane behavior and mobile-keyboard collision fallback need human UAT (D-03 documented risk)"
  - id: D3
    description: "Desktop layout is unregressed: base classes flex-row (App shell body) and w-[360px] (RefineScreen) untouched; only descendant @max-[640px] overrides added"
    requirement: MOBILE-01
    verification:
      - kind: other
        ref: "grep gates: flex-row + w-[360px] still present; npx tsc --noEmit exits 0; npm run build exits 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dead legacy drawer CSS deleted (aside/aside.w-96/aside.w-0/.drawer-backdrop/drawer-era main padding); live .viewport-hud + .viewport-dots rules preserved"
    requirement: MOBILE-01
    verification:
      - kind: other
        ref: "grep gates: drawer-backdrop=0, aside.w-96=0, aside.w-0=0, .viewport-hud>=2, .viewport-dots>=1; npm run build exits 0"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-07-15
status: complete
---

# Phase 24 Plan 01: Mobile Responsive Reflow (Container Queries) Summary

**Tailwind v4 container-query reflow that collapses the Atelier 4-step journey into a single portrait column at ~300px, pins a sticky canvas-first Refine pane above a full-width scrolling rail, and deletes the dead legacy drawer CSS — all as descendant-only @max-[640px] overrides so desktop is provably unregressed.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-15T23:03:18Z
- **Completed:** 2026-07-15T23:05:14Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added `@container` to the AtelierShell root `<div>` — the real full-width box that emits `container-type: inline-size` (D-01), so the query reaches RefineScreen's `<section>` (a genuine flex-item descendant).
- Flipped the App shell body to a single scrolling portrait column below 640px (`@max-[640px]:flex-col @max-[640px]:justify-start @max-[640px]:overflow-y-auto`) and turned the single-mount canvas `<main>` into a sticky ~45dvh canvas-first pane (`@max-[640px]:sticky top-0 h-[45dvh] flex-none z-10`) — the one `<CanvasViewer>` is only CSS-reordered, never remounted (D-14).
- Relaxed the RefineScreen rail to full-width on mobile (`@max-[640px]:w-full @max-[640px]:border-l-0`) with the existing inline control order unchanged — no drawer/overlay markup.
- Deleted the orphaned 40-line legacy drawer `@media (max-width: 767.98px)` block from index.css while preserving the live `.viewport-hud` base + mobile rules and `.viewport-dots` (D-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: Container-query root + canvas-first sticky reflow (AtelierShell + App)** - `646d3e6` (feat)
2. **Task 2: Relax the Refine controls rail to full-width on mobile** - `179ccde` (feat)
3. **Task 3: Delete dead legacy drawer CSS; preserve live .viewport-hud** - `fd305a9` (refactor)

## Files Created/Modified
- `src/features/wizard/AtelierShell.tsx` - Root `<div>` gains `@container`; base `flex flex-col h-dvh overflow-hidden` intact.
- `src/App.tsx` - Shell body gains `@max-[640px]:flex-col/justify-start/overflow-y-auto`; canvas `<main>` step-2 branch gains sticky canvas-first mobile utilities; non-step-2 branch still literal `'hidden'`; `<CanvasWorkspace>` call unchanged (single mount preserved).
- `src/features/screens/RefineScreen.tsx` - Root `<section>` gains `@max-[640px]:w-full @max-[640px]:border-l-0`; base `w-[360px]` untouched; control order unchanged.
- `src/index.css` - Dead drawer `@media (max-width: 767.98px)` block (aside overlay, aside.w-96, aside.w-0, drawer-era main padding, .drawer-backdrop) deleted; `.viewport-hud` (base + mobile) and `.viewport-dots` preserved.

## Decisions Made
- Chose arbitrary `@max-[640px]` over built-in `@max-2xl` (672px) for the flip — matches the ~640px natural break where the 360px rail + ~280px canvas can no longer coexist (D-02).
- Added `@max-[640px]:overflow-y-auto` to the shell body so it becomes the single mobile scroll region, giving the Refine sticky pane a scroll ancestor.
- Kept the sticky pane (D-03 primary path); did not apply the drop-sticky fallback — no cramping evidence at build time. The mobile-keyboard collision risk under the pinned pane is a documented UAT check (fallback: drop `@max-[640px]:sticky top-0`, keep the rest → non-sticky canvas-first; no JS hybrid).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Git emitted expected LF→CRLF warnings on Windows for the two `.tsx` edits (cosmetic, no impact).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MOBILE-01 layout reflow shipped and desktop-safe (tsc + build clean; base `flex-row`/`w-[360px]` grep-confirmed present).
- Ready for Plan 24-02 (touch pinch/pan + `touch-action: none` in viewer.ts) and Plan 24-03 (full desktop-unregressed + 240+ Vitest regression proof — the authoritative gate).
- Open UAT items (human judgment): visual single-column reflow at ~300px, sticky pane behavior, and the mobile-keyboard collision fallback trigger.

## Self-Check: PASSED

All 4 modified files present; all 3 task commits (646d3e6, 179ccde, fd305a9) found in git history.

---
*Phase: 24-mobile-responsive-touch-pass*
*Completed: 2026-07-15*
