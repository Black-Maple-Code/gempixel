---
id: 260717-eim
title: "Compact Refine size cards + reflow Order step to fit one screen"
status: complete
mode: quick
branch: claude/gsd-ui-phase-20-70b245
---

# Quick Task 260717-eim — Compact size cards + Order reflow

Two user-reported layout issues on the canvas-first UI (step 2 Refine, step 4 Order).
Orchestrator acts as executor with live browser verification (layout work the blind
GSD executor subagent cannot confirm).

## Task 1 — Compact Refine size cards
`src/ui/SizeCard.tsx`. The preset cards used `p-6` with four stacked lines, wasting
vertical space. Collapse to `px-4 py-3`, two lines: `name + tag`, then
`grid · inches` with the drill count right-aligned. **verify:** cards shorter, more
of the rail visible; SizeCard/RefineScreen tests still pass (textContent preserved).

## Task 2 — Order step fits one screen
`src/features/screens/OrderScreen.tsx`. The right column stacked finish + 7-field
ship-to + price + 4 downloads + cart, forcing a long scroll. Restructure:
- Top row: LOCKED spec + Canvas finish (left) · ship-to (right).
- Full-width bottom strip: Price · Get canvas made (2×2 downloads) · Order drills.
- Ship-to → 6-col grid, 4 rows (name / address+apt / city+state+postal / country).
- Tighter inputs/paddings/gaps.
**verify:** whole step visible without scroll on a standard window; all `data-testid`
hooks preserved; OrderScreen tests pass.

## Verification
- `npx tsc --noEmit`
- `npx vitest run` OrderScreen + SizeCard + App + integration suites
- Live browser screenshots (Refine + Order).
