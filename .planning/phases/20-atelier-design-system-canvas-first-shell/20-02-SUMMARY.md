---
phase: 20-atelier-design-system-canvas-first-shell
plan: 02
subsystem: ui
tags: [dark-mode-retirement, theme, localStorage, preact, vite, index.html]

# Dependency graph
requires:
  - phase: 20-01
    provides: "Atelier-light CSS flatten — deleted [data-theme] blocks so a stale data-theme attribute selects nothing (D-08 'by construction')"
provides:
  - "index.html with no anti-FOUC boot script and no data-theme attribute (SC1 resurrection vector removed)"
  - "App.tsx with the persisted-theme hook, [data-theme] DOM effect, and light/dark toggle removed"
  - "One-time boot safeStorage.removeItem('gempixel_theme') clearing abandoned dark residue (D-06)"
  - "Viewer CSS-var effect retained (the real theme->canvas path) with the dead theme dep dropped, marked // PHASE 22 (D-07)"
affects: [21-shared-ui-primitives, 22-additive-engine, 23-four-screens, 25-strangler-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dark-mode retirement is a value-source + boot-vector removal, not a runtime toggle — index.html is the load-bearing edit, not just App.tsx"
    - "Abandoned localStorage keys are cleared once on boot through the guarded safeStorage boundary (STORE-02), never a raw localStorage call"

key-files:
  created: []
  modified:
    - index.html
    - src/App.tsx

key-decisions:
  - "Routed the boot removeItem through safeStorage.removeItem (already imported) instead of a hand-rolled try/catch — reuses the STORE-02 guarded-storage convention and satisfies the removeItem('gempixel_theme') acceptance grep"
  - "Removed the data-theme attribute from <html> entirely (not left as data-theme=\"light\") — a bare <html lang=\"en\"> leaves zero theme residue and keeps the negative grep clean"

patterns-established:
  - "PHASE 22 marker convention: dead theme wiring that is kept-but-neutered (the viewer CSS-var effect) is tagged // PHASE 22 rather than deleted, since engine signatures are frozen until Phase 22"

requirements-completed: [DESIGN-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "index.html dark-mode resurrection vector removed — inline anti-FOUC boot script + hard-coded data-theme attribute deleted; module entry intact"
    requirement: "DESIGN-01"
    verification:
      - kind: other
        ref: "grep -c data-theme index.html == 0; grep -c gempixel_theme index.html == 0; grep -c dataset.theme index.html == 0; grep -c 'src/main.tsx' index.html == 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "App.tsx theme hook + [data-theme] DOM effect + light/dark toggle removed; one-time boot removeItem added; viewer CSS-var effect kept with theme dep dropped + PHASE 22 marker"
    requirement: "DESIGN-01"
    verification:
      - kind: other
        ref: "grep gempixel_theme src/App.tsx == 1 (removeItem only); setTheme == 0; dataset.theme == 0; PHASE 22 >= 1"
        status: pass
      - kind: unit
        ref: "npx vitest run — 246/246 pass (useWizard/App suites unbroken, SC5)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit exits 0 (no dangling theme/setTheme references)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC1 lived behavior — a returning dark-mode user sees no half-dark flash on reload"
    requirement: "DESIGN-01"
    verification: []
    human_judgment: true
    rationale: "The no-flash-on-reload experience is a visual/timing property no jsdom unit test asserts; satisfied by construction (D-08: no dark CSS from 20-01 + no boot script) but the actual reload appearance for a user with a stale gempixel_theme=dark key warrants a human glance."

# Metrics
duration: 2min
completed: 2026-07-13
status: complete
---

# Phase 20 Plan 02: Dark-Mode Resurrection-Vector Removal Summary

**Ripped out the App/HTML/boot dark-mode resurrection vectors — deleted the index.html anti-FOUC boot script + data-theme attribute and App.tsx's persisted-theme hook, DOM effect, and toggle; added a one-time boot removeItem and kept the viewer CSS-var effect (theme dep dropped) — so a returning dark-mode user can never see a half-dark UI again.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-13T23:41:13Z
- **Completed:** 2026-07-13T23:42:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Deleted the `index.html` inline anti-FOUC boot script (the actual dark-mode resurrection vector per RESEARCH §3c) that re-stamped `data-theme="dark"` from the persisted `gempixel_theme` key before Preact mounts, and removed the hard-coded `data-theme` attribute from `<html>`.
- Removed the `usePersistentState('gempixel_theme')` hook, the `document.documentElement.dataset.theme` DOM effect, and the light/dark pill toggle button from `App.tsx`; no `setTheme`/`dataset.theme` references remain.
- Added a single unconditional `safeStorage.removeItem('gempixel_theme')` in a mount-once effect (D-06 boot hygiene) so returning dark-mode users carry no residue.
- Kept the viewer CSS-var effect (the real theme→canvas mechanism that pushes `--drill-round-backing`/`--canvas-gap`, now always resolving to Atelier-light `:root` values) and dropped the dead `theme` dependency, tagged `// PHASE 22`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete the index.html dark-mode boot script and theme attribute** - `faa8233` (fix)
2. **Task 2: Remove theme hook/effect/toggle; add boot removeItem; drop theme from viewer deps** - `6e9be6d` (fix)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `index.html` - Removed the inline anti-FOUC theme boot script and the `data-theme` attribute; module entry (`/src/main.tsx`) untouched.
- `src/App.tsx` - Removed the theme hook + `[data-theme]` effect + toggle; added boot `removeItem`; retained the viewer CSS-var effect with `theme` dropped from its dep array and a `// PHASE 22` marker.

## Decisions Made
- Routed the boot clear through the already-imported `safeStorage.removeItem` rather than a hand-rolled try/catch — reuses the codebase's guarded-storage convention (STORE-02) and satisfies the `removeItem('gempixel_theme')` acceptance grep.
- Removed the `data-theme` attribute from `<html>` entirely (bare `<html lang="en">`) rather than leaving `data-theme="light"`, so the negative grep is clean and no theme residue remains.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `npx tsc --noEmit` exits 0; `npx vitest run` reports 246/246 passing (≥240 required, SC5) — no test asserts on dark mode, so the rip was test-safe. The jsdom `getContext()` warnings in App.test output are pre-existing canvas-in-jsdom noise, not failures.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Behavior half of DESIGN-01/SC1 is complete and pairs with Plan 20-01's CSS flatten — SC1 "no half-dark flash" is now satisfied by construction (no dark CSS, no boot script, no persisted key).
- App.tsx remains the state owner; the shell (SHELL-01/02) and `src/ui/` primitives are still deferred to Plans 20-04 / Phase 21 as planned. Engine signatures untouched (strangler rule intact).

## Self-Check: PASSED

- Commit `faa8233` (Task 1) present in history.
- Commit `6e9be6d` (Task 2) present in history.
- `index.html` and `20-02-SUMMARY.md` present on disk.
- Acceptance greps re-verified: `index.html` data-theme/gempixel_theme/dataset.theme == 0, src/main.tsx == 1; `src/App.tsx` gempixel_theme == 1 (removeItem only), setTheme == 0, dataset.theme == 0, PHASE 22 >= 1.
- `npx tsc --noEmit` exits 0; `npx vitest run` 246/246 pass.

---
*Phase: 20-atelier-design-system-canvas-first-shell*
*Completed: 2026-07-13*
