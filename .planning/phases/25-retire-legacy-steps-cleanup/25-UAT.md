---
status: issues-found
phase: 25-retire-legacy-steps-cleanup
source: [25-06-PLAN.md (Task 2 checkpoint:human-verify)]
started: 2026-07-16
updated: 2026-07-16
---

# Phase 25 — UAT Test 29 (real-photo E2E) — Human Verification Result

Walked by the developer against the composed Phase 25 build (Plans 01–05) via `/gsd-execute-phase 25`,
Plan 25-06 Task 2. **Automated gate (Task 1) passed** — `npm run build` exit 0, `npm test` 365 passed /
7 skipped, and all SC1/SC2/SC3/SC10 invariant checks green. The **human walkthrough surfaced UX/layout
issues**, so the checkpoint is NOT approved and Phase 25 remains open pending gap closure.

## Current Test

number: 29
name: Real-photo journey Upload → Refine → Supplies → Order against the final in-viewport layout
expected: |
  SC5/SC6/SC8/SC9/SC10 behaviors all hold on the composed layout.
result: issues-found (see Gaps)
awaiting: gap closure (Plans 1–2) + Phase 26 (fulfillment re-home)

## Tests

### 29. Real-photo E2E walk (SC5–SC10)
expected: fit-default canvas, auto-advance, auto-recompute, bottom switcher, static wizard chrome, reachable fulfillment
result: issues-found — see Gaps GAP-1, GAP-2 (Phase 25) and P26-A, P26-B (Phase 26)

## Summary

total: 1
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 0

Confirmed-good during the walk: legacy Step1/2/4 gone, Atelier cream viewport, auto-advance on upload,
auto-recompute on SizeCard change, JSON order-packet download on the Order step.

## Gaps — Phase 25 (gap-closure cycle)

### GAP-1 — Refine canvas chrome: relocate zoom + view-mode switcher to the bottom bar; viewport fills full height
status: failed
criterion: SC8
observed: |
  The zoom HUD (+ / − / fit) is pinned top-center of the canvas region, and the Grid / Grid+Symbols /
  Original view-mode switcher floats mid-canvas (`absolute bottom-16`, from Plan 25-02) rather than
  sitting on the wizard's bottom task bar. The top-pinned zoom eats vertical space, pushing the fit
  view down so the canvas does not fill the height between the top bar and the bottom Back/Next bar.
expected: |
  Move BOTH the view-mode switcher (with its associated readout) and the zoom in/out/fit controls onto
  the bottom task bar alongside Back/Next — or immediately above it — so the canvas viewport fills the
  full space between the top bar and the bottom bar and the default fit view is centered and uncropped.
  The switcher must never overlap the canvas raster.
files: [src/features/wizard/CanvasWorkspace.tsx, src/features/wizard/AtelierShell.tsx]

### GAP-2 — Supplies step: drill list scrolls internally, order-summary panel stays static
status: failed
criterion: SC9
observed: |
  On the Supplies (drill order) step the whole step content scrolls together; the order-summary panel
  (SuppliesScreen.tsx right panel, ~line 158) does not stay put while the drill-quantity list is scrolled.
expected: |
  The drill-quantity list scrolls internally while the order-summary panel (and the fixed step
  bar + Next) remain static/sticky and hittable at any scroll position — the SC9 static-chrome
  behavior applied within the Supplies step.
files: [src/features/screens/SuppliesScreen.tsx]

## Deferred to Phase 26 (Interim Customer Fulfillment — Canvas PNG Packet + Diamond Drills USA Order)

Recorded here so they are not lost. These are NOT Phase 25 gaps — the strangler guardrail (SC10)
deliberately preserved the code without re-homing it; Phase 26 owns the re-home.

### P26-A — Surface the PNG print-packet + Diamond Drills USA drill-cart on the new Order step (CORE Phase 26)
observed: |
  The Order step (OrderScreen) exposes only "Download order packet" (JSON). The PNG print-packet export
  (`handleDownloadCombinedCanvasSheet` / `handleDownloadCanvasOnly` → engine/export.ts) and the Diamond
  Drills USA drill-cart handoff (`handleShopifyCheckout` → engine/checkout.ts) are code-preserved in
  App.tsx but wired only into the legacy `Step3Canvas`, which renders solely on the `USE_NEW_SUPPLIES`
  false branch (panel 3) and is therefore not user-reachable. Nothing is deleted; it needs re-homing.
action: Re-home those handlers into the new Order (and/or Supplies) step. Core Phase 26 scope.

### P26-B — Print/legend layout: one-sided legend + framing-margin cells (NEW Phase 26 follow-up)
observed: |
  A plain Ctrl+P canvas print renders the color legend as two tight columns flanking the image (left +
  right, CanvasWorkspace print DOM). The developer wants the legend on ONE side with a few spacer cells
  between the picture and the legend for framing grace.
action: |
  Define the canonical print/legend layout once in Phase 26 alongside the re-homed PNG packet, which
  already carries `FRAMER_MARGIN_CELLS` (engine/export.ts). Deferred here to avoid tweaking the Ctrl+P
  CSS now and redoing it when the packet lands. (Developer decision, 2026-07-16.)

## Disposition

- Phase 25: author gap-closure plans for GAP-1 + GAP-2, execute `--gaps-only`, then re-run UAT Test 29.
- Phase 26: P26-A (core) + P26-B (folded into Phase 26 print-layout scope).
