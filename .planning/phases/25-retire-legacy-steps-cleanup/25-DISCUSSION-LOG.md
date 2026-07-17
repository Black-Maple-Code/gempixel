# Phase 25: Retire Legacy Steps + Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 25-retire-legacy-steps-cleanup
**Areas discussed:** Deletion scope & P26 order, Auto-recompute model, Print WR-01 fix, Refine viewport & wizard chrome

---

## Deletion scope & Phase 26 ordering

| Option | Description | Selected |
|--------|-------------|----------|
| A. Preserve Step3Canvas, delete the rest | Delete Step1/2/4 + non-coupled theme/slate + dead preset state + land UX fixes; keep Step3Canvas + its 3 fulfillment handlers + coupled slate modals until Phase 26 re-homes/deletes them. Matches guardrail #11 + P26 SC5. | ✓ |
| B. Phase 26 first, then clean all four | Reorder so P26 re-homes export+cart first, then P25 deletes all four Steps cleanly; UX fixes wait behind P26 or split 25a/25b. | |
| C. Merge 25+26 into one phase | Fold the fulfillment re-home into P25 so everything lands together in one mega-phase. | |

**User's choice:** A
**Notes:** Confirmed in code that the 3 fulfillment handlers are triggered ONLY through Step3Canvas and the new Supplies/Order screens never reference them — deleting Step3Canvas now would orphan the Diamond Drills USA cart + canvas PNG export. Phase 26 SC5 already owns the Step3Canvas deletion, so A is the design intent.

---

## Auto-recompute model

| Option | Description | Selected |
|--------|-------------|----------|
| A. Fully automatic, remove the button | Auto-trigger handleRecomputeMatch (SizeCard instant; custom-size debounced ~500ms); remove the Recompute button + amber stale CTA; clamp-guarded firing + canvas pending state. | ✓ |
| B. Automatic + keep manual override | Same auto behavior but keep the Recompute button as an explicit 'run now' escape hatch. | |

**User's choice:** A
**Notes:** SC5 says "no intermediate Recompute click" — A satisfies it literally. Keep the soft-invalidate plumbing internally (auto-fired) rather than ripping it out, for low risk / green suite. Debounce + clamp-guard + pending state cover the worker-thrash concern that motivated the original manual button.

---

## Print WR-01 fix

| Option | Description | Selected |
|--------|-------------|----------|
| A. Restore canvas print from every step | Canvas <main> print:block on all steps + fit-to-page print rule (rides on the fit-zoom default). Dedicated Supply/legend prints stay intact. | ✓ |
| C. Hybrid — Refine + Order only | Canvas prints from Refine + Order; Supplies keeps its supply-report; Upload prints nothing. | |
| B. Refine-only, make intent explicit | Keep canvas print Refine-only; ensure raw Ctrl+P is never blank via a guided note / routing. | |

**User's choice:** A
**Notes:** Root cause confirmed at App.tsx:1619 (print:block only when step===2). Fit-to-zoom default (Area 4) makes "restore everywhere" cheap — the printed raster already shows the whole grid, so a CSS max-width:100% scale suffices. A is a real fix, not a paper-over, matching the design-conscious preference against confusing half-states.

---

## Refine viewport & wizard chrome

Pre-decided targets locked directly (roadmap-specified, mechanism = planner's call): fit-to-zoom default + no-jump on size (D-04), rail fits browser (D-06), view-switcher bottom-snap (D-07), auto-advance on upload (D-08), dark-viewport re-token (D-09). The one open fork was the wizard-chrome restructure depth:

| Option | Description | Selected |
|--------|-------------|----------|
| A. Full fixed app-shell | AtelierShell → fixed top step-bar + flex-1 min-h-0 scrolling content + fixed bottom action bar (Next); view-switcher docks bottom; rail scrolls internally; desktop-scoped to compose with P24 mobile reflow. | ✓ |
| B. Minimal pin | Keep current layout; pin only the Back/Next footer + dock view-switcher bottom; step-bar stays in-flow (only half-delivers SC9). | |

**User's choice:** A
**Notes:** SC9 explicitly wants fixed chrome + internal content scroll; the long drill/supply list is the motivating case a minimal pin fails. Build as a proper 3-zone shell, honoring single-mount canvas (P20 D-14) and the P24 container-query/sticky-canvas reflow.

---

## Claude's Discretion

- Fit-mode mechanism location (viewer.ts on grid-set vs App-level fitToContainer() after recompute).
- Debounce duration (~400–600ms) and the exact clamp-guard predicate for custom-size auto-fire.
- Print raster fit: CSS max-width:100% scale (default) vs a light print-scale redraw.
- SC3 open defaults (kit=all, drillStyle=square, color-exclude in Advanced) are already resolved by Phase 23 — Phase 25 only confirms they survive deletion.
- Advanced-disclosure affordance cue (item 4) — add only if UAT still finds it unclear.

## Deferred Ideas

- Delete Step3Canvas + its 3 fulfillment handlers + coupled slate modals + flags.ts module; reach the single UI tree → Phase 26 (SC5).
- Canvas PNG packet + Diamond Drills USA cart re-home into the Order step → Phase 26 (ORDER-04/05).
- Service-fee line + order-ref/threshold flagging (old v3.0 Phase 17 FEE-01) → still Backlog.
