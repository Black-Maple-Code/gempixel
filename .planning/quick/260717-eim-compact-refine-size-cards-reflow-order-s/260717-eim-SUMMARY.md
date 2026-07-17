---
id: 260717-eim
title: "Compact Refine size cards + reflow Order step to fit one screen"
status: complete
mode: quick
branch: claude/gsd-ui-phase-20-70b245
commits:
  - f41180d  # fix(20): compact SizeCard
  - 7edeecf  # fix(20): reflow Order step
---

# Quick Task 260717-eim — SUMMARY

## Task 1 — Compact Refine size cards (`src/ui/SizeCard.tsx`)
Card padding `p-6` → `px-4 py-3`; the four stacked lines become two:
`name + tag`, then `{gridDims} · {inches}` with the drill count right-aligned on
the same row. Cards are ~half the height, so all four tiers + Custom size + the
start of Edge cleanup are visible at once (rail scrolls internally). Medium still
highlights on load (earlier reconciliation intact).

## Task 2 — Order step fits one screen (`src/features/screens/OrderScreen.tsx`)
Restructured from a tall two-column stack into **top row + full-width strip**:
- **Top row:** LOCKED spec + Canvas finish (left, `md:w-380`) · ship-to inputs (right).
- **Bottom strip (`md:grid-cols-3`):** Price · Get canvas made (2×2 downloads) · Order drills.
- **Ship-to** packs 7 fields into 4 rows via a 6-col grid + `span` per field
  (name / address+apt / city+state+postal / country); inputs `py-0.5`, tighter gaps.
- Panel paddings `p-6`→`p-4`, spec rows `py-2`→`py-1.5`, buttons `py-2.5`→`py-1.5`,
  legends `mb-1`→`mb-0.5`, plus removed a redundant download helper line.

Result: content height dropped from ~800px (heavy scroll) to ~611px. On a
standard-height window the entire step — spec, finish, full address form, price
**with total**, all four downloads, and the drill cart — is visible without
scrolling. In the app's unusually short ~584px preview pane a ~27px residual
remains (only the tiny "rates as of" footnote sits at the very bottom edge).

## Verification
- `npx tsc --noEmit` → clean.
- `npx vitest run` OrderScreen + SizeCard + App + integration → **4 files, 60 tests passed**
  (all `data-testid`/`data-shipto`/`data-finish`/`data-line` hooks preserved through the
  restructure; SizeCard tests pass because the combined line keeps the same textContent).
- Live browser: Refine cards compact + Medium highlighted; Order fully visible on one
  screen (top row + 3-column strip), total `$41.28` shown.

## Follow-up option (not done — would need a UX call)
To guarantee zero scroll even at very short window heights, the finish cards could
become a compact SegmentedControl (like edge-cleanup/drill-shape), reclaiming ~55px
but dropping the per-option blurbs. Left as-is pending user preference.
