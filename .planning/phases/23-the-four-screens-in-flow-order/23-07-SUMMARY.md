---
phase: 23-the-four-screens-in-flow-order
plan: 07
subsystem: testing
tags: [preact, vitest, strangler-fig, canvas-first, refactor, gap-closure]

# Dependency graph
requires:
  - phase: 23-the-four-screens-in-flow-order
    plan: 06
    provides: "CanvasWorkspace extracted; project-LOAD test helpers re-pointed off the legacy 'My Images' drawer onto UploadScreen chips (gap-closure 1/3)"
  - phase: 23-the-four-screens-in-flow-order
    plan: 03
    provides: "RefineScreen (USE_NEW_REFINE=true) with the 'Advanced' <details> disclosure hosting the color-exclusion checklist (REFINE-01)"
provides:
  - "src/__tests__/integration.test.tsx — both color-exclusion tests re-pointed onto the RefineScreen 'Advanced' disclosure (step-2 panel), matching the surviving 'Exclude colors' copy/structure and the inverted `checked === excluded` semantics; five legacy-aside-coupled tests retired with inline strangler-retirement notes (highlight-on-legend-row-click, left-sidebar collapse, right DMC-supply-list collapse, right-workspace collapse, sortable DMC header)."
  - "src/__tests__/App.test.tsx — the sidebar-collapse test ('supports bottom bar navigation for responsive mobile drawer toggles', asserting the two asides' `w-0` state) retired with an inline note; no App.test assertion references `aside`/`w-0`/`w-80`/`w-96` anymore."
  - "A test suite with ZERO coupling to the legacy left sidebar or right Color-Legend/DMC aside — Plan 08 can delete both asides in one green commit."
affects: [23-the-four-screens-in-flow-order (Plan 08 shell flip), 25-strangler-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test-coupling migration ahead of a shell flip (continued from 23-06): re-point still-valid coverage onto the NEW owner's affordance while the legacy shell still renders, so the later flip is a green no-op. Here the color-exclusion checklist is asserted against the RefineScreen `<details>` 'Advanced' disclosure — shell-agnostic, surviving the flip — by driving the native details open (`el.open = true` + a synthetic `toggle` event) to mount the disclosure-gated list under jsdom."
    - "Strangler test retirement with an audit trail: each deleted `it(...)` block is replaced by an inline RETIRED comment recording WHAT behavior went away and WHY (deleted chrome), so coverage loss is explicit and greppable, never silent."

key-files:
  created: []
  modified:
    - src/__tests__/integration.test.tsx
    - src/__tests__/App.test.tsx

key-decisions:
  - "The two color-exclusion tests are RE-POINTED, not deleted — REFINE color-exclusion coverage survives the flip against the component that survives it (RefineScreen 'Advanced'). Only genuinely-deleted legacy chrome loses its tests."
  - "Inverted checkbox semantics handled explicitly: the legacy right-aside exclusion checkboxes were `checked === included` (start checked, uncheck to exclude); RefineScreen's are `checked === excluded` (start unchecked, check to exclude). The re-pointed toggle test now asserts `firstCheckbox.checked === false` and clicks to EXCLUDE — same net candidate-list-minus-1 assertion."
  - "The disclosure-gated exclusion list is mounted under jsdom by setting `details.open = true` and dispatching a synthetic `toggle` event, because RefineScreen gates the heavy list on its onToggle handler (`advancedOpen`), not on the `open` attribute alone."
  - "Five integration tests + one App.test test retired as intentional strangler retirement pulled forward from Phase 25 — they exercised chrome (sidebar collapse, right-aside legend collapse, sortable DMC list, highlight-on-legend-row-click) that Plan 08 deletes. The new SuppliesScreen table is display-only by design (SUPPLIES-01), covered by its own unit tests."
  - "Retirement comments were worded to avoid reproducing the exact legacy tokens ('Collapse Sidebar', 'Collapse Workspace', 'Expand color legend', 'w-80', 'w-96', 'Exclude Colors') so the plan's verification greps over src/__tests__ return cleanly — documentation without leaving grep-matchable legacy references."
  - "Dropped the now-unused `CanvasViewer` named import from integration.test.tsx (only `RealCanvasViewer` via `vi.importActual` remains) to satisfy `noUnusedLocals` after the highlight test — which held the last `expect(CanvasViewer)...` use — was retired."

patterns-established:
  - "Pattern: to test a disclosure-gated list under jsdom where the component keys mounting on onToggle, drive the native <details> imperatively — `el.open = true` then `el.dispatchEvent(new Event('toggle'))` — rather than clicking the summary (jsdom summary-click toggling is unreliable)."

requirements-completed: [REFINE-01, SUPPLIES-01]

coverage:
  - id: D1
    description: "Both color-exclusion integration tests re-pointed onto the RefineScreen 'Advanced' disclosure (step-2 panel): 'renders base checklist options correctly' opens the <details> and asserts exclude checkboxes mount; 'toggles sub-palette checkboxes…' toggles the first color (inverted semantics) and asserts the worker candidate list shrinks by 1 (DMC_PALETTE.length - 1). REFINE color-exclusion coverage survives the Plan 08 flip."
    requirement: "REFINE-01"
    verification:
      - kind: integration
        ref: "src/__tests__/integration.test.tsx#renders base checklist options correctly"
        status: pass
      - kind: integration
        ref: "src/__tests__/integration.test.tsx#toggles sub-palette checkboxes, filters candidates list, and triggers worker matches"
        status: pass
  - id: D2
    description: "Legacy right-aside interactive-legend tests retired (highlight-on-legend-row-click, sortable DMC header) because the canvas-first SuppliesScreen table is display-only by design (SUPPLIES-01) — those behaviors cease to exist at the flip; SuppliesScreen's own unit tests cover the surviving display table. The full Vitest suite is green after the retirement."
    requirement: "SUPPLIES-01"
    verification:
      - kind: integration
        ref: "npm test — 346 passed / 12 skipped / 0 failed (36 files)"
        status: pass
  - id: D3
    description: "Legacy sidebar/aside-collapse tests retired across both files (left-sidebar collapse + right DMC-supply-list collapse + right-workspace collapse in integration.test.tsx; the bottom-tab drawer-toggle test asserting both asides' w-0 state in App.test.tsx). No test references the legacy asides' collapse chrome; Plan 08 can delete both asides without breaking a single test."
    verification:
      - kind: other
        ref: "git grep -n \"querySelectorAll('aside')\" src/__tests__ → empty; git grep -nE 'Collapse Sidebar|Collapse Workspace|Expand color legend|w-80|w-96' src/__tests__ → empty; git grep -nF 'Exclude Colors' src/__tests__ → empty"
        status: pass
      - kind: integration
        ref: "src/__tests__/App.test.tsx — 26 passed / 11 skipped; npx tsc --noEmit exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~14min
completed: 2026-07-15
status: complete
---

# Phase 23 Plan 07: Sever Legacy-Aside Test Coupling (Gap Closure 2/3) Summary

**Severed the remaining Vitest coupling to the legacy left sidebar and the right Color-Legend/DMC aside: re-pointed both color-exclusion tests onto the surviving RefineScreen "Advanced" disclosure (matching the "Exclude colors" copy and the inverted `checked === excluded` semantics, driving the native `<details>` open under jsdom), and retired five integration tests + one App.test test that exercised deleted chrome (sidebar collapse, right-aside legend collapse, sortable DMC list, highlight-on-legend-row-click) — each with an inline strangler-retirement note. Nothing in the suite now depends on the two asides Plan 08 deletes. tsc 0; Vitest 346 pass / 12 skip / 0 fail.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-07-15
- **Tasks:** 2 (2 atomic commits)
- **Files modified:** 2

## Accomplishments
- **Re-pointed color-exclusion coverage (REFINE-01) onto the surviving RefineScreen "Advanced" disclosure.** Both integration tests (`renders base checklist options correctly`, `toggles sub-palette checkboxes…`) now scope to `[data-step-panel="2"]`, open the native `<details>` by setting `open = true` + dispatching a synthetic `toggle` event (RefineScreen gates the heavy exclusion list on its onToggle → `advancedOpen`), and assert the exclude checkboxes there — matching the surviving `"Exclude colors"` (lowercase) structure rather than the legacy right-aside `"Exclude Colors"` string. The toggle test accounts for the inverted `checked === excluded` semantics (checkboxes start UNCHECKED; clicking one EXCLUDES that color) and still asserts the worker candidate list shrinks to `DMC_PALETTE.length - 1`.
- **Retired five legacy-aside-coupled integration tests**, each with an inline `RETIRED (23-07…)` note: highlight-on-legend-row-click, left-sidebar collapse, right DMC-supply-list collapse, right-workspace collapse, sortable DMC header. All exercised chrome that Plan 08 deletes; the SuppliesScreen table is display-only by design (SUPPLIES-01) and covered by its own unit tests.
- **Retired the App.test.tsx sidebar-collapse test** (`supports bottom bar navigation for responsive mobile drawer toggles`) that asserted the two asides' `w-0` collapse state via the mobile bottom-tab bar — replaced with a retirement note; canvas-first navigation stays covered by the surviving StepBar / `#wizard-*-btn` tests.
- **Verification greps clean:** `querySelectorAll('aside')`, the legacy collapse tokens (`Collapse Sidebar|Collapse Workspace|Expand color legend|w-80|w-96`), and `Exclude Colors` all return nothing across `src/__tests__`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-point color-exclusion coverage + retire legacy-aside tests in integration.test.tsx** — `907acbc` (test)
2. **Task 2: Retire the sidebar-collapse test in App.test.tsx** — `af1caeb` (test)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) — `docs(23)` commit

## Files Created/Modified
- `src/__tests__/integration.test.tsx` - Both color-exclusion tests re-pointed onto the RefineScreen "Advanced" disclosure; five legacy-aside tests retired with inline notes; unused `CanvasViewer` import dropped.
- `src/__tests__/App.test.tsx` - Sidebar-collapse (bottom-tab drawer-toggle) test retired with an inline note; no remaining `aside`/`w-0`/`w-80`/`w-96` assertions.

## Decisions Made
- Re-point (not delete) the two color-exclusion tests so REFINE-01 coverage survives against RefineScreen; only genuinely-deleted chrome loses tests.
- Handle the inverted checkbox semantics explicitly (legacy `checked === included` → RefineScreen `checked === excluded`); the re-pointed toggle test asserts the checkbox starts unchecked and clicks to exclude.
- Mount the disclosure-gated list under jsdom via `details.open = true` + a synthetic `toggle` event (RefineScreen keys mounting on onToggle, not the `open` attribute alone).
- Word the retirement comments to avoid reproducing the exact legacy tokens so the plan's verification greps return cleanly — documentation without grep-matchable legacy references.
- Drop the now-unused `CanvasViewer` named import (last use was in the retired highlight test) to satisfy `noUnusedLocals`.

## Deviations from Plan

None — plan executed exactly as written. (Two small in-scope adjustments within the plan's stated latitude: (1) dropped the unused `CanvasViewer` import once the highlight test — its last consumer — was retired, required by `noUnusedLocals`; (2) reworded the mandated inline retirement comments to avoid the literal legacy tokens the verification greps search for, so the plan's own `git grep … returns nothing` checks pass while still documenting each retirement.)

## Issues Encountered
- The plan's verification greps require the legacy tokens (`Collapse Sidebar`, `w-96`, `Exclude Colors`, etc.) to return nothing across `src/__tests__`, but the plan also mandates inline retirement comments documenting those very behaviors. Resolved by wording the comments descriptively (e.g. "the left-sidebar collapse/expand affordance", "the right Color Legend fixed-width workspace aside") instead of quoting the literal button-title/class tokens — both the documentation requirement and the grep-clean verification are satisfied.
- Expected stderr noise in the full run ("worker exploded", "getContext not implemented", "navigation to another Document") is from canvas/worker/error-path tests — not failures; all 346 active tests pass.

## Known Stubs
None. This plan only modifies test files (re-points + retirements); no product source changed, no stubbed data introduced.

## Threat Model
- **T-23-07-01 (Repudiation/coverage-loss — retiring legacy-aside tests):** mitigated. Color-exclusion coverage is re-pointed (not dropped) onto the surviving RefineScreen "Advanced" disclosure; the SuppliesScreen display table is covered by its own unit tests; only genuinely-deleted chrome (sidebar/aside collapse, sortable legend, highlight-on-row-click) loses tests, each documented inline as intentional strangler retirement.
- No new threat surface introduced — test-only edits, no product code, no new endpoints/auth/file-access/schema.

## User Setup Required
None — no external service configuration required (the app stays 100% client-side).

## Next Phase Readiness
- **Ready for Plan 08 (shell flip):** the Vitest suite has ZERO coupling to the legacy left sidebar or the right Color-Legend/DMC aside. `git grep "querySelectorAll('aside')" src/__tests__` and the collapse/exclude token greps all return nothing, so Plan 08 can delete both asides + the collapse chrome in one atomic, green commit.
- **Invariants held:** product source untouched (test-only plan); RefineScreen color-exclusion coverage preserved (REFINE-01); legacy shell still renders (nothing user-visible flipped this plan); tsc 0; Vitest 346 pass / 12 skip / 0 fail.
- **Left for Plan 08 / Phase 25:** the drawer-specific DELETE test (`button[title="Delete Image"]`) and the four `it.skip` TODO(25) legacy-panel tests still reference legacy drawer/panel DOM — retire/re-home when the shell + legacy Step bodies are deleted.

## Self-Check: PASSED

- Files present: `src/__tests__/integration.test.tsx`, `src/__tests__/App.test.tsx`.
- Commits present: `907acbc` (test, Task 1), `af1caeb` (test, Task 2).
- `npx tsc --noEmit` exit 0; `npm test` 346 passed / 12 skipped / 0 failed (36 files); all three plan verification greps over `src/__tests__` return nothing.

---
*Phase: 23-the-four-screens-in-flow-order*
*Completed: 2026-07-15*
