---
created: 2026-07-16T19:06:31.021Z
title: Tighten Refine canvas fit at short viewports
area: ui
resolves_phase: 26
files:
  - src/features/wizard/AtelierShell.tsx
  - src/features/wizard/CanvasWorkspace.tsx
  - src/features/screens/RefineScreen.tsx
---

## Problem

Surfaced during Phase 25 UAT Test 29 re-verification (plan 25-06, human-verify checkpoint,
approved with this logged as a follow-up). On the Refine step, the canvas re-fits correctly and
the view/zoom switcher is properly relocated to the fixed bottom control strip (25-07 / GAP-1
fix confirmed working) — but the fit tightens up at **short viewport heights**.

Measured on the composed Phase 25 app (1280px-wide desktop, real photo, Medium size):

- At **~1040px** content height: whole grid fully visible, control bar sits ~95px below the
  grid bottom. Correct. ✅
- At **~800px** content height (small laptop / non-maximized window): the canvas element
  (~602px) is vertically **centered inside a 925px flex-row** whose height is driven by the
  tall Refine rail (SizeCards + Edge cleanup + Color count + Advanced disclosure). The
  centering margin pushes the canvas down so its bottom ~68px falls below the viewport and
  ~177px sits behind the fixed bottom control bar. The scrollable Zone 2 (`overflow-y-auto`,
  scrollHeight ~999 vs clientHeight ~619) means the user CAN scroll ~200px to reveal the whole
  grid, so nothing is lost — but the *default* view doesn't show the whole grid at these
  heights, which reads as a soft miss on SC8 ("canvas defaults to fit; whole grid visible").

Root cause: the canvas column and the rail column share one flex-row; the row height follows
the taller (rail) child, and the canvas is `items-center` within it, so the empty vertical
margin grows as the rail out-heights the visible area.

## Solution

TBD — candidate approaches for Phase 26:
- Constrain the Refine flex-row to the visible Zone-2 height (e.g. `min-h-0` on the right
  ancestor / cap the row so the canvas column height = Zone-2 clientHeight, not the rail's
  intrinsic height), so "fit" targets the visible area instead of the rail-inflated row.
- Or top-align the canvas (`items-start` + internal fit) so any residual margin lands below,
  not split above/below.
- Or make the Refine rail itself scroll independently so it can't inflate the row.
- Verify at 1366×768 and non-maximized windows; keep the mobile (@max-[640px]) single-column
  reflow from Phase 24 unregressed. Whole grid should be visible at default scroll down to
  ~720px content height without needing a manual scroll.
