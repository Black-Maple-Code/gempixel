---
phase: 25-retire-legacy-steps-cleanup
plan: 04
subsystem: refine-recompute-ux
tags: [D-02, D-04, D-06, auto-recompute, refine, stale-retire, rail-cap, refit]
requires:
  - "handleRecomputeMatch + setMatchInputs fire-once soft-invalidate commit (P20 D-13)"
  - "CanvasViewer.fitToContainer + isFitMode resting state (Plan 25-03)"
  - "RefineScreen SizeCards + custom width/height handlers (P23)"
provides:
  - "Fully automatic recompute on a dimension change — SizeCard immediate, custom-size ~500ms debounced + clamp-guarded"
  - "Clean canvas re-fit on a committed dimension change (no zoom-jump), driven by the setData effect"
  - "Width-capped Refine rail (max-w-[320px]) and a state-driven Advanced disclosure affordance (caret + settings hint)"
affects:
  - "Plan 25-05 (D-08 ingest auto-advance) inherits the retired manual-Recompute surface; image-swap commit remains its domain"
tech-stack:
  added: []
  patterns:
    - "Debounce via a useRef<number> setTimeout/clearTimeout timer (zero new deps, browser-native)"
    - "Explicit-override recompute (handleRecomputeMatch(nextCols,nextRows)) to avoid same-tick stale React state"
    - "Re-fit-on-dimension-change centralized in the setData effect (keyed on committed dims), not inline handler calls"
key-files:
  created: []
  modified:
    - "src/App.tsx (auto-fire wiring, debounce, re-fit trigger, all stale surfaces removed)"
    - "src/features/screens/RefineScreen.tsx (stale/onRecompute props + rail cue removed; rail capped; Advanced affordance)"
    - "src/features/wizard/StepBar.tsx (stale prop + amber marker removed)"
    - "src/features/wizard/AtelierShell.tsx (stale pass-through removed)"
    - "src/__tests__/App.test.tsx (D-02 tests retargeted to the auto-recompute contract)"
    - "src/features/screens/__tests__/RefineScreen.test.tsx (coupled stale/onRecompute + Advanced-affordance tests retargeted)"
decisions:
  - "Re-fit lives in the setData effect keyed on committed dims (fits AFTER new dims are installed → correct fit, no zoom-jump) rather than literal inline fitToContainer() in onSelectSize/debounce (which would fit the OLD grid)"
  - "handleRecomputeMatch gains optional (nextCols,nextRows) overrides so a synchronous SizeCard fire and the debounced custom fire commit fresh dims, never same-tick stale React state"
  - "MIN_GRID = 1 (mirrors the ingest Math.max(1,…) clamp); the ~500ms debounce collapses in-progress keystrokes so a transient '1' never fires a garbage run"
metrics:
  duration: ~35m
  completed: 2026-07-16
status: complete
---

# Phase 25 Plan 04: Refine Auto-Recompute + Stale Retire Summary

Reversed the Phase 20 D-13 soft-invalidate → manual-Recompute UX in favour of fully
automatic recompute (D-02): a SizeCard click recomputes immediately, a custom-size edit
recomputes on a clamp-guarded ~500ms debounce, and a committed dimension change re-fits
the canvas cleanly (no zoom-jump) riding the Plan 25-03 `isFitMode` default. Every manual
stale surface (page banner, rail Recompute CTA, StepBar amber marker, forward-nav block)
is deleted across App/RefineScreen/StepBar/AtelierShell, the Refine rail is width-capped
(D-06), the Advanced disclosure gained a clickable affordance (SC5), and the coupled tests
were retargeted in the same commits (P23 precedent). The worker path (`handleRecomputeMatch`
/ `setMatchInputs`) and the ME-01 imageless guard were reused, not rewritten.

## What Was Built

- **Auto-fire recompute (App.tsx):**
  - `onSelectSize` sets live cols/rows AND calls `handleRecomputeMatch(c, r)` immediately
    (discrete preset — safe single fire).
  - `handleWidthChange` / `handleHeightChange` schedule a `scheduleCustomRecompute(cols, rows)`
    on a `useRef<number>` `setTimeout`/`clearTimeout` ~500ms debounce, clamp-guarded by
    `image && cols >= MIN_GRID && rows >= MIN_GRID` so a half-typed / imageless value never fires.
  - `handleRecomputeMatch` extended to `(nextCols = cols, nextRows = rows)` so a synchronous
    or debounced fire commits the freshly computed dims, never same-tick stale React state.
    The ME-01 imageless guard (`'Re-upload the source image to recompute the match.'`) and the
    `setMatchInputs` fire-once commit are preserved verbatim.
- **Clean re-fit on dimension change (App.tsx):** the viewer-sync effect now also fits when the
  committed dims change (`lastFitDimsRef` keyed on `${matchCols}x${matchRows}`), fitting AFTER
  `setData` installs the new dims — so the fit is correct for the NEW size with no zoom-jump.
  A post-process slider tick (same dims) never re-fits. Rides the Plan 25-03 `isFitMode` default.
- **Stale surfaces retired:** deleted `isStale`/`staleFromStep`, `nextBlockedByStale`, the
  `guardedGoTo` stale gate (nav now uses `wizard.goTo`/`wizard.next` directly), the page-level
  "out of date" banner, the RefineScreen `stale`/`onRecompute` props + rail cue, the StepBar
  `stale` prop + amber `data-stale` marker, and the AtelierShell pass-through.
- **Rail cap + Advanced affordance (RefineScreen):** rail `w-[360px] max-w-full` → `w-full max-w-[320px]`
  (canvas stays flex-1, mobile classes kept); the Advanced `<summary>` gained a state-driven caret
  (`▸` rotating on `advancedOpen`), a "kit · colors · shape" settings hint, and the native marker hidden.
- **Tests retargeted:** the two D-02 App tests now assert auto-recompute + last-good retention +
  ME-01 re-upload prompt + never-blocked nav (no banner/marker/CTA assertions); RefineScreen tests
  drop the removed props and add an Advanced-affordance assertion.

## Verification

- `npx tsc --noEmit` exits 0 (no output).
- `npm test` (full suite): 36 files, **364 passed**, 7 skipped — above the 240 SC4 floor
  (prior baseline 363; net +1 from the RefineScreen test retarget).
- Task greps: `nextBlockedByStale`/`staleFromStep`/`isStale` gone from App.tsx; `onRecompute`
  gone from RefineScreen; `data-stale` gone from StepBar + App.test; `max-w-[320px]`=1 /
  `w-[360px]`=0; caret `▸` + `kit · colors · shape` present; `stale` gone from AtelierShell.
- Prohibitions preserved: `setMatchInputs` (6) and `handleRecomputeMatch` (4) still present;
  `Re-upload the source image` (1) retained; `fitToContainer` (4) ≥ 2. The plan-04 diff
  (`git diff --name-only HEAD~3..HEAD`) excludes engine/export.ts, engine/checkout.ts,
  Step3Canvas.tsx, and screens/flags.ts.

## Deviations from Plan

### Auto-fixed / discretion-applied

**1. [Rule 3 - Blocking] Retargeted `src/features/screens/__tests__/RefineScreen.test.tsx`**
- **Found during:** Task 2 (`npx tsc --noEmit`).
- **Issue:** removing `stale`/`onRecompute` from `RefineScreenProps` broke this coupled test's
  typecheck (it seeded those props and asserted the removed rail Recompute CTA).
- **Fix:** dropped the removed props from `makeProps`, retargeted the "size-card click never
  fires onRecompute" test to just assert `onSelectSize`, replaced the "Recompute affordance only
  when stale" test with "carries NO rail Recompute affordance" + a new "Advanced summary shows a
  caret + settings hint (SC5)" test. Same-commit retarget (P23 precedent).
- **Commit:** e8743fc.

**2. [Discretion - PATTERNS-sanctioned] Re-fit implemented in the setData effect, not inline**
- The plan action text suggested calling `viewerRef.current?.fitToContainer()` inside
  `onSelectSize` and the debounce timeout. A literal inline call fits the OLD grid (still drawn)
  before the new dims land, producing a wrong/janky fit. Instead the re-fit is centralized in the
  viewer-sync effect keyed on the committed dims — it fits AFTER `setData` installs the new dims,
  so the fit is correct for the new size with no zoom-jump. PATTERNS.md explicitly sanctions "an
  App-level `fitToContainer()` call after recompute". Behaviour matches the must_have exactly.
- **Commit:** d0dda20.

## Out-of-Scope Observation (not fixed — flagged for D-08 / Plan 25-05)

D-02 is explicitly scoped to **dimension** changes. The retired manual Recompute CTA was also the
only way to commit a re-uploaded *image* while a match already exists (the `img.onload` handler
commits `matchInputs` only on the first upload, `if (!matchResult)`). After this plan, swapping the
image at the same size leaves it live-but-uncommitted until the next dimension-change auto-recompute.
This image-swap commit path is the ingest/D-08 domain (Plan 25-05) and was intentionally left
untouched here (no scope creep). The comment in `img.onload` was updated to reflect this reality and
drop the removed CTA reference.

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file access, or schema surface. The only trust
boundary (custom-size numeric → worker) is the already-clamped local dimension input, now
additionally debounce + clamp-guarded (T-25-06 mitigation applied).

## Self-Check: PASSED

- FOUND: src/App.tsx (auto-fire wiring, debounce, re-fit; stale surfaces removed)
- FOUND: src/features/screens/RefineScreen.tsx (props removed, rail capped, Advanced affordance)
- FOUND: src/features/wizard/StepBar.tsx (stale prop + marker removed)
- FOUND: src/features/wizard/AtelierShell.tsx (stale pass-through removed)
- FOUND: src/__tests__/App.test.tsx (D-02 tests retargeted)
- FOUND: src/features/screens/__tests__/RefineScreen.test.tsx (coupled tests retargeted)
- FOUND commit d0dda20 (feat — auto-fire + stale retire)
- FOUND commit e8743fc (refactor — prop chain removal, rail cap, Advanced affordance)
- FOUND commit a4fd683 (test — D-02 retarget)
