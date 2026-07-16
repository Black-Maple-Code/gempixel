---
phase: 25-retire-legacy-steps-cleanup
plan: 05
subsystem: wizard-shell-print-ingest
tags: [D-03, D-05, D-08, WR-01, SC5, SC6, SC9, fixed-shell, print-from-any-step, ingest-auto-advance]
requires:
  - "AtelierShell pure props-only chrome (P20 D-01) with a single StepBar navigator"
  - "Single-mount canvas <main> as an always-rendered display-toggled sibling (P20 D-14)"
  - "beforeprint → fitToContainer hook + .print-canvas-wrapper canvas max-width rule (prior phases)"
  - "loadImageFile → img.onload single ingest path; setMatchInputs fire-once commit (P20 D-13)"
  - "Plan 25-04 stale-surface retire (Next is disabled purely by !canEnter(step+1))"
provides:
  - "Fixed 3-zone AtelierShell (step-bar / internally-scrolling content / fixed bottom Back·Next) — Next is always hittable without page scroll (SC9)"
  - "Canvas <main> is print:block on every step — a plain Ctrl+P prints the grid from Upload/Refine/Supplies/Order (SC6/WR-01)"
  - "A successful image ingest auto-advances Upload → Refine, and every ingest (incl. same-size re-upload) commits the new image (SC5 / carry-forward D-08 closed)"
affects:
  - "Phase 26 legacy-step deletion still owns Step3Canvas / flags.ts (untouched here)"
tech-stack:
  added: []
  patterns:
    - "3-zone flex shell: shrink-0 header → flex-1 min-h-0 overflow-y-auto content → shrink-0 bottom bar (min-h-0 is the load-bearing scroll-shrink detail)"
    - "Unconditional Tailwind print:block composed with an on-screen step gate → `hidden print:block` off-Refine"
    - "Auto-advance as an effect keyed on image identity (not a synchronous goTo in img.onload) to dodge the stale-closure canEnter — mirrors 25-04's effect-not-inline discretion"
key-files:
  created: []
  modified:
    - "src/features/wizard/AtelierShell.tsx (bottomBar slot + 3-zone restructure)"
    - "src/App.tsx (footer → bottomBar; content div de-scrolled; <main> print:block; ingest auto-advance effect; image-swap commit)"
    - "src/__tests__/print.test.tsx (print:block-on-non-Refine assertion)"
    - "src/__tests__/integration.test.tsx (auto-advance-to-step-2 assertion)"
decisions:
  - "Auto-advance runs in a useEffect keyed on `image` (not inline in img.onload): the onload closure captures a stale wizard whose canEnter(2)=hasImage is still false pre-upload, so an inline goTo(2) would be blocked in production and only the isTestEnv bypass would mask it. The effect runs after the setImage render commits, where canEnter(2) is legitimately true. Project loads set image=null, so they never auto-advance."
  - "Closed the carry-forward D-08 image-swap commit gap (removed the first-upload-only `if (!matchResult)` guard) so a same-size re-upload commits the new image instead of stranding the old match — otherwise the new auto-advance lands the user on Refine showing a stale grid. Race-safe because the new image + candidate reset commit together in one setState batch (the 25-04 hazard only existed when candidates reset WITHOUT a new-image commit)."
  - "index.css was NOT modified: the plain @media print path already leaves <main> visible and `.print-canvas-wrapper canvas { max-width:100% }` already fits the raster; the report/legend modes already `display:none !important` <main>, so print:block introduces no double-print."
metrics:
  duration: ~25m
  completed: 2026-07-16
status: complete
---

# Phase 25 Plan 05: Fixed Wizard Shell + Print-from-Any-Step + Ingest Auto-Advance Summary

Landed the three chrome/flow/print fixes that close SC9, SC6, and SC5. `AtelierShell` is
now a fixed 3-zone flex shell (top step-bar → internally-scrolling content → fixed bottom
Back/Next), so Next is always reachable without page scroll and long Supplies/drill lists
scroll inside the content zone. The single-mount canvas `<main>` composes `print:block`
unconditionally, so a plain Ctrl+P prints the canvas grid from any step (not just Refine),
while the dedicated Supply-Report and legend print modes stay independent. A successful
image ingest auto-advances Upload → Refine, and — closing the Plan 25-04 carry-forward
D-08 gap — every ingest (including a same-size re-upload) now commits the new image so the
auto-advance never lands on a stale grid.

## What Was Built

- **Fixed 3-zone AtelierShell (D-05 / SC9) — `AtelierShell.tsx` + `App.tsx`:**
  - `AtelierShell` gains an optional `bottomBar?: ComponentChildren` slot. Its root keeps
    `@container flex flex-col h-dvh overflow-hidden`; children are now wrapped in a Zone-2
    `flex-1 min-h-0 overflow-y-auto` scroll region (the `min-h-0` is the load-bearing detail
    that bounds the scroll to this zone), and `bottomBar` renders in a Zone-3
    `shrink-0 no-print border-t border-border bg-panel px-4 py-3` bar.
  - `App.tsx` moves the Back/Next footer out of the content tree into `bottomBar` (ids
    `#wizard-back-btn` / `#wizard-next-btn` and gating verbatim; Next disabled purely by
    `!canEnter(step+1)`), width-capped to the 1180px card frame. The former content wrapper
    dropped its own `flex-1 min-h-0 overflow-y-auto` (Zone 2 owns scrolling now) → `relative
    min-h-full bg-bg`. The canvas `<main>` and its `@max-[640px]` mobile classes are
    re-zoned, never remounted (D-14); the step-2 `fitToContainer` re-fit effect still fires.
- **Canvas print from every step (D-03 / WR-01 / SC6) — `App.tsx` + `print.test.tsx`:**
  - The `<main>` className composes `print:block` unconditionally with the on-screen step
    gate: `` `print:block ${step===2 ? '…flex…' : 'hidden'}` ``. Off-Refine this is
    `hidden print:block` (display:none on screen, block in print), so a plain Ctrl+P prints
    the canvas grid from Upload/Supplies/Order too. The `beforeprint → fitToContainer` hook
    is untouched. `print.test.tsx` asserts `<main>` carries `print:block` on a non-Refine
    step (Upload).
- **Ingest auto-advance + image-swap commit (D-08 / SC5) — `App.tsx` + `integration.test.tsx`:**
  - A `useEffect` keyed on `image` identity calls `wizard.goTo(2)` once an ingested image
    commits; project loads (which set `image=null`) never trigger it. The
    `if (!matchResult)` first-upload-only guard is removed so every ingest commits the new
    image (`setExcludedColors`/`setSelectedPreset`/`setMatchInputs` together). Integration
    test asserts panel-2 becomes `contents` (panel-1 `hidden`) after upload.

## Verification

- `npx tsc --noEmit` exits 0 (no output).
- `npm test` (full suite): 36 files, **365 passed**, 7 skipped — above the 240 SC4 floor
  (prior baseline 364; net +1 from the new print:block-on-non-Refine test).
- Task greps: `min-h-0` in AtelierShell = 3 (Zone 2 + shell comment); a single real
  `id="wizard-next-btn"` / `id="wizard-back-btn"` (the extra grep line is the comment that
  names both ids); `@max-[640px]` on the canvas wrapper intact; `goTo(2)` present in the
  ingest auto-advance effect.
- Prohibitions preserved: `print-only-report-mode` (13) and `print-only-legend-mode` (13)
  in index.css unchanged (index.css not modified); the plan diff
  (`git diff --name-only HEAD~3..HEAD`) excludes engine/export.ts, engine/checkout.ts,
  Step3Canvas.tsx, and screens/flags.ts. The `<main>` remains an always-rendered
  display-toggled sibling (never step-gated to unmount); layout + mobile integration tests
  stay green.

## Deviations from Plan

### Discretion-applied (documented, precedented by 25-04)

**1. [Rule 1 - Correctness] Auto-advance implemented as an effect keyed on `image`, not a synchronous `wizard.goTo(2)` inside `img.onload`**
- **Found during:** Task 3.
- **Issue:** The plan action says to call `wizard.goTo(2)` inline in the `img.onload`
  success handler. But `goTo(target)` gates on `canEnter(target) || isTestEnv`, and
  `canEnter(2)` reads `hasImage`. The `img.onload` closure captures the wizard from the
  render where `loadImageFile` was created — before `setImage(img)` — so `hasImage` is
  still `false` there. An inline `goTo(2)` would therefore be **blocked in production** and
  only pass under jsdom's `isTestEnv` bypass (a green-test / broken-prod trap).
- **Fix:** advance in a `useEffect` keyed on `image` identity. It runs after the setImage
  render commits (`hasImage` true, `canEnter(2)` legal) and fires exactly once per file
  ingest; project loads set `image=null` so they never auto-advance (preserving the
  load-then-navigate flow the print.test relies on). Uses `goTo(2)` verbatim.
- **Precedent:** identical to Plan 25-04's "re-fit implemented in the setData effect, not
  inline" discretion.
- **Commit:** 2ef7b07.

**2. [Rule 1 - Correctness / carry-forward D-08] Closed the image-swap commit gap in the same task**
- **Found during:** Task 3 (evaluating the 25-04 carry-forward flag).
- **Issue:** Plan 25-04 flagged that the `img.onload` handler committed `matchInputs` only
  on the first upload (`if (!matchResult)`), so a same-size re-upload stayed uncommitted and
  the canvas kept showing the OLD image's match. Task 3's new auto-advance directly lands the
  user on Refine after any upload — so a re-upload would now land them on a **stale grid**.
  25-04 explicitly designated this image-swap commit as "the ingest/D-08 domain (Plan 25-05)".
- **Fix:** removed the `if (!matchResult)` guard so every ingest commits the new image. This
  is race-safe: the match hook keys on `{image, cols, rows, candidatesKey}`, and the new
  image + the candidate reset (`excludedColors`/`selectedPreset`) commit together in one
  setState batch — so the worker re-fires on the NEW image with fresh candidates. The 25-04
  hazard (candidate reset re-firing on the OLD image) only existed when candidates reset
  WITHOUT a new-image commit, which no longer happens.
- **Scope note:** bounded to the single `img.onload` block already being edited; no test
  asserted the prior uncommitted-re-upload behavior (App.test never uploads a real file), and
  the full suite stays green.
- **Commit:** 2ef7b07.

**3. [Discretion] `src/index.css` not modified (plan listed it in `files_modified`)**
- The plan's Task 2 says to touch index.css "only if the raster overflows." The plain
  `@media print` path already leaves `<main>` visible, `.print-canvas-wrapper canvas
  { max-width:100% }` already fits the raster, and both `print-only-*-mode` selectors already
  `display:none !important` the `<main>` (so `print:block` cannot double-print). No CSS change
  was needed; the frontmatter `files_modified` was conditional.

## Carry-Forward Notes

- **Recent-image parity (must_have):** there is no separate "recent images" load path in the
  current UI — `UploadScreen` surfaces recent *projects* (via `loadProject`), and all image
  files funnel through the single `loadImageFile → img.onload` path. The auto-advance effect
  (keyed on `image`) therefore covers fresh uploads AND any image re-ingest uniformly; no
  separate recent-image wiring exists to advance.

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file access, or schema surface. The changes are
a flex/scroll shell restructure, a print CSS gate on `<main>`, and a client-side wizard step
advance. The Diamond Drills USA cart (checkout.ts) and export path are untouched (Phase 26
guardrail preserved). T-25-09 (canvas remount/measure), T-25-10 (print double-print), and
T-25-11 (auto-advance on failed decode) mitigations all hold: canvas re-zoned not remounted,
report/legend modes win via `!important`, and the advance effect only fires when `image` is a
committed decoded HTMLImageElement.

## Self-Check: PASSED

- FOUND: src/features/wizard/AtelierShell.tsx (bottomBar slot + 3-zone shell)
- FOUND: src/App.tsx (footer relocated, <main> print:block, ingest auto-advance effect, image-swap commit)
- FOUND: src/__tests__/print.test.tsx (print:block-on-non-Refine assertion)
- FOUND: src/__tests__/integration.test.tsx (auto-advance-to-step-2 assertion)
- FOUND commit 0d9370f (feat — 3-zone shell + relocate Back/Next)
- FOUND commit 7a9d978 (feat — print:block on every step)
- FOUND commit 2ef7b07 (feat — ingest auto-advance + image-swap commit)
