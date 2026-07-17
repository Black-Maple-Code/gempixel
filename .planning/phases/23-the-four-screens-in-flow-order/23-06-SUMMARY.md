---
phase: 23-the-four-screens-in-flow-order
plan: 06
subsystem: ui
tags: [preact, strangler-fig, canvas-first, refactor, single-mount, viewport, gap-closure, testing]

# Dependency graph
requires:
  - phase: 20
    provides: "Single CanvasViewer mount + contents/hidden always-mounted step panels (D-14); App-is-sole-state-owner pure/props-only children (D-01)"
  - phase: 23-the-four-screens-in-flow-order
    plan: 01
    provides: "flags.ts (USE_NEW_* booleans) + four always-mounted screen panels"
  - phase: 23-the-four-screens-in-flow-order
    plan: 02
    provides: "UploadScreen (USE_NEW_UPLOAD=true) with the recent-project chips (D-10) that call App loadProject(id)"
provides:
  - "src/features/wizard/CanvasWorkspace.tsx — a pure/props-only component hosting the single-mount <canvas>, the viewport HUD (mode toggle + zoom controls + low-zoom warning), the print-canvas-sheet with left/right print legends, the bottom hint pill, the two-phase loading overlay, and the matchError + actionError banners. Byte-behavior-equivalent extraction of the region formerly inline in App's <main>."
  - "A hero-dropzone-free <main>: the legacy #hero-file-upload cream-on-dark empty-state prompt is deleted (the duplicate upload surface the UAT flagged) — when there is no image/match, CanvasWorkspace renders nothing in the canvas slot (UploadScreen owns ingestion, D-10)."
  - "App.test.tsx + print.test.tsx load saved projects via the always-mounted UploadScreen recent chips instead of the legacy left 'My Images' drawer — severing the test coupling so Plan 08 can delete the drawer without breaking these suites."
affects: [23-the-four-screens-in-flow-order (Plan 07 sidebar-collapse retire, Plan 08 shell flip), 25-strangler-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure/props-only region extraction that preserves a ref-bound single-mount element: canvasRef is threaded through as a prop and attached to the same <canvas>, so App's CanvasViewer init effect keeps binding the identical DOM node (D-14 single mount survives the re-parenting). Imperative viewer methods are wrapped as onZoomIn/onZoomOut/onFit handler props so viewerRef stays in App."
    - "Test-coupling migration ahead of a shell flip: re-point project-load helpers onto the NEW owner's affordance (UploadScreen chips) while the legacy shell still renders, so the later flip (Plan 08) is a green one-liner. Name-agnostic first-chip selector where a shared helper seeds varied project names."

key-files:
  created:
    - src/features/wizard/CanvasWorkspace.tsx
  modified:
    - src/App.tsx
    - src/__tests__/App.test.tsx
    - src/__tests__/print.test.tsx

key-decisions:
  - "CanvasWorkspace is a byte-behavior-equivalent extraction — every className, data-*/id, no-print/print:* class, and the print-legend-left/right markup preserved exactly; it owns NO domain state (App stays sole owner, D-01) and imports only types (RawMatch, ColorSymbolMap), no engine values."
  - "The duplicate hero empty-state dropzone (#hero-file-upload) is deleted, not moved: when there is no image/match the canvas slot renders nothing; UploadScreen (D-10) is the only ingestion surface, removing the cream-on-dark duplicate prompt the UAT flagged."
  - "Task 2 is LOAD-scoped per the plan: only helpers that opened the 'My Images' drawer to LOAD a saved project were re-pointed onto the chips. The drawer-specific DELETE assertion (button[title='Delete Image']) and the four it.skip TODO(25) legacy-panel tests were left untouched — they exercise drawer/panel affordances retired in Plan 08 / Phase 25, and the plan explicitly leaves nav/reset/collapse and non-load coverage to those plans."
  - "The print.test loadProjectToStep helper uses a name-agnostic selector ([data-screen=\"upload\"] .group.relative button — first chip's load button) because its tests seed differently-named single projects; the App.test per-block helpers filter by that block's single seeded name."

patterns-established:
  - "Extract a canvas-hosting region without remounting the canvas: pass the RefObject through as a prop and keep every viewer imperative call in App via wrapped handler props — the init effect keyed on image/matchResult continues binding the same element."

requirements-completed: [REFINE-01, UPLOAD-01]

coverage:
  - id: D1
    description: "CanvasWorkspace is a pure/props-only component hosting the single-mount <canvas> + viewport HUD + zoom controls + print legends + loading overlay + match/action error banners, rendered exactly once inside App's <main>; canvasRef binds the same element so the CanvasViewer never remounts on a step change (D-14)."
    requirement: "REFINE-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#keeps a single CanvasViewer mounted across step changes (SC4/D-14)"
        status: pass
      - kind: integration
        ref: "src/__tests__/App.test.tsx#renders exactly one step navigator — the StepBar (SC3/D-03)"
        status: pass
      - kind: other
        ref: "grep -c CanvasWorkspace src/App.tsx == 2 (one import + one JSX use); the single <canvas ref={canvasRef}> element lives only in CanvasWorkspace.tsx"
        status: pass
  - id: D2
    description: "The duplicate hero empty-state dropzone (#hero-file-upload) is deleted from <main> — UploadScreen (D-10) is the only ingestion surface; when there is no image/match the canvas slot renders nothing."
    requirement: "UPLOAD-01"
    verification:
      - kind: other
        ref: "git grep -n hero-file-upload src/App.tsx → no matches (duplicate prompt removed)"
        status: pass
      - kind: integration
        ref: "src/__tests__/App.test.tsx#renders base checklist / mounting suite green with UploadScreen as the sole upload surface (full App.test.tsx: 27 passed / 11 skipped)"
        status: pass
  - id: D3
    description: "App.test.tsx + print.test.tsx load saved projects via the always-mounted UploadScreen recent chips (same App loadProject(id)) instead of the legacy 'My Images' left drawer, so Plan 08 can delete the drawer without breaking these suites."
    requirement: "UPLOAD-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx (ERR-01 / WR-01 / BAG-02 / SC4-D13 blocks + the three inline load tests) — all load via [data-screen=\"upload\"] chips; suite green"
        status: pass
      - kind: integration
        ref: "src/__tests__/print.test.tsx#renders per-color supply rows + the matching savings headline in the report (+ CR-01 non-finite-cost load) — load via chip; suite green (15 tests / 1 skipped)"
        status: pass
  - id: D4
    description: "Byte-behavior-equivalent refactor: full Vitest suite + tsc stay green on the still-legacy shell (nothing user-visible flips this plan)."
    verification:
      - kind: integration
        ref: "npm test — 352 passed / 12 skipped / 0 failed (36 files); npx tsc --noEmit exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~22min
completed: 2026-07-15
status: complete
---

# Phase 23 Plan 06: Extract CanvasWorkspace + Sever Legacy-Drawer Test Coupling (Gap Closure 1/3) Summary

**Extracted the center-canvas preview region — the single-mount `<canvas>`, the viewport HUD (Grid/Symbols/Original toggle + zoom controls + low-zoom warning), the `print-canvas-sheet` with left/right print legends, the bottom hint pill, the two-phase loading overlay, and the matchError + actionError banners — out of App's `<main>` into a new pure/props-only `src/features/wizard/CanvasWorkspace.tsx`, threading `canvasRef` through as a prop so the CanvasViewer init effect keeps binding the identical element (D-14 single mount preserved) and wrapping the viewer's imperative zoom calls as `onZoomIn`/`onZoomOut`/`onFit` handler props so `viewerRef` stays in App. Deleted the duplicate `#hero-file-upload` cream-on-dark empty-state dropzone the UAT flagged (UploadScreen, D-10, is now the only ingestion surface). Re-pointed every project-LOAD helper in App.test.tsx + print.test.tsx off the soon-to-be-retired left "My Images" drawer and onto the always-mounted UploadScreen recent chips (same App `loadProject(id)`), so Plan 08 can delete the drawer without breaking those suites. Byte-behavior-equivalent — the legacy dark 3-column shell still renders; nothing user-visible flips. tsc 0; Vitest 352 pass / 12 skip / 0 fail.**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-07-15
- **Tasks:** 2 (2 atomic commits)
- **Files:** 4 (1 created, 3 modified)

## Accomplishments
- `src/features/wizard/CanvasWorkspace.tsx` — NEW pure/props-only component. `CanvasWorkspaceProps` interface (above the component, per convention) threads all 21 props: `canvasRef`, `image`, `matchResult`, `viewportMode` + `setViewportMode`, `onZoomIn`/`onZoomOut`/`onFit` (wrappers over `viewerRef.current?.zoomIn/zoomOut/fitToContainer` — the ref stays in App), `zoomScale`, `cols`, `rows`, `symbolMap`, `leftLegendColors`, `rightLegendColors`, `loading`, `loadingPhase`, `progress`, `matchError`, `actionError`, `onDismissActionError`. Owns NO domain state; imports only the `RawMatch` and `ColorSymbolMap` types (no engine values). Every className, `data-*`/`id`, `no-print`/`print:*` class, and the `print-legend-left`/`print-legend-right` markup preserved exactly.
- App's `<main>` now renders `<CanvasWorkspace {...props} />` once in place of the ~240-line inline region; the legacy left `<aside>`, right `<aside>`, and the collapse-expand buttons are untouched (retired in Plans 07/08).
- Deleted the `#hero-file-upload` hero dropzone else-branch: with no image/match, CanvasWorkspace renders nothing in the canvas slot (removes the duplicate upload prompt; UploadScreen owns ingestion, D-10).
- Re-pointed the project-load test helpers onto UploadScreen chips: the three inline load sites (Client A Commission / Null Image Project / Single Mount) + the ERR-01, BAG-02, and SC4/D-13 `loadProjectToStep`/`loadProject` helpers + the WR-01 `loadRow` helper (its `openDrawer` deleted). print.test's shared helper uses a name-agnostic first-chip selector.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract CanvasWorkspace + delete the duplicate hero upload prompt** — `c0f2639` (feat)
2. **Task 2: Re-point App.test.tsx + print.test.tsx project loads onto UploadScreen chips** — `c29e51d` (test)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) — `docs(23)` commit

## Files Created/Modified
- `src/features/wizard/CanvasWorkspace.tsx` - NEW pure/props-only center-canvas region (single-mount canvas + HUD + print legends + overlays/banners)
- `src/App.tsx` - Import + single `<CanvasWorkspace .../>` render replacing the inline region; `#hero-file-upload` dropzone deleted
- `src/__tests__/App.test.tsx` - Project-load helpers/sites re-pointed onto UploadScreen chips (`openDrawer` removed from WR-01)
- `src/__tests__/print.test.tsx` - `loadProjectToStep` loads via a name-agnostic UploadScreen chip selector

## Decisions Made
- CanvasWorkspace is a byte-behavior-equivalent extraction (D-01/D-14): `canvasRef` passed through and bound to the same `<canvas>`; viewer imperative calls wrapped as handler props; no domain state; types-only imports.
- The hero dropzone is deleted, not relocated — UploadScreen (D-10) is the sole ingestion surface; empty canvas slot renders nothing.
- Task 2 is LOAD-scoped per the plan: only drawer→load helpers were migrated. The drawer's DELETE assertion and the four `it.skip` TODO(25) legacy-panel tests were left untouched (retired in Plan 08 / Phase 25).

## Deviations from Plan

None — plan executed as written. (One in-scope test-infra adjustment: print.test's shared `loadProjectToStep` seeds differently-named projects across its tests, so the chip selector was made name-agnostic — first recent chip's load button — rather than filtering by a single hard-coded name. This is within Task 2's stated "update the shared helpers accordingly" latitude, not a deviation from plan intent.)

## Issues Encountered
- Initial print.test migration hard-coded the project name 'Print 16-04 Project' in the shared helper, which failed the CR-01 test (seeds 'CR-01 Tampered'). Resolved by switching to a name-agnostic first-chip selector (`[data-screen="upload"] .group.relative button`) since each test seeds exactly one project. Suite green after the fix (caught pre-commit; the fix is folded into the Task 2 commit).
- Expected stderr noise in the run ("worker exploded", "getContext not implemented", "navigation to another Document") is from canvas/worker/error-path tests — not failures; 352/352 active tests pass.

## Known Stubs
None. The deleted hero empty-state is an intentional removal (UploadScreen owns ingestion, D-10), not a stub; the empty canvas slot rendering nothing is by design. No hardcoded empty arrays/objects flow to the UI as fake data.

## Threat Model
- **T-23-06-01 (Tampering/XSS — project names from localStorage in chips):** mitigated — unchanged by this refactor. UploadScreen renders names as escaped text only (Preact default; no `dangerouslySetInnerHTML`); the same escaping holds for the CanvasWorkspace print legends (DMC codes / hex from the palette/match, rendered as text).
- **T-23-06-02 (Information disclosure — CanvasWorkspace extraction):** accepted — pure DOM re-parenting, no new data flow, no network egress; single-mount canvas identity preserved.
- No new threat surface introduced (no new endpoints, auth paths, file access, or schema changes).

## User Setup Required
None — no external service configuration required (the app stays 100% client-side).

## Next Phase Readiness
- **Ready for Plan 07 (sidebar-collapse retire) and Plan 08 (shell flip):** the center canvas is now a single reusable `CanvasWorkspace` component that can be dropped into the new viewport frame as Refine's preview column, and the two project-load test suites no longer depend on the legacy left drawer — so Plan 08 can delete the dark 3-column shell + the "My Images" drawer in one atomic, green commit.
- **Left for Plan 08 / Phase 25:** the drawer-specific DELETE test (`button[title="Delete Image"]`) and the four `it.skip` TODO(25) legacy-panel tests still reference legacy drawer/panel DOM — retire/re-home them when the shell + legacy Step bodies are deleted.
- **Invariants held:** single `<canvas>`/CanvasViewer mount preserved (D-14); App is still the sole state owner (D-01); `src/engine/` untouched; zero new dependencies; legacy shell still renders (nothing user-visible flipped).

## Self-Check: PASSED

- Files present: `src/features/wizard/CanvasWorkspace.tsx`, `src/App.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/print.test.tsx`.
- Commits present: `c0f2639` (feat, Task 1), `c29e51d` (test, Task 2).
- `npx tsc --noEmit` exit 0; `npm test` 352 passed / 12 skipped / 0 failed (36 files); `git grep hero-file-upload src/App.tsx` empty; CanvasWorkspace referenced exactly once in App's JSX; the single `<canvas ref={canvasRef}>` lives only in CanvasWorkspace.tsx.

---
*Phase: 23-the-four-screens-in-flow-order*
*Completed: 2026-07-15*
