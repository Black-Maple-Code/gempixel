---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Canvas-First Redesign — Phases 20–25
current_phase: 20
current_phase_name: atelier-design-system-canvas-first-shell
status: executing
stopped_at: Phase 20 UI-SPEC approved
last_updated: "2026-07-13T23:38:59.635Z"
last_activity: 2026-07-13
last_activity_desc: Phase 20 execution started
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 5
  completed_plans: 1
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-13)

**Core value:** Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.
**Current focus:** Phase 20 — atelier-design-system-canvas-first-shell

## Current Position

Phase: 20 (atelier-design-system-canvas-first-shell) — EXECUTING
Plan: 2 of 5
Status: Ready to execute
Last activity: 2026-07-13 — Phase 20 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 25
- Average duration: 186s
- Total execution time: 0.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Core Engine & Color Mathematics | 2 | 372 | 186 |
| 2. Client-side Engine & Worker Architecture | 2 | - | - |
| 3. Canvas Viewer & Zoom/Pan Interaction | 2 | - | - |
| 4. Supply Planning, Customization & Exports | 3 | - | - |
| 5. Supply Partnerships & Checkout Integration | 2 | - | - |
| 6. Commission Workspace & Streamlined Artist UX | 2 | - | - |
| 7. Symbol-Overlay Canvas & Margin Legends | 0 | - | - |
| 11 | 3 | - | - |
| 13 | 2 | - | - |
| 15 | 3 | - | - |
| 16 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: 01-02 (162s), 01-01 (210s)
- Trend: Stable

*Updated after each plan completion*
| Phase 01 P01 | 210 | 2 tasks | 6 files |
| Phase 01 P02 | 162 | 2 tasks | 3 files |
| Phase 02 P01 | 163 | 2 tasks | 3 files |
| Phase 02 P02 | 347 | 3 tasks | 3 files |
| Phase 03 P01 | 150 | 2 tasks | 3 files |
| Phase 03 P02 | 130 | 2 tasks | 3 files |
| Phase 04 P01 | 420 | 3 tasks | 7 files |
| Phase 04 P02 | 120 | 3 tasks | 3 files |
| Phase 04 P03 | 95 | 3 tasks | 3 files |
| Phase 11 P01 | 6min | 2 tasks | 4 files |
| Phase 11 P02 | 12min | 2 tasks | 3 files |
| Phase 11 P03 | 30min | 3 tasks | 2 files |
| Phase 13 P02 | 5min | 2 tasks | 1 files |
| Phase 15 P01 | 6min | 2 tasks | 5 files |
| Phase 15 P02 | 10min | 3 tasks | 5 files |
| Phase 15 P03 | 8min | 3 tasks | 3 files |
| Phase 16 P01 | 6min | 2 tasks | 3 files |
| Phase 16 P02 | 6min | 2 tasks | 2 files |
| Phase 16 P03 | 9min | 3 tasks | 4 files |
| Phase 16 P04 | 25min | 3 tasks | 4 files |
| Phase 20 P01 | 5 min | 3 tasks | 8 files |

## Risk & Health

- **Code coverage rate:** 100%
- **Build compiler rate:** 100%
- **Requirement coverage rate:** 100% (v4.0: 19/19 requirements mapped to Phases 20–25)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260711-wvv | Fix blocker B1 (worker matching errors → stuck loading) + W5 inline error banner | 2026-07-12 | 790bb21..19a2dfa | [260711-wvv-fix-blocker-b1-worker-matching-errors-le](./quick/260711-wvv-fix-blocker-b1-worker-matching-errors-le/) |
| 260711-x6p | Fix blocker B2 (match-abort race → stale wrong-dimension grid) via monotonic run-id | 2026-07-12 | 6a3e563..43b267f | [260711-x6p-fix-blocker-b2-match-abort-concurrency-r](./quick/260711-x6p-fix-blocker-b2-match-abort-concurrency-r/) |
| 260712-05k | Fix blocker B3 (silent quota eviction → data loss) + W9 (CSPRNG UUIDs); save() returns status + UI warning | 2026-07-12 | 65f3b1a..e75a7f5 | [260712-05k-fix-blocker-b3-warning-w9-projectstore-s](./quick/260712-05k-fix-blocker-b3-warning-w9-projectstore-s/) |
| 260712-0io | Fix blocker B4 (symbol pool wraps at 82 → duplicate legend symbols); unique multi-char overflow symbols | 2026-07-12 | cdac74e | [260712-0io-fix-blocker-b4-symbol-pool-wraps-at-82-s](./quick/260712-0io-fix-blocker-b4-symbol-pool-wraps-at-82-s/) |
| 260712-qa1 | Fix WR-02 estimate-vs-cart pricing divergence: fixed-bag branch now mapping-aware ($0 line for unmapped-shape colors, matching the cart) | 2026-07-13 | 9feed49..c1c3ff8 | [260712-qa1-fix-wr-02-estimate-vs-cart-pricing-diver](./quick/260712-qa1-fix-wr-02-estimate-vs-cart-pricing-diver/) |
| 260712-wep | Fix prod Web Worker regression: Vite shipped matcher.worker as raw .ts (image matching silently failed in prod); inline `new Worker(new URL())` in MatcherClient so Vite bundles it to hashed .js | 2026-07-13 | d7fe6fb | [260712-wep-fix-prod-web-worker-regression-vite-ship](./quick/260712-wep-fix-prod-web-worker-regression-vite-ship/) |
| 260713-01y | Redesign grid+symbols allocation: symbols-first (105 distinct shape-glyphs lead), digits removed entirely, unambiguous capitals (excl. B G I O Q S Z) as last resort; killed the confusing letter/number iconography + glyph+digit combos. Pruned 17 confusable glyphs (rotations/interior twins) so every mark is easily distinguishable. | 2026-07-13 | 2978605..db586e3 | [260713-01y-redesign-grid-symbols-allocation-distinc](./quick/260713-01y-redesign-grid-symbols-allocation-distinc/) |

## Continuity & Handoff

Items acknowledged and carried forward at the v2.1 milestone close (2026-07-12), accepted as tech debt:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| deferred-phase | Phase 10: Project Load Correctness (LOAD-01, LOAD-02) | not planned — rewrite planned | v2.1 close |
| deferred-phase | Phase 12: Supply Pricing Accuracy (PRICE-01, PRICE-02, DATA-01) | **superseded by v3.0 Phase 15** — carried into v3.0 | v2.1 close |
| deferred-phase | Phase 14: Security & Cleanup (SEC-01) | not planned — rewrite planned | v2.1 close |
| verification-gap | Phase 07 (07-VERIFICATION.md) | human_needed — UAT not signed off | v2.1 close |
| verification-gap | Phase 08 (08-VERIFICATION.md) | human_needed — UAT not signed off | v2.1 close |
| verification-gap | Phase 09 (09-VERIFICATION.md) | human_needed — UAT not signed off | v2.1 close |

## Deferred Items

Items acknowledged and deferred at the v3.0 **force-close** (override closeout) on 2026-07-13. v3.0 shipped only Phases 15–16 (correctness foundation); the milestone's headline scope was carried to the ROADMAP Backlog. Full criteria in `milestones/v3.0-ROADMAP.md`; requirements in `milestones/v3.0-REQUIREMENTS.md`. Under v4.0 the honest order-packet/handoff idea is partially revived (ORDER-01/02, Phase 23); the viewport-native wizard and Customer/Artist mode split are superseded by the canvas-first redesign, not resumed.

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| deferred-phase | Phase 17: Service Fee & Customer Order Packet (FEE-01, ORDER-01..05) | order-packet/handoff partially revived under v4.0 ORDER-01/02 (Phase 23); service-fee line + order-ref/threshold still deferred | v3.0 force-close |
| deferred-phase | Phase 18: Viewport-Native Wizard (VIEWPORT-01..03) | superseded by v4.0 canvas-first shell | v3.0 force-close |
| deferred-phase | Phase 19: Two-Mode Split — Customer/Artist (MODE-01..04) | superseded by v4.0 customer-first redesign | v3.0 force-close |
| verification-gap | Phase 07 (07-VERIFICATION.md) | human_needed — UAT not signed off (carried from v2.1) | re-ack v3.0 close |
| verification-gap | Phase 08 (08-VERIFICATION.md) | human_needed — UAT not signed off (carried from v2.1) | re-ack v3.0 close |
| verification-gap | Phase 09 (09-VERIFICATION.md) | human_needed — UAT not signed off (carried from v2.1) | re-ack v3.0 close |

## Session Continuity

Last session: 2026-07-13T23:38:39.549Z
Stopped at: Phase 20 UI-SPEC approved
Resume file: .planning/phases/20-atelier-design-system-canvas-first-shell/20-UI-SPEC.md

## Decisions

- [v4.0 roadmap]: Structured v4.0 as 6 phases (20–25) mirroring the research's convergent, dependency-ordered build order: (20) Atelier design system + canvas-first shell → (21) shared UI primitives → (22) additive engine (density helper / detectedColorCount / target-N reduceToColorCount / single-source integer-cents quote selector, engine-only commits) → (23) the four screens in journey order (Upload → Refine keystone → Supplies → Order) → (24) mobile + touch → (25) strangler cleanup. Phase numbering continues from v3.0 (ended at Phase 19). Phases 21 and 25 carry no REQ-ID by design (infrastructure/cleanup).
- [v4.0 roadmap]: Strangler-fig build constraint encoded in the phase ordering — App.tsx stays the state owner, screen children stay pure/props-only, engine/* signatures change only inside Phase 22 (never a UI phase), one screen swapped in at a time in Phase 23, and the 240+ Vitest baseline stays green at every commit so the app ships green at each phase. Directly prevents the v3.0 "two big UI reworks at once → force-closed at 40%" failure.
- [v4.0 roadmap]: Density anchored to 2.5mm/dot (10 dots/inch) — the mock's inch labels are non-functional; every inch figure derives from grid dims via one helper (QUOTE-01, resolved in Phase 22). The Order step is a client-side confirm + order-packet download (no payment / lab submission — that's v5.0). Custom canvas size IS in v4.0 scope (REFINE-02).
- [v3.0 roadmap]: Compressed the research's 8-phase suggestion to 5 phases under standard granularity — single-requirement/thin phases (Vendor cleanup, Data integrity, Service fee) folded into their nearest coherent neighbor. Load-bearing dependency order preserved: correctness (15) → optimized supply plan (16) → fee + order packet (17) → viewport wizard (18) → mode split (19, last). The two UI reworks (18, 19) are kept as separate phases.
- [Phase 15]: 15-01: Removed Prodigi vendor; narrowed CanvasVendor union to 'lumaprints' | 'finerworks'; calculateCanvasCost returns number|null (unknown vendor -> null, never $0); normalizeVendor migrates any legacy/tampered persisted vendor to lumaprints at load; selectedVendor persisted as an additive optional ProjectData field.
- [Phase 15]: 15-02: engine/money.ts canonical integer-cents helper (EPSILON-safe round-half-up, throws on non-finite); bagPlanner treats a missing price as Infinity (never $0-self-select), adds a 500 tier from a single canonical size table, flags hasUnpricedSize for colors coverable only by an unpriced size; App.tsx sums line items in cents to reconcile the displayed total and surfaces unpriced colors via the existing actionError banner.
- [Phase 15]: 15-03: DATA-01 drill-variant integrity test (unique-or-allow-listed IDs, no empty reachable mappings beyond allow-list, full palette coverage) ratchets against data drift; hasVariantMapping surfaces shape-unmapped grid colors via the existing banner. Data-owner checkpoint adjudicated the known holes to safe reversible defaults: dup-ID pairs 731/732, 781/782, 776/3326 kept as intended aliases; empty mappings 471/square, 798/round, BLANC/round, ECRU/round kept surfaced-as-unmapped (DRILL_VARIANTS unchanged).
- [Phase 16]: 16-01: minCostBulk retires cost-min for FEWEST-bags-within-the-LOCKED-overshoot-cap (option-b; wasted drills <= one smallest available bulk bag). Same bounded recursive search (D-02, no solver/greedy/dep); cost only a bounded tiebreak via money.ts cents. Total deterministic order so legend==cart (D-03); dye-lot <=800 pack200 path untouched (D-04). 1050 @ standard -> {1000:1,500:1}, 1x2000 rejected.
- [Phase 16]: 16-02: naiveColorPack = dye-lot-aware naive baseline; planOrderSupply (D-13/BAG-02) = shared aggregator: optimized rows + totals + naive baseline priced on SAME +10% safety basis, all integer-cents; savingsCents=max(0,naive-optimized). OrderSupplyPlan shape frozen in 16-02-SUMMARY.
- [Phase 16]: 16-03: planOrderSupply is the sole App render-path call (D-13); optimizeBagsCost toggle + fixed-size controls fully retired (D-11, rg gate clean); totalPackets/drill-cost/unpriced codes sourced from the aggregator; SC2/BAG-02 render test asserts visible bag count == totalPackets.
- [Phase 16]: 16-04 (BAG-02/BAG-03, human-verify APPROVED): always-on savings headline from planOrderSupply.savingsCents/savingsPct; a11y-safe "Why these bags?" expander in the Step 3 panel; fix-forward replaced a broken window.print() (was printing the CANVAS GRID) with an isolated print-only "GemPixel Supply Plan Report". tsc 0; vitest 237/237.
- [Phase 20]: Repointed engine 'Outfit'->'Archivo Variable' canvas symbol literals (string-only, signatures frozen per strangler rule) — Keeps a loaded font for canvas symbols without touching engine signatures; theme-param removal deferred to Phase 22
- [Phase 20]: Self-hosted fonts via @fontsource JS imports + Fontaine no-CLS metric fallbacks; each --font-* value names its fallback family — Dodges Tailwind v4 external-URL bug and satisfies DESIGN-02 no-external-request + no-CLS

## Operator Next Steps

- Plan the first v4.0 phase with `/gsd-plan-phase 20`
