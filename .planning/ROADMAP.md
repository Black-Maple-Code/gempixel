# Roadmap: GemPixel

## Milestones

- ✅ **v2.0** — Phases 1–9 (shipped 2026-07-10): color engine → worker pipeline → canvas viewer → supply planning → partnerships → commission UX → symbols → multi-vendor export → viewport HUD.
- ✅ **v2.1 Post-Review Remediation** — Phases 10–14 (shipped 2026-07-12): active scope **Phases 11 + 13** (storage robustness + off-main-thread decode). Phases **10, 12, 14 deferred** — see Backlog.
- 🚧 **v3.0 Two-Mode Viewport Experience** — Phases 15–19 (in progress, opened 2026-07-12): trustworthy pricing/data → optimized supply plan → service fee + customer order packet → viewport-native wizard → two-mode split. Correctness-first, both UI reworks staged and never merged.

Full phase details for shipped milestones are archived in `milestones/v2.1-ROADMAP.md`.

## Phases

<details>
<summary>✅ v2.0 — Phases 1–9 (SHIPPED 2026-07-10)</summary>

- [x] Phase 1: Core Engine & Color Mathematics (2/2) — 2026-07-07
- [x] Phase 2: Client-side Engine & Worker Architecture (2/2) — 2026-07-07
- [x] Phase 3: Canvas Viewer & Zoom/Pan Interaction (2/2) — 2026-07-07
- [x] Phase 4: Supply Planning, Customization & Exports (3/3) — 2026-07-07
- [x] Phase 5: Supply Partnerships & Checkout Integration (2/2) — 2026-07-07
- [x] Phase 6: Commission Workspace & Streamlined Artist UX (2/2) — 2026-07-08
- [x] Phase 7: Symbol-Overlay Canvas & Margin Legends (2/2) — 2026-07-09 ⚠ UAT sign-off deferred (verification `human_needed`)
- [x] Phase 8: Custom Canvas Export & Multiple Vendor Integration (2/2) — 2026-07-09 ⚠ UAT sign-off deferred
- [x] Phase 9: Viewport HUD Overlay & Intuitive Wizard Navigation UX (2/2) — 2026-07-10 ⚠ UAT sign-off deferred

</details>

<details>
<summary>✅ v2.1 Post-Review Remediation — Phases 10–14 (SHIPPED 2026-07-12; active scope 11 + 13)</summary>

- [ ] Phase 10: Project Load Correctness — **deferred** (LOAD-01, LOAD-02)
- [x] Phase 11: Storage Robustness & Error Feedback (3/3) — 2026-07-12 (STORE-01, STORE-02, ERR-01)
- [ ] Phase 12: Supply Pricing Accuracy — **deferred** (PRICE-01, PRICE-02, DATA-01)
- [x] Phase 13: Performance — Off-Main-Thread Decode (3/3) — 2026-07-12 (PERF-01)
- [ ] Phase 14: Security & Cleanup — **deferred** (SEC-01)

Pre-milestone: review blockers B1–B4 fixed via quick tasks (260711-wvv, 260711-x6p, 260712-05k, 260712-0io).

</details>

### 🚧 v3.0 Two-Mode Viewport Experience — Phases 15–19 (ACTIVE)

- [x] **Phase 15: Trustworthy Pricing & Data Foundation** — vendor cleanup + correct pricing + variant integrity, all test-guarded before any UI churn (completed 2026-07-13)
- [ ] **Phase 16: Optimized Supply Plan & Savings** — surface the fewest-bags plan with a dye-lot "why" and a savings-vs-naive explainer
- [ ] **Phase 17: Service Fee & Customer Order Packet** — % service fee + versioned, fulfillment-ready order packet with review, confirmation, and client-side handoff
- [ ] **Phase 18: Viewport-Native Wizard** — mode-agnostic in-canvas wizard replacing the sidebars + page-flip flow, ships green (UI rework #1)
- [ ] **Phase 19: Two-Mode Split (Customer / Artist)** — thin capability-map layer over the stabilized wizard giving each mode a tailored path (UI rework #2, last)

## Phase Details

*(Active milestone v3.0. Ordering is the load-bearing risk decision all four researchers converged on: pure-engine correctness first, then the viewport wizard as a mode-agnostic strangler that ships green, then the mode split last as a thin layer. The two UI reworks — Phase 18 and Phase 19 — are deliberately separate and never merged.)*

### Phase 15: Trustworthy Pricing & Data Foundation

**Goal**: Every price, vendor, and drill-variant number the app shows is correct and test-guarded, so no downstream quote, fee, or order packet can compound a bad figure — landed while the app is still the familiar wizard, before any UI change.
**Depends on**: Nothing new (builds on the shipped v2.1 baseline of 178 passing tests)
**Requirements**: VENDOR-02, PRICE-01, PRICE-02, PRICE-03, DATA-01
**Success Criteria** (what must be TRUE):

  1. Only Lumaprints and FinerWorks appear as selectable canvas vendors, and a saved project that referenced Prodigi opens on a valid vendor showing a real (never $0) canvas price — the unknown-vendor cost is guarded, not silently 0.
  2. A 500-count drill bag shows its own correct per-packet price (priced at a tier between 200 and 1000, never at the 5000 bulk tier).
  3. No customer-facing $0 line ever appears for a real billable item; an unpriced bag size is flagged or excluded and is never self-selected as the cheapest option.
  4. Itemized line items always sum exactly to the displayed total (integer-cents money math reconciles).
  5. An automated integrity test guards the drill-variant table (unique or explicitly allow-listed IDs, no empty reachable mappings, every palette color mapped), and any unmapped color is surfaced to the user rather than silently dropped.

**Plans**: 3/3 plans complete
**Wave 1**

- [x] 15-01-PLAN.md — Vendor cleanup: remove Prodigi, narrow the vendor union, null-guard unknown-vendor cost, migrate persisted vendor (VENDOR-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-02-PLAN.md — Pricing accuracy: 500 tier, no $0-as-free (hasUnpricedSize), integer-cents money helper + reconciliation (PRICE-01/02/03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 15-03-PLAN.md — Data integrity: variant-table integrity test + unmapped-color surfacing + data-owner adjudication (DATA-01)

### Phase 16: Optimized Supply Plan & Savings

**Goal**: The user can see a trustworthy, minimized gem-bag plan and understand why it is grouped the way it is and how much it saves.
**Depends on**: Phase 15
**Requirements**: BAG-01, BAG-02, BAG-03
**Success Criteria** (what must be TRUE):

  1. The supply plan uses the fewest bags that still respect dye-lot color consistency, breaking ties by lowest total cost.
  2. The user sees the optimized plan — per-color bags, total bag count, and total cost — computed from the same shared engine the cart and order packet use, so the numbers cannot diverge.
  3. A plain-language explanation tells the user why bags are grouped the way they are (the dye-lot "why").
  4. The user can see how much the optimized plan saves versus a naive one-size-per-color purchase.

**Plans**: TBD
**UI hint**: yes

### Phase 17: Service Fee & Customer Order Packet

**Goal**: A finished design becomes a trustworthy itemized quote and a self-contained, fulfillment-ready order packet the user can review and hand off — the terminal engine flow, assembled as pure blocks before the UI reworks.
**Depends on**: Phase 16
**Requirements**: FEE-01, ORDER-01, ORDER-02, ORDER-03, ORDER-04, ORDER-05
**Success Criteria** (what must be TRUE):

  1. A configurable percent-based service/handling fee shows as its own itemized line (percent and dollar amount), disclosed before the order is submitted.
  2. The user turns a finished design into a structured order packet (design PNG, canvas spec, optimized gem-bag list, itemized totals, and the fee), reviews an itemized summary before submitting, and receives a saved confirmation carrying a unique order reference ID.
  3. An order exceeding any configurable threshold (drill count, dollar total, color count, or physical canvas size) is automatically flagged for human review with "we'll confirm with you" messaging.
  4. The order packet is a versioned, self-contained, JSON-round-trippable document (quote snapshot in integer cents, no PII transmitted) whose schema is designed to be ingested unchanged by the future v4.0 backend.
  5. The user hands off the packet entirely client-side — download by default with a share/email fallback — and the design PNG is delivered as a file rather than embedded in localStorage.

**Plans**: TBD
**UI hint**: yes

### Phase 18: Viewport-Native Wizard

**Goal**: The guided design flow lives in the viewport — contextual in-canvas surfaces replace the expand/collapse sidebars and page-flip wizard — with no regression, and it stays strictly mode-agnostic (UI rework #1, ships green before any mode work).
**Depends on**: Phase 17
**Requirements**: VIEWPORT-01, VIEWPORT-02, VIEWPORT-03
**Success Criteria** (what must be TRUE):

  1. The most-used design controls are available as contextual in-viewport surfaces (extending the Phase 9 HUD), so the user can complete core work without opening the sidebars.
  2. Step guidance appears in-context and the sidebars + page-flip wizard are progressively retired, with the 178-test baseline and the <1ms Grid/Symbol/Photo view switcher preserved (the phase ships green before any mode branching exists).
  3. A first-run, dismissible coach-mark tour introduces new users to the viewport controls using browser-native anchoring (no tour library).

**Plans**: TBD
**UI hint**: yes

### Phase 19: Two-Mode Split (Customer / Artist)

**Goal**: A thin capability-map layer riding on top of the stabilized viewport wizard gives Customer and Artist each a tailored path, applying the mode-conditional gating of the service fee, order packet, affiliate links, and price table — with no mode leakage (UI rework #2, last).
**Depends on**: Phase 18
**Requirements**: MODE-01, MODE-02, MODE-03, MODE-04
**Success Criteria** (what must be TRUE):

  1. The user can choose between Customer and Artist mode; the choice is persisted, reversible, and preserves the current design when switched.
  2. Artist sees the editable cost table, affiliate links, and drill cart; Customer sees the guided buy flow, service fee, and order packet and never sees the raw price table, affiliate parameters, or the drill-cart link (verified by absence tests, not just presence tests).
  3. A URL parameter can launch the app directly into Customer or Artist mode.
  4. Saved projects carry a `mode` and `schemaVersion`; a pre-v3.0 project loads as Artist mode with a defined carry-over rule, so artist-only economics never leak into a customer quote.

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1–9 (v2.0 suite) | v2.0 | 19/19 | Complete | 2026-07-07 → 07-10 |
| 11. Storage Robustness & Error Feedback | v2.1 | 3/3 | Complete | 2026-07-12 |
| 13. Performance — Off-Main-Thread Decode | v2.1 | 3/3 | Complete | 2026-07-12 |
| 10. Project Load Correctness | v2.1 | — | Deferred | — |
| 12. Supply Pricing Accuracy | v2.1 | — | Deferred (superseded by Phase 15) | — |
| 14. Security & Cleanup | v2.1 | — | Deferred | — |
| 15. Trustworthy Pricing & Data Foundation | v3.0 | 3/3 | Complete    | 2026-07-13 |
| 16. Optimized Supply Plan & Savings | v3.0 | — | Not started | - |
| 17. Service Fee & Customer Order Packet | v3.0 | — | Not started | - |
| 18. Viewport-Native Wizard | v3.0 | — | Not started | - |
| 19. Two-Mode Split (Customer / Artist) | v3.0 | — | Not started | - |

## Backlog

Deferred from v2.1 — to be re-scoped/rewritten in a future milestone (start with `/gsd-new-milestone`). Original success criteria are preserved in `milestones/v2.1-ROADMAP.md`; original requirements in `milestones/v2.1-REQUIREMENTS.md`.

**Note:** v3.0 Phase 15 supersedes the deferred **Phase 12 (Supply Pricing Accuracy)** — PRICE-01/PRICE-02/DATA-01 are carried into v3.0 and mapped to Phase 15. Phases 10 and 14 remain deferred.

- **Phase 10 — Project Load Correctness:** a restored saved project keeps its saved canvas price (not the auto-recomputed vendor cost) and renders the exact saved grid regardless of current substitution/smoothing toggles. (LOAD-01 review W1, LOAD-02 review W2)
- **Phase 14 — Security & Cleanup:** validate compiled partner canvas URLs against an http/https allowlist (block `javascript:`/`data:`), and wire-up-or-remove the unfinished `compileCanvasPartnerUrl` path. (SEC-01 W10, IN-02)
