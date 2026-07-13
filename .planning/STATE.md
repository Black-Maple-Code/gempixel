---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Two-Mode Viewport Experience — Phases 15–19
current_phase: 16
current_phase_name: Optimized Supply Plan & Savings
status: verifying
stopped_at: Completed 15-03-PLAN.md (Phase 15 complete — 3/3 plans)
last_updated: "2026-07-13T00:48:36.790Z"
last_activity: 2026-07-13
last_activity_desc: "Completed quick task 260712-qa1: WR-02 estimate-vs-cart pricing fix"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-12)

**Core value:** Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.
**Current focus:** Phase 15 — trustworthy-pricing-data-foundation

## Current Position

Phase: 16 — Optimized Supply Plan & Savings
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-07-13 — Completed quick task 260712-qa1: WR-02 estimate-vs-cart pricing fix (fixed-bag mapping-aware)

**v3.0 phase map (dependency-ordered — correctness → UI reworks, both UI reworks separate):**

| Phase | Name | Requirements |
|-------|------|--------------|
| 15 | Trustworthy Pricing & Data Foundation | VENDOR-02, PRICE-01/02/03, DATA-01 |
| 16 | Optimized Supply Plan & Savings | BAG-01/02/03 |
| 17 | Service Fee & Customer Order Packet | FEE-01, ORDER-01..05 |
| 18 | Viewport-Native Wizard (UI rework #1, ships green) | VIEWPORT-01/02/03 |
| 19 | Two-Mode Split (UI rework #2, last) | MODE-01/02/03/04 |

## Performance Metrics

**Velocity:**

- Total plans completed: 21
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

## Risk & Health

- **Code coverage rate:** 100%
- **Build compiler rate:** 100%
- **Requirement coverage rate:** 100% (v3.0: 21/21 requirements mapped to phases 15–19)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260711-wvv | Fix blocker B1 (worker matching errors → stuck loading) + W5 inline error banner | 2026-07-12 | 790bb21..19a2dfa | [260711-wvv-fix-blocker-b1-worker-matching-errors-le](./quick/260711-wvv-fix-blocker-b1-worker-matching-errors-le/) |
| 260711-x6p | Fix blocker B2 (match-abort race → stale wrong-dimension grid) via monotonic run-id | 2026-07-12 | 6a3e563..43b267f | [260711-x6p-fix-blocker-b2-match-abort-concurrency-r](./quick/260711-x6p-fix-blocker-b2-match-abort-concurrency-r/) |
| 260712-05k | Fix blocker B3 (silent quota eviction → data loss) + W9 (CSPRNG UUIDs); save() returns status + UI warning | 2026-07-12 | 65f3b1a..e75a7f5 | [260712-05k-fix-blocker-b3-warning-w9-projectstore-s](./quick/260712-05k-fix-blocker-b3-warning-w9-projectstore-s/) |
| 260712-0io | Fix blocker B4 (symbol pool wraps at 82 → duplicate legend symbols); unique multi-char overflow symbols | 2026-07-12 | cdac74e | [260712-0io-fix-blocker-b4-symbol-pool-wraps-at-82-s](./quick/260712-0io-fix-blocker-b4-symbol-pool-wraps-at-82-s/) |
| 260712-qa1 | Fix WR-02 estimate-vs-cart pricing divergence: fixed-bag branch now mapping-aware ($0 line for unmapped-shape colors, matching the cart) | 2026-07-13 | 9feed49..c1c3ff8 | [260712-qa1-fix-wr-02-estimate-vs-cart-pricing-diver](./quick/260712-qa1-fix-wr-02-estimate-vs-cart-pricing-diver/) |

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

## Session Continuity

Last session: 2026-07-13T00:26:08.776Z
Stopped at: Completed 15-03-PLAN.md (Phase 15 complete — 3/3 plans)
Resume file: None

## Decisions

- [Phase ?]: 11-01: Per-type storage codecs preserve legacy on-disk formats (no blanket JSON codec); safeStorage is the single guarded audit point for localStorage
- [Phase 11]: 11-02: migrated App.tsx 7 persisted settings onto usePersistentState (IN-01); safeStorage import deferred to 11-03 under noUnusedLocals; canvasTemplate uses a custom normalization codec (Pitfall 4)
- [Phase ?]: ERR-01: unified actionError banner folds saveErrorMsg; guarded checkout unmapped-log parse via safeStorage (corrupt -> [] + banner, checkout proceeds)
- [Phase 13]: D-09: single loading overlay branches on loadingPhase — indeterminate 'Preparing image…' during off-thread decode, determinate 'Matching colors: {progress}%' on first worker progress
- [Phase 13]: D-10: match-error banner copy generalized to stage-agnostic 'Couldn't process the image: {matchError}', staying a plain JSX text child
- [v3.0 roadmap]: Compressed the research's 8-phase suggestion to 5 phases under standard granularity — single-requirement/thin phases (Vendor cleanup, Data integrity, Service fee) folded into their nearest coherent neighbor. Load-bearing dependency order preserved: correctness (15) → optimized supply plan (16) → fee + order packet (17) → viewport wizard (18) → mode split (19, last). The two UI reworks (18, 19) are kept as separate phases.
- [Phase 15]: 15-01: Removed Prodigi vendor; narrowed CanvasVendor union to 'lumaprints' | 'finerworks'; calculateCanvasCost returns number|null (unknown vendor -> null, never $0); normalizeVendor migrates any legacy/tampered persisted vendor to lumaprints at load; selectedVendor persisted as an additive optional ProjectData field.
- [Phase 15]: 15-02: engine/money.ts canonical integer-cents helper (EPSILON-safe round-half-up, throws on non-finite); bagPlanner treats a missing price as Infinity (never $0-self-select), adds a 500 tier from a single canonical size table, flags hasUnpricedSize for colors coverable only by an unpriced size; App.tsx sums line items in cents to reconcile the displayed total and surfaces unpriced colors via the existing actionError banner.
- [Phase 15]: 15-03: DATA-01 drill-variant integrity test (unique-or-allow-listed IDs, no empty reachable mappings beyond allow-list, full palette coverage) ratchets against data drift; hasVariantMapping surfaces shape-unmapped grid colors via the existing banner. Data-owner checkpoint adjudicated the known holes to safe reversible defaults: dup-ID pairs 731/732, 781/782, 776/3326 kept as intended aliases; empty mappings 471/square, 798/round, BLANC/round, ECRU/round kept surfaced-as-unmapped (DRILL_VARIANTS unchanged).

## Operator Next Steps

- Plan the first v3.0 phase with `/gsd-plan-phase 15`
