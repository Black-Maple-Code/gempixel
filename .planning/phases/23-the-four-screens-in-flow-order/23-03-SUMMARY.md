---
phase: 23-the-four-screens-in-flow-order
plan: 03
subsystem: ui
tags: [preact, strangler-fig, feature-flags, refine, two-tier-reactivity, canvas-first, keystone]

# Dependency graph
requires:
  - phase: 23-the-four-screens-in-flow-order
    plan: 01
    provides: "flags.ts (USE_NEW_* booleans) + pure RefineScreen shell + App data-step-panel ternaries"
  - phase: 23-the-four-screens-in-flow-order
    plan: 02
    provides: "USE_NEW_UPLOAD=true + the 7 it.skip'd TODO(23-03) size/preset/stale/recent tests to re-home"
  - phase: 22-additive-engine-density-color-reducer-single-source-quote
    provides: "detectedColorCount + enableReduce/targetColorCount post-process params on useDiamondArtMatch; gridToInches/formatInches"
  - phase: 21-shared-ui-primitives
    provides: "SizeCard / SegmentedControl / Slider primitives"
provides:
  - "RefineScreen — full pure/props-only keystone: SizeCards (worker tier) + edge-cleanup SegmentedControl + color Slider (post-process tier) + Advanced <details> (kit/exclude/shape)"
  - "USE_NEW_REFINE=true — panel-2 renders RefineScreen; two-tier reactivity seam (D-03/D-04) wired end-to-end"
  - "App enableReduce/targetColorCount state (first real consumer of the Phase 22 reducer) + detectedColorCount destructure + curated REFINE_SIZE_PRESETS"
  - "RefineScreen render test locking the two-tier seam, stable slider max, and Advanced defaults"
affects: [23-04-supplies, 23-05-order, 25-strangler-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-tier reactivity seam: size = worker tier (live cols/rows → existing soft-invalidate/Recompute, no per-click worker); edge-cleanup + color slider = main-thread post-process (live, no worker, no staleness)"
    - "Stable slider max pinned to detectedColorCount (raw-keyed), never a post-reduce counts length, so the thumb never jumps under drag (Pitfall 3)"
    - "SizeCard values fully derived in App (gridToInches/formatInches + cols*rows), rendered verbatim by the dumb card (Pattern 2)"
    - "Strangler flip bridging: re-home salvageable coverage to the new owner; delete no-longer-applicable cases with an inline rationale; skip newly-displaced legacy-DOM cases with a TODO(next) marker"

key-files:
  created:
    - src/features/screens/__tests__/RefineScreen.test.tsx
  modified:
    - src/features/screens/RefineScreen.tsx
    - src/features/screens/flags.ts
    - src/features/screens/__tests__/flags.test.ts
    - src/App.tsx
    - src/__tests__/App.test.tsx
    - src/__tests__/integration.test.tsx

key-decisions:
  - "Size selection is worker tier only: onSelectSize sets live cols/rows (+ width/height input strings) and NEVER fires the worker — the existing Phase 20 D-13 soft-invalidate owns the single Recompute (D-04, avoids the B2 abort-race)"
  - "enableReduce defaults false + targetColorCount sentinel 256 → slider thumb sits at detectedColorCount and the reduce step stays a byte-identical no-op until the user lowers it (SC5)"
  - "Advanced kit rendered as a native <select> (value bound to selectedBaseKit) so the display-isolation test still finds the panel-2 kit select post-flip; drill-shape is a SegmentedControl"
  - "Two presentational disclosure flags in RefineScreen (customOpen + advancedOpen); advancedOpen also gates the ~250-checkbox color-exclusion list so it is not mounted while Advanced is collapsed (perf) — no domain state (D-01 preserved)"
  - "Legacy drill-TYPE select + auto-substitution UI lost their panel-2 home on the flip and have no canvas-first equivalent yet → skipped with TODO(25), not silently dropped"

patterns-established:
  - "When a strangler flag flip displaces a legacy control with no new-UI home, skip its test with an explicit TODO(next-phase) marker rather than deleting coverage that may return; delete only when the concept genuinely no longer applies (with a one-line rationale)"

requirements-completed: [REFINE-01, REFINE-02, REFINE-03, REFINE-04, REFINE-05]

coverage:
  - id: T1
    description: "One SizeCard per curated preset renders its App-derived inch string + drill count; the selected preset is aria-pressed"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/RefineScreen.test.tsx#renders one SizeCard per preset with its inch string + drill count"
        status: pass
    human_judgment: false
  - id: T2
    description: "A size-card click calls onSelectSize(cols,rows) and NEVER onRecompute (worker tier is App's soft-invalidate, D-03/D-04)"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/RefineScreen.test.tsx#size-card click calls onSelectSize(cols, rows) and NEVER onRecompute"
        status: pass
    human_judgment: false
  - id: T3
    description: "The color Slider max === detectedColorCount (stable under drag, Pitfall 3) and input reports a number to onColorTargetChange"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/RefineScreen.test.tsx#renders the color Slider with max === detectedColorCount and reports numeric input"
        status: pass
    human_judgment: false
  - id: T4
    description: "Edge cleanup is a role=radiogroup of four; selecting a segment calls onEdgeCleanupChange (post-process tier)"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/RefineScreen.test.tsx#edge cleanup is a role=\"radiogroup\" of four options"
        status: pass
    human_judgment: false
  - id: T5
    description: "Advanced <details> is closed by default; kit defaults all, drill-shape defaults square (REFINE-05/D-06)"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/RefineScreen.test.tsx#Advanced is a <details> closed by default with kit=all and shape=square selected"
        status: pass
    human_judgment: false
  - id: T6
    description: "Recompute affordance renders only when stale; clicking calls onRecompute"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/RefineScreen.test.tsx#renders the Recompute affordance only when stale, and clicking it calls onRecompute"
        status: pass
    human_judgment: false
  - id: T7-rehome
    description: "Re-homed size coverage against RefineScreen: custom-size grid edit, SizeCard select + applied dims, aspect-ratio auto-adjust, soft-invalidate/Recompute via a size change"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx (custom-size entry, SizeCards, SC4/D-13 stale) + src/__tests__/integration.test.tsx (ratio, card dims)"
        status: pass
    human_judgment: false
  - id: D-swap
    description: "USE_NEW_REFINE=true; panel-2 renders RefineScreen; Supplies/Order stay false; full suite + tsc green"
    verification:
      - kind: integration
        ref: "npm test — 334 passed / 2 skipped / 0 failed (33 files); npx tsc --noEmit exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 34min
completed: 2026-07-14
status: complete
---

# Phase 23 Plan 03: Refine Keystone Screen (REFINE-01..05) Summary

**Swapped in the keystone Refine screen and flipped `USE_NEW_REFINE` on, wiring the LOCKED two-tier reactivity seam exactly: SizeCards + custom-size entry are the worker tier (set live cols/rows → the existing Phase 20 D-13 soft-invalidate → a single "Recompute match" CTA, no per-click worker re-fire), while the edge-cleanup SegmentedControl and color Slider are pure main-thread post-processes (live every tick, no worker, no staleness). The color slider's `max` is pinned to `detectedColorCount` (raw-keyed, stable under drag); `enableReduce` defaults off so the reducer is a byte-identical no-op until the user lowers it (SC5). All 7 TODO(23-03) skips are resolved — 5 re-homed against RefineScreen, 2 deleted as no-longer-applicable — with two newly-displaced legacy controls (drill-type select, auto-substitution UI) skipped under clear TODO(25) markers. Engine frozen; tsc + Vitest green (334 pass / 2 skip).**

## Performance

- **Duration:** ~34 min
- **Completed:** 2026-07-14
- **Tasks:** 3
- **Files:** 7 (1 created, 6 modified)

## Accomplishments
- `RefineScreen.tsx` — full pure/props-only keystone (UI-SPEC A2): "How big should it be?" heading + a vertical stack of `SizeCard`s (App-derived inches + live drill counts, selected = `cols===preset.cols && rows===preset.rows`, "BEST" tag on the recommended 80×53), a "Custom size" accent-link toggle revealing grid-native cols/rows inputs bound to `widthInput`/`heightInput`; an `EDGE CLEANUP` `SegmentedControl` (Off/Light/Med/Strong → smoothing 0–3); a `COLOR COUNT · {current} of {detected} matched` `Slider` (`min=8`, `max=detectedColorCount`, `onInput`-live) + caption; and an `Advanced` native `<details>` (closed by default) holding kit `<select>` (default all), drill-shape SegmentedControl (default square), and a lazily-mounted color-exclusion list. A rail-local stale/Recompute cue renders only when `stale`.
- `App.tsx` — new `enableReduce` (false) + `targetColorCount` (256 sentinel) state passed into `useDiamondArtMatch` (post-process params only — the worker effect deps are unchanged, SC5); `detectedColorCount` destructured from the hook; curated `REFINE_SIZE_PRESETS` (Small/Medium/Large/Extra large in grid dims) with App-computed inch strings (`gridToInches`/`formatInches`) + drill counts; a full `refineProps` bag mapping edge-cleanup ↔ `enableSmoothing`/`smoothingStrength`, the slider ↔ `enableReduce`/`targetColorCount` (clamped `[8, detectedColorCount]`), size ↔ live `setCols`/`setRows`, and stale ↔ `isStale`/`handleRecomputeMatch`.
- `flags.ts` `USE_NEW_REFINE=true` (one flag per commit); `flags.test.ts` assertion updated in the same commit.
- `RefineScreen.test.tsx` — 7 jsdom cases locking the two-tier seam, the stable slider max, and the Advanced defaults.

## Task Commits

1. **Task 1: wire App refine two-tier props + implement RefineScreen (flag off)** — `b76e1e1` (feat)
2. **Task 2: flip USE_NEW_REFINE on; re-home/bridge legacy size tests** — `3df23ca` (feat)
3. **Task 3: RefineScreen render test — two-tier seam, slider max, defaults** — `652aee1` (test)

## Re-homing the 7 TODO(23-03) skips

| Original (skipped in 23-02) | Resolution | New home |
|---|---|---|
| App: `allows changing width and height … grid mode` | **Re-homed** | Refine custom-size entry (`#refine-width`/`#refine-height`) |
| App: `allows changing physical sizing units` | **Deleted (rationale)** | cm/inch/grid switcher is legacy; the canvas-first custom entry is grid-native (D-05) |
| App: `displays Recommended PrintKK Sizes … selecting them` | **Re-homed** | RefineScreen SizeCards (curated grid presets replace aspect-ratio recs); asserts inches + drill count + applied dims |
| App: `marks downstream stale … imageless Recompute (ME-01)` | **Re-homed** | Size change now via a SizeCard click; all soft-invalidate/Recompute assertions retained |
| Integration: `automatically adjusts height … when width changes` | **Re-homed** | Refine custom-size width input (App `handleWidthChange` still owns the ratio math) |
| Integration: `updates dimensions and units when preset … changes` | **Re-homed** | SizeCard select applies grid dims (the "units" half dropped — grid-native, D-05) |
| Integration: `tracks loaded images in recent uploads list …` | **Deleted (rationale)** | Legacy recent-UPLOADS raw-image strip; new Upload shows recent PROJECTS (D-10) |

Result: **0 skipped tests remain from the TODO(23-03) set.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bridged 2 legacy Step2Palette-coupled tests displaced by the flag flip**
- **Found during:** Task 2 (`npm test` after flipping `USE_NEW_REFINE`).
- **Issue:** Flipping the flag replaced the legacy `Step2Palette` DOM in panel-2. Two currently-green tests were hard-coupled to controls that have **no canvas-first home**: the drill-TYPE `<select>` (`updates the per-bag-size price presets when drill type changes`) and the auto-substitution checkbox + threshold slider (`supports auto-substitution UI toggles and threshold settings in Step 4`). RefineScreen's Advanced holds kit/color-exclude/drill-SHAPE (REFINE-05) — not drill type; and the color slider (REFINE-04) supersedes the substitution UI.
- **Fix:** Skipped both with explicit `TODO(25)` markers (the underlying `enableSubstitution`/priceDb-preset behaviors still run with their defaults; only the UI drivers left panel-2). These are candidates for re-home or retirement in the Phase 25 strangler cleanup.
- **Files modified:** `src/__tests__/App.test.tsx`
- **Commit:** `3df23ca`

**2. [Rule 3 - Blocking] Second presentational disclosure flag for the exclusion list**
- **Found during:** Task 1 (RefineScreen implementation).
- **Issue:** The plan permits "a local 'custom-size expanded' presentational flag" only. Rendering the ~250-entry color-exclusion list unconditionally inside the always-mounted panel-2 `<details>` would mount 250 checkboxes on every App render.
- **Fix:** Added a second presentational-only `advancedOpen` flag (driven by `<details onToggle>`) that gates ONLY the heavy exclusion list; kit `<select>` + drill-shape render always so the display-isolation test still finds the panel-2 kit select. No domain state introduced (D-01 preserved).
- **Files modified:** `src/features/screens/RefineScreen.tsx`
- **Commit:** `b76e1e1`

**3. [Note] "Match colors →" rail CTA not rendered**
- The UI-SPEC lists a "Match colors →" rail-footer button, but the plan's `refineProps` surface has no advance/continue handler — forward navigation is owned by the shell's wizard Next button. A dead button would violate props-only purity, so it was omitted. Advancement is unaffected.

## Threat Model
- **T-23-03-01 (DoS — custom-size numeric entry):** mitigated. RefineScreen forwards raw strings; App's existing `handleWidthChange`/`handleHeightChange` own the clamp (`Math.max(1, Math.round(...))`, NaN-guarded). `targetColorCount` is clamped to `[8, detectedColorCount]` in `onColorTargetChange`.
- **T-23-03-02 (Tampering — reduce no-op default):** accepted. `enableReduce` defaults false; `matchResult` stays byte-identical until the user lowers the slider (SC5).
- **T-23-SC (npm installs):** accepted; zero packages installed this plan.

## Issues Encountered
- The jsdom `getContext()` "Not implemented" / "worker exploded" lines in test output are pre-existing environment noise from canvas/worker tests, not failures — 334/334 active tests pass.

## Next Phase Readiness
- 23-04 (Supplies) flips `USE_NEW_SUPPLIES`, expands `SuppliesScreenProps`, and must add an App-level `buildOrderQuote(...)` for the single-source itemized summary (D-07).
- Strangler invariant holds: exactly one flag flipped; single `<CanvasViewer>` mount and the `contents`/`hidden` toggle untouched; legacy `Step2Palette` dormant behind the false-less branch (removal is Phase 25).
- Two `TODO(25)` skips (drill-type select, auto-substitution UI) await a canvas-first home or retirement in the Phase 25 strangler cleanup.

## Self-Check: PASSED

- Files present: `RefineScreen.tsx`, `RefineScreen.test.tsx`, `flags.ts`, `flags.test.ts`, `App.tsx`, `App.test.tsx`, `integration.test.tsx`.
- Commits present: `b76e1e1`, `3df23ca`, `652aee1`.
- `npx tsc --noEmit` exit 0; `npm test` 334 passed / 2 skipped / 0 failed; `USE_NEW_REFINE === true`, Supplies/Order flags `false`; `src/engine/` + `src/features/match/` untouched by this plan.

---
*Phase: 23-the-four-screens-in-flow-order*
*Completed: 2026-07-14*
