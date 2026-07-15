---
phase: 23-the-four-screens-in-flow-order
plan: 08
subsystem: ui
tags: [preact, strangler-fig, canvas-first, viewport, single-mount, refactor, gap-closure, testing]

# Dependency graph
requires:
  - phase: 20
    provides: "Single CanvasViewer mount + contents/hidden always-mounted step panels (D-14); App-is-sole-state-owner pure/props-only children (D-01); AtelierShell top-bar chrome + StepBar navigator"
  - phase: 23-the-four-screens-in-flow-order
    plan: 06
    provides: "CanvasWorkspace extracted as a pure/props-only frame sibling; project-LOAD test helpers re-pointed off the legacy 'My Images' drawer onto UploadScreen chips (gap-closure 1/3)"
  - phase: 23-the-four-screens-in-flow-order
    plan: 07
    provides: "All Vitest coupling to the legacy left sidebar + right Color-Legend/DMC aside severed; color-exclusion re-pointed onto RefineScreen Advanced (gap-closure 2/3)"
provides:
  - "src/App.tsx — AtelierShell body is now the centered ~1180px cream viewport frame that hosts the four screens as the shell's PRIMARY content. On Refine (step 2) it lays out as a flex row [CanvasWorkspace preview | 360px RefineScreen rail]; on Upload/Supplies/Order the canvas is display:none and the sole visible panel fills the frame."
  - "The retired dark 3-column chrome is deleted (not hidden): the bg-slate-950 shell wrapper, the left 'My Images' aside + drawer, the right Color-Legend/DMC aside, the in-aside Back/Next, the bottom Setup·Canvas·Colors mobile tab bar + drawer backdrop, and the dead collapse/drawer state (leftPanelCollapsed/rightPanelCollapsed/imagesDrawerOpen/supplyListOpen + handleHeaderClick)."
  - "Still-needed options relocated into the viewport: #new-project-btn (resetWorkspace) + #save-project-btn in a frame action row; #wizard-back-btn/#wizard-next-btn re-homed as a frame footer with ids + disabled/stale gating preserved verbatim. matchError + actionError banners hoisted to frame scope so they surface on any step."
  - "src/__tests__/App.test.tsx — an integrated full-App layout regression test (gap missing item #4) guarding 'four screens host the viewport; legacy menu/aside/dark shell retired; one persistent canvas'."
affects: [24-mobile-responsive-touch, 25-strangler-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Viewport-frame layout via display:contents panels in a justify-center flex row: each screen's OWN root is the flex item (RefineScreen w-[360px] becomes the rail, the single-column/full-width screens fill/center). The always-mounted CanvasWorkspace <main> is a flex-1 sibling shown only on step 2 (display:none otherwise) so the single <canvas> is never unmounted (D-14); a step-2 useEffect re-fits the viewer since it measures 0 while hidden."
    - "Print-coherence for a de-chromed shell: because the panels no longer live inside a hidden <aside>, each panel wrapper carries no-print so the screens never leak into the canvas/legend/report print artifacts, while the canvas <main> stays printable (default @media print) and the isolated report/legend containers stay frame-siblings."
    - "Banner hoist for step-independent surfacing: match/action error banners moved out of the (now step-gated) CanvasWorkspace to frame scope so imperative one-shot failures (ERR-01) show on Upload/Supplies/Order, not only while the canvas is visible."

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/features/wizard/CanvasWorkspace.tsx
    - src/__tests__/App.test.tsx
    - .planning/ROADMAP.md

key-decisions:
  - "The four USE_NEW_* ? <Screen/> : <LegacyStep/> ternaries are KEPT verbatim inside the new frame panels — deleting the residual Step1..4 component files is explicitly Phase 25 (grep-clean). This kept the legacy Step-passed handlers referenced (no noUnusedLocals breakage) and scoped Plan 08 to the shell swap."
  - "Panels stay display:contents (visible) / hidden (toggled) — NOT converted to flex-child width classes — so the existing D-14 assertion (step2.className contains 'contents') holds and RefineScreen's own w-[360px] root drives the rail width when promoted into the frame flex row."
  - "Legacy legend sort is retired with the right aside: handleHeaderClick deleted and sortBy/sortAsc kept as read-only useState getters (setters removed) so sortedMatches stays deterministic (quantity desc) with zero unused-symbol errors."
  - "The re-homed frame Save button is labelled 'Save project' (not the legacy 'Save to My Images') so the retired-menu content assertion ('no button contains My Images') holds; same #save-project-btn id + save-modal handler preserved. The top-bar Save pill is unchanged."
  - "The Artist Resources modal is left in place (plan: leave modals untouched) but its only trigger (the deleted left-aside button) is gone, so it is intentionally orphaned for a future plan; setResourcesModalOpen stays referenced via the modal's own close buttons, so tsc is clean."

patterns-established:
  - "Strangler shell flip as one green commit: because Plans 06/07 pre-severed every test coupling to the deleted chrome, the dark 3-column shell → centered viewport frame swap landed as a single feat commit with the full suite green."

requirements-completed: [UPLOAD-01, REFINE-01, SUPPLIES-01, ORDER-01]

coverage:
  - id: D1
    description: "The AtelierShell body is a centered ~1180px cream viewport frame hosting the four screens as primary content; on Refine it is [CanvasWorkspace preview | 360px rail], on Upload/Supplies/Order the canvas is display:none and the sole visible panel fills the frame."
    requirement: "UPLOAD-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#hosts UploadScreen as the visible step-1 primary content"
        status: pass
      - kind: integration
        ref: "src/__tests__/App.test.tsx#hosts each screen as the visible panel across Upload → Refine → Supplies → Order, with the canvas as a Refine sibling"
        status: pass
    human_judgment: false
  - id: D2
    description: "The legacy dark 3-column chrome is retired (deleted, not hidden): no bg-slate-950+text-slate-100 shell wrapper, no left 'My Images' menu, no right 'Color Legend' aside; grep gate over src/App.tsx returns nothing for the retired tokens."
    requirement: "SUPPLIES-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#retires the legacy left menu, right aside, and dark shell — asserted by content, not element type"
        status: pass
      - kind: other
        ref: "git grep -nE 'bg-slate-950 text-slate-100|leftPanelCollapsed|rightPanelCollapsed|imagesDrawerOpen|Mobile Bottom Tab Bar' src/App.tsx → no matches (exit 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The single CanvasViewer never remounts across the flip: CanvasWorkspace is an always-mounted frame sibling shown only on step 2; exactly one persistent <canvas> node survives a Refine→Supplies→Refine hop (D-14)."
    requirement: "REFINE-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#keeps exactly one persistent canvas node across a step change (D-14 single mount)"
        status: pass
      - kind: integration
        ref: "src/__tests__/App.test.tsx#keeps a single CanvasViewer mounted across step changes (SC4/D-14)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Relocated controls work from inside the viewport: #new-project-btn (reset), #save-project-btn (save modal), and #wizard-back-btn/#wizard-next-btn keep their ids + disabled/stale gating; error banners hoisted to frame scope surface on any step."
    requirement: "ORDER-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#handles project saving, summary registry addition, state recovery, deletion, and reset"
        status: pass
      - kind: integration
        ref: "src/__tests__/App.test.tsx#surfaces the banner when the order-packet download fails (re-homed W5)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Desktop journey Upload → Refine → Supplies → Order fills the centered ~1180px cream frame, Refine shows the live chart preview beside the 360px rail, and no dark left menu / right legend / duplicate upload prompt appears (UAT Test 26 re-verify)."
    verification: []
    human_judgment: true
    rationale: "Visual/interaction fidelity of the flipped shell (frame width, cream styling, [preview | rail] composition, absence of legacy chrome) is a human judgment; deferred to the end-of-phase verification pass (human_verify_mode=end-of-phase)."

# Metrics
duration: ~35min
completed: 2026-07-15
status: complete
---

# Phase 23 Plan 08: Flip the Shell to the Centered Viewport Frame (Gap Closure 3/3) Summary

**Replaced the legacy dark 3-column shell (bg-slate-950 wrapper + 320px left "My Images" aside + center `<main>` + right Color-Legend/DMC aside + in-aside Back/Next + bottom mobile tab bar) with a centered ~1180px cream Atelier viewport frame that hosts the four screens as the shell's primary content — on Refine a flex row [CanvasWorkspace preview | 360px RefineScreen rail], on Upload/Supplies/Order the display:none canvas plus the sole visible panel. Relocated the still-needed options into the frame (#new-project-btn, #save-project-btn, and #wizard-back-btn/#wizard-next-btn with ids + gating verbatim), hoisted the match/action error banners to frame scope, deleted the retired chrome and its dead collapse/drawer/sort state, added an integrated full-App layout regression test, and narrowed ROADMAP Phase 25 to a final grep-clean. UAT Test 26 closed. tsc 0; Vitest 350 pass / 12 skip.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-15
- **Tasks:** 2 (2 atomic commits)
- **Files modified:** 4

## Accomplishments
- **Shell flip (Task 1):** rewrote the AtelierShell body from the dark 3-column shell into a centered `max-w-[1180px] mx-auto` scroll frame on the cream `bg-bg`. The four `data-step-panel` siblings stay always-mounted, display:contents/hidden toggled (D-14); CanvasWorkspace is a `<main>` frame sibling shown only when `wizard.step === 2` (display:none otherwise), so the single `<canvas>` never unmounts. A `useEffect` keyed on `wizard.step` re-fits the viewer on entering Refine (it measures 0 while hidden).
- **Relocated the viewport controls:** a frame action row hosts `#new-project-btn` (resetWorkspace) + `#save-project-btn` (save modal, relabelled "Save project"); a frame footer hosts `#wizard-back-btn`/`#wizard-next-btn` with `disabled={!canEnter(step+1) || nextBlockedByStale}` and the final-step-hides-Next behavior preserved verbatim. Recent projects + load + inline Remove already live in UploadScreen (D-10).
- **Hoisted the error banners:** matchError + actionError moved out of the (now step-gated) CanvasWorkspace to frame scope — the two banner props were dropped from `CanvasWorkspaceProps` — so imperative failures (ERR-01) surface on any step. Verified by the step-4 order-packet-failure banner test.
- **Deleted the retired chrome + dead state:** left aside/drawer, right Color-Legend/DMC aside, expand buttons, bottom Setup·Canvas·Colors nav + drawer backdrop, and `leftPanelCollapsed`/`rightPanelCollapsed`/`imagesDrawerOpen`/`supplyListOpen` + `handleHeaderClick` (with `sortBy`/`sortAsc` demoted to read-only getters). Resources/sizing/save modals + their backdrops left untouched.
- **Integrated layout regression test (Task 2):** a new full-App `<App />` describe block asserts the four `data-screen` hosts as visible panels, the canvas as a Refine sibling, one persistent canvas across a step hop, and — by CONTENT, not element type — no "My Images" button, no leaf "Color Legend", and no element carrying the dark-shell signature (`bg-slate-950` AND `text-slate-100`).
- **ROADMAP reconciled:** Phase 25 one-liner + detail section narrowed to a final grep-clean of residual `Step1..4` files / theme remnants / dead preset state, with a dated Test-26 note that the dark shell + both asides were already retired in Phase 23 (Plans 06–08).

## Task Commits

Each task was committed atomically:

1. **Task 1: Flip AtelierShell to the centered 1180px cream viewport frame** — `8e8ba17` (feat)
2. **Task 2: Add the integrated viewport-layout regression test + narrow ROADMAP Phase 25** — `eb4e919` (test)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) — `docs(23)` commit

## Files Created/Modified
- `src/App.tsx` - AtelierShell body is the centered viewport frame; both legacy asides, the dark shell wrapper, the mobile tab bar + backdrop, and the dead collapse/drawer/sort state deleted; canvas relocated as a step-2-gated frame `<main>`; banners hoisted; action row + Back/Next footer re-homed; step-2 re-fit effect added.
- `src/features/wizard/CanvasWorkspace.tsx` - Dropped the matchError/actionError/onDismissActionError props + their JSX (hoisted to App frame scope); doc comment updated.
- `src/__tests__/App.test.tsx` - New integrated layout regression describe block (gap item #4); the drawer DELETE assertion re-pointed onto the UploadScreen inline Remove affordance.
- `.planning/ROADMAP.md` - Phase 25 narrowed to a final grep-clean with a dated Test-26 note.

## Decisions Made
- Kept the four legacy Step ternary else-branches (Phase 25 deletes the Step1..4 files) so most handlers stay referenced and the flip stays scoped to the shell.
- Kept panels as display:contents/hidden (not flex-width classes) so the D-14 `contents` assertion holds and RefineScreen's own `w-[360px]` root drives the rail in the frame flex row.
- Retired legend sort with the right aside: deleted `handleHeaderClick`, demoted `sortBy`/`sortAsc` to read-only getters (deterministic quantity-desc order, no unused setters).
- Relabelled the re-homed frame Save affordance "Save project" (same `#save-project-btn` id + handler) so "no button contains 'My Images'" holds.
- Added `no-print` to the four panel wrappers so the de-chromed screens never leak into the canvas/legend/report print artifacts (previously the enclosing `<aside>` hid them).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pointed the drawer DELETE test onto UploadScreen's inline Remove**
- **Found during:** Task 1 (shell flip)
- **Issue:** Plan 06 explicitly left the drawer-specific DELETE assertion (`button[title="Delete Image"]` behind the "My Images" toggle) for Plan 08; deleting the drawer broke that active test (`expected null to be truthy`).
- **Fix:** Re-pointed the deletion step onto the UploadScreen recent-chip Remove affordance ("Remove" → inline "Remove? Yes / Cancel"), which calls the same App `onDeleteProject` → `projectStore.remove(id)`.
- **Files modified:** src/__tests__/App.test.tsx
- **Verification:** The "handles project saving… deletion, and reset" test passes; registry empty after removal.
- **Committed in:** `8e8ba17` (Task 1 commit)

**2. [Rule 1 - Bug] Relabelled the re-homed Save button to avoid a "My Images" content collision**
- **Found during:** Task 2 (writing the negative layout assertions)
- **Issue:** The plan mandates "no button whose text includes 'My Images'"; the re-homed Save affordance preserved the legacy label "Save to My Images", which collided.
- **Fix:** Relabelled the frame `#save-project-btn` to "Save project" (id + save-modal handler unchanged; top-bar Save pill unchanged).
- **Files modified:** src/App.tsx
- **Verification:** The "retires the legacy left menu…" test passes; full suite green.
- **Committed in:** `eb4e919` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking test re-point, 1 content-collision fix)
**Impact on plan:** Both were necessary to keep the full suite green and satisfy the plan's own layout assertions. No scope creep — the Step1..4 files and legacy-branch cleanup remain Phase 25.

## Issues Encountered
- The right Color-Legend/DMC aside was a ~230-line contiguous block; removed via a boundary-checked line-range splice (asserting the start comment + closing `</aside>`) rather than a fragile 230-line Edit match. Same for the mobile drawer backdrop + tab bar. tsc + suite confirmed structural integrity afterward.
- Expected stderr noise in the full run ("worker exploded", "getContext not implemented", "navigation to another Document") is from canvas/worker/error-path tests — not failures; all 350 active tests pass.

## Known Stubs
None. All deletions are intentional retirements of legacy chrome; the four screens render live data via their existing props. The orphaned Artist Resources modal is a deliberate leave-in-place (plan: modals untouched) pending a future re-home, not a stub.

## Threat Model
- **T-23-08-01 (Tampering/XSS — recent chips + restored fields):** mitigated, unchanged by the swap. UploadScreen renders names as escaped text (Preact default, no dangerouslySetInnerHTML); the hoisted banners are text-only; money-typed loads stay sanitized at the state boundary (existing CR-01 guard).
- **T-23-08-02 (DoS — single-mount canvas under CSS show/hide):** mitigated. CanvasWorkspace stays an always-mounted frame sibling (never behind a step conditional) + an explicit re-fit on entering Refine; the integrated test asserts exactly one persistent canvas node across a step hop, guarding remount churn.
- **T-23-08-03 (Elevation/lost-gating — relocated Back/Next + reset):** mitigated. `#wizard-next-btn`/`#wizard-back-btn`/`#new-project-btn` keep their ids, handlers, and disabled/stale gating; navigation + reset tests exercise them unchanged.
- No new threat surface introduced (no new endpoints, auth paths, file access, or schema changes; still 100% client-side).

## User Setup Required
None — no external service configuration required (the app stays 100% client-side).

## Next Phase Readiness
- **UAT Test 26 closed:** the four Atelier screens are the primary viewport content in a centered ~1180px cream frame, the legacy dark chrome + both asides + mobile tab bar are retired with their options relocated into the viewport, and the single CanvasViewer never remounts.
- **Deferred to end-of-phase human verification (human_verify_mode=end-of-phase):** the browser walkthrough of Upload → Refine → Supplies → Order (Test 26 re-verify + the deferred Test 29 end-to-end photo journey). NOT attempted in this plan.
- **Left for Phase 25 (now a grep-clean):** delete the residual `Step1..4` component files + their now-dead ternary branches, theme remnants, the four `it.skip` TODO(25) legacy-panel tests, and re-home or drop the orphaned Artist Resources modal.
- **Invariants held:** single `<canvas>`/CanvasViewer mount preserved (D-14); App is still the sole state owner (D-01); `src/engine/` untouched; zero new dependencies.

## Self-Check: PASSED

- Files present: `src/App.tsx`, `src/features/wizard/CanvasWorkspace.tsx`, `src/__tests__/App.test.tsx`, `.planning/ROADMAP.md`.
- Commits present: `8e8ba17` (feat, Task 1), `eb4e919` (test, Task 2).
- `npx tsc --noEmit` exit 0; `npm test` 350 passed / 12 skipped / 0 failed (36 files); grep gate over src/App.tsx returns nothing (exit 1); the integrated layout regression test (4 cases) passes.

---
*Phase: 23-the-four-screens-in-flow-order*
*Completed: 2026-07-15*
