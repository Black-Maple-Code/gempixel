---
phase: 25-retire-legacy-steps-cleanup
plan: 08
subsystem: supplies-screen
tags: [ui, screens, supplies, atelier, d-05, gap-2, sc9]
requires:
  - "Fixed 3-zone AtelierShell (25-05, D-05) — Zone 2 is a flex-1 min-h-0 overflow-y-auto scroll region that becomes the sticky ancestor"
  - "SuppliesScreen pure/props-only render with a single-source order-summary quote (D-07) and honesty affordances (23-04)"
  - "Phase 24 mobile container-query reflow (P24 D-01/D-03) — the md:-gated pin must not fight it"
provides:
  - "On desktop (md+) the Supplies order-summary panel is sticky within Zone 2's scroll region — together with the fixed step bar and Next CTA it stays in view and hittable at max scroll while the drill list scrolls past (GAP-2/SC9 closed inside the Supplies step)"
  - "Mobile keeps its natural single-column stacked flow (all sticky classes md:-prefixed)"
  - "A locking test asserting the desktop-sticky contract and its mobile-safe md: scoping"
affects:
  - "Phase 26 legacy-step deletion is unaffected (Step3Canvas / flags.ts untouched)"
tech-stack:
  added: []
  patterns:
    - "Desktop-only sticky pin via md:-prefixed Tailwind utilities (md:sticky md:top-0 md:self-start) so the change composes with — not overrides — the Phase 24 mobile reflow"
    - "md:self-start makes a flex item content-height (defeating the default stretch) so the sticky element has room to move; the sticky ancestor is the internally-scrolling Zone 2, not the page"
    - "jsdom computes no layout, so the sticky contract is locked by className-token assertion (mirrors print.test.tsx), not by getComputedStyle"
key-files:
  created: []
  modified:
    - "src/features/screens/SuppliesScreen.tsx (order-summary panel <div> gains md:sticky md:top-0 md:self-start)"
    - "src/features/screens/__tests__/SuppliesScreen.test.tsx (new GAP-2/SC9 sticky-contract test case)"
decisions:
  - "Scoped every sticky utility to md: so mobile keeps its Phase-24 single-column stacked flow — at mobile widths the panel is w-full flex-col, where an unconditional sticky/self-start would fight the container-query reflow. Desktop-only pinning is the whole point of the md: gate."
  - "Used md:self-start (not a magic-number max-h): in the md:flex-row section, flex items default to stretch (full row height), leaving a sticky element no room to move. self-start makes the panel content-height so it can stick as the taller drill-list column scrolls past — no explicit height needed since the summary is short."
  - "No App.tsx / AtelierShell.tsx edit: the sticky ancestor (Zone 2 = flex-1 min-h-0 overflow-y-auto, established by 25-05 D-05) already exists, and the panel pins to md:top-0 just under the fixed step bar. The change is contained to SuppliesScreen + its test, class-only, zero new deps, no prop-shape change."
metrics:
  duration: ~10m
  completed: 2026-07-16
status: complete
---

# Phase 25 Plan 08: GAP-2 / SC9 — Sticky Supplies Order-Summary Summary

Pin the Supplies order-summary panel `md:sticky md:top-0 md:self-start` so on desktop it stays in view and hittable — with the already-fixed step bar and Next CTA (25-05 D-05) — at max scroll while the drill list scrolls past, keeping mobile's natural single-column flow via `md:`-scoping.

## What Was Built

**Task 1 — Desktop-sticky order-summary panel (`aef5db2`)**
Added `md:sticky md:top-0 md:self-start` to the order-summary panel `<div>` in `SuppliesScreen.tsx` (the `<div>` holding the "Order summary" heading, the `quote.lineItems` `<dl>`, and `data-testid="supplies-est-total"`), preserving all existing classes (`flex w-full flex-col gap-3 border-l border-border bg-panel p-6 md:w-[320px] md:shrink-0`). On desktop the panel pins to the top of Zone 2's scroll viewport (just under the fixed step bar) while the taller drill-table column scrolls past; on mobile (`w-full flex-col`, no `md:` active) it keeps its Phase-24 stacked flow. The `<section>` wrapper, left drill-table column, table markup, totals caption, and "Why these bags?" disclosure are untouched — no prop-shape change.

**Task 2 — Locking test (`ec3b984`)**
Added one test case to `SuppliesScreen.test.tsx` (reusing the existing `setup()` helper) that walks up from `[data-testid="supplies-est-total"]` to the panel `<div>` containing "Order summary" and asserts its `className` contains `md:sticky`, `md:top-0`, and `md:self-start`, and — guarding the mobile-safe scoping — contains no bare unprefixed `sticky`/`self-start` token. Pre-existing assertions (single-source total, supply rows, honesty affordances, totals caption, disclosure) are unchanged.

## Verification Results

- `npx tsc --noEmit` — clean (Task 1 gate).
- `npm run build` (`tsc && vite build`) — exits 0 (built in ~1.3s).
- `npm test` (full vitest) — 373 passed, 7 skipped, 0 failed (SuppliesScreen file: 7 tests green, including the new sticky-contract case).
- Structural: `grep -c "md:sticky" src/features/screens/SuppliesScreen.tsx` == 1 on the order-summary panel; no unprefixed `sticky` added.
- Guardrail: `git diff` for this plan touches only `SuppliesScreen.tsx` + its test — not `App.tsx`, `AtelierShell.tsx`, `Step3Canvas.tsx`, `flags.ts`, or any engine file.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/features/screens/SuppliesScreen.tsx (md:sticky present, 1 occurrence)
- FOUND: src/features/screens/__tests__/SuppliesScreen.test.tsx (new GAP-2/SC9 test)
- FOUND: commit aef5db2 (feat 25-08 sticky panel)
- FOUND: commit ec3b984 (test 25-08 sticky contract)
