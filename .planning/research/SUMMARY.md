# Project Research Summary

**Project:** GemPixel — v3.0 Two-Mode Viewport Experience
**Domain:** Client-side creative-commerce tool (image to diamond-art / gem-art planner) pivoting to a two-mode (self-serve Artist / done-for-you Customer) viewport-native experience with quote-based, manual/offline fulfillment
**Researched:** 2026-07-12
**Confidence:** HIGH

## Executive Summary

v3.0 is overwhelmingly a **composition-and-presentation milestone, not new engine work**. All four researchers, reading the actual v2.1 source, converge on the same conclusion: the pure engine (bagPlanner, checkout, export, projectStore, variants) already contains the optimizer, pricing, PNG export, and serialization patterns v3.0 needs. The job is to (a) correct the pricing/data layer, (b) aggregate existing pure functions into a mode-agnostic set of building blocks, and (c) re-present them in a viewport-native, two-mode UI. The milestone stays **strictly client-side with near-zero new dependencies**: the only candidate is the optional first-party @preact/signals (~1.6 KB) for cross-cutting viewport/mode state; coach-marks are browser-native (Popover API + CSS Anchor Positioning), and the order packet is a client-side versioned OrderPacket JSON that becomes the v4.0 backend contract. **No backend, payments, or auth this milestone**; that is v4.0.

The load-bearing risk is **sequencing**. There are FOUR live, code-grounded pricing/data bugs that must be fixed first, because the customer quote, the %-service fee, and the order packet all compound on top of pricing that is currently wrong: (1) defaultPacketCost has no 500-count branch (PRICE-01), so a 500 bag is priced at the 5000-bulk tier; (2) bagPlanner's priceDb[size] ?? 0 / || 0 prices unpriced sizes at $0, and because the search is a cost minimizer, zero is self-selecting (PRICE-02); (3) variants.ts has empty mappings (471 square, 798 round) and duplicate variant IDs (731/732, 781/782) that the DATA-01 integrity test must adjudicate; (4) removing Prodigi will make old saved projects show a $0 canvas, because calculateCanvasCost returns 0.0 for unknown vendors, so vendor cleanup must be paired with an unknown-vendor guard and a persisted-state migration.

The second load-bearing constraint is **staging the two UI reworks, never merging them**. The correct order all four agree on: pure-engine correctness first (pricing, data integrity, bag aggregator, service fee, packet-ready blocks), THEN the viewport-wizard rework as an incremental strangler (HUD alongside the existing sidebars, migrating one wizard Step at a time out of the 2,319-line App.tsx god component), THEN the mode split LAST as a thin capability-map layer on top of the stabilized wizard. Mode branching must never be baked into the old sidebar wizard; that forces a double-rework that destroys the shipped 178-test baseline. The order packet comes last because it composes everything before it.

## Key Findings

### Recommended Stack

The validated base stack (Preact 10, Vite 6, TypeScript strict, Tailwind v4, culori, native Web Worker, safeStorage + usePersistentState) is **fixed and not re-researched**. The headline verdict for v3.0 additions: **essentially ZERO new runtime dependencies**. Every new capability is best served by browser-native APIs or code the repo already has. See [STACK.md](STACK.md).

**Core technologies (additions only):**
- **@preact/signals ^2.9.2** (optional, recommended, ~1.6 KB): cross-cutting mode / active-panel / wizard-step state; first-party; lets a HUD control update without re-rendering the expensive canvas subtree (which lifted useState in App.tsx cannot do cleanly). Zero-dep fallback: Preact Context + useState.
- **Browser-native (no dep):** coach-marks via Popover API + CSS Anchor Positioning (Baseline 2026, ~91% traffic) anchored to the Phase 9 HUD; not a tour library (Shepherd/Joyride/driver.js fight a canvas UI and add weight for the wrong problem).
- **Browser-native (no dep):** order-packet generation reuses export.ts (canvas.toBlob / URL.createObjectURL) + CSS @media print; the gem-bag optimizer already exists in bagPlanner.ts; no ILP/LP solver.
- **Web Share API + mailto: + download** for the client-side "send packet" path; no email SDK, no server. fflate ^0.8.3 only if a single-file .zip deliverable is a hard requirement.

### Expected Features

v3.0 covers five target areas; nearly all Customer-mode functionality **composes existing pure modules**. See [FEATURES.md](FEATURES.md).

**Must have (table stakes):**
- Mode selector (Artist/Customer) with plain-language copy, persisted and reversible, preserving the current design on switch; the pivot's defining feature.
- Pricing accuracy: PRICE-01 (500-bag), PRICE-02 (no $0 size), DATA-01 (variant integrity); everything downstream trusts this.
- Vendor cleanup: Lumaprints + FinerWorks only (remove Prodigi).
- Customer "Buy" to structured order packet (design PNG + gem-bag list + canvas spec + %fee + itemized totals) with review-before-submit and a saved confirmation.
- Itemized % service/handling fee shown as its own line (% and $), disclosed pre-submit.
- Surface the existing gem-bag optimization (per-color bags, total, cost) + one plain-language dye-lot "why" tooltip.
- Migrate the most-used wizard controls into contextual in-viewport surfaces (extend Phase 9 HUD).

**Should have (differentiators):**
- Adaptive, mode-aware coach-mark first-run tour (lightweight, native; no tour lib).
- Self-contained order-packet file that round-trips into the future v4.0 admin backend (design the schema now = zero rework later).
- Automatic large/complex-order flagging with "we'll confirm" messaging.
- Deep-link/URL param to launch directly into a mode; "why these bags" savings-vs-naive explainer.

**Defer (v4.0+):**
- Real in-app checkout/payments (Stripe/PayPal), order-management backend/admin dashboard, user accounts/roles, server-side PII storage, live vendor inventory, sales-tax/VAT, browser-sent email. These are anti-features for this milestone; mode is a client preference, not an account; fulfillment is manual/offline.

### Architecture Approach

App.tsx is a **2,319-line god component** owning all state and chrome; Step1..4 are already pure, props-only presentational children, and the engine/ layer is already cleanly pure (no Preact/DOM/persistence, except export.ts's canvas). The template for v3.0 is the existing shared-primitive pattern: bagPlanner.packColor already feeds both the legend estimate and the cart, so they cannot diverge. v3.0 extends this by adding pure aggregators and gating presentation, keeping every new computation in engine/ and every new state/presentation atom in features/. See [ARCHITECTURE.md](ARCHITECTURE.md).

**Major components (additions):**
1. engine/pricing.ts [NEW]: pure computeQuote(parts, feePercent) to { subtotal, feePercent, feeAmount, total }; fee is a configurable input, Customer-mode only.
2. engine/orderPacket.ts [NEW]: pure assembleOrderPacket(input) producing a versioned, JSON-round-trippable OrderPacket (schemaVersion, canvas spec, bag list with bySize as Record, quote snapshot, review flags); the v4.0 ingest contract.
3. bagPlanner.ts [MOD]: add planOrderSupply aggregator (MOVE the App.tsx sortedMatches reduction into the pure engine) + explicit hasUnpricedSize flag replacing silent || 0.
4. features/mode/useAppMode.ts [NEW] + features/viewport/ViewportHud.tsx [NEW] + useWizard.ts [MOD]: persisted mode atom, in-canvas step guidance, and step-descriptor + mode parameterization.

### Critical Pitfalls

Several are live bugs read directly from source, not hypotheticals. See [PITFALLS.md](PITFALLS.md).

1. **$0-as-free in the cost minimizer (LIVE, PRICE-02):** priceDb[size] ?? 0 makes a missing price the global optimum, so the search self-selects phantom-free plans. Fix: treat missing price as Infinity/error; unknown vendor must not return 0.0; no $0 line may reach a customer quote.
2. **500-bag mis-tier (LIVE, PRICE-01):** defaultPacketCost has no 500 branch, so 500 falls into the 5000-bulk else. Fix: add the 500 branch; better, derive all bag-size logic from one canonical size list; test 500 lies between 200 and 1000.
3. **Variant-table integrity holes (LIVE, DATA-01):** empty mappings (471/798) silently drop a color; duplicate IDs (731==732, 781==782) point two DMC codes at the same product. Fix: DATA-01 test (unique-or-allow-listed IDs, no empty reachable mappings, full palette coverage); surface unmapped, never drop.
4. **Two UI reworks on one file at once:** merging the viewport wizard and the mode split produces an unreviewable diff and destroys the 178-test baseline. Fix: strictly stage; wizard (mode-agnostic) ships green first, then mode split as a capability-map layer.
5. **Mode leaks + persisted-state bleedover:** Customer must NOT see the raw price table, per-bag cost, affiliate ref/rfsn params, or the drill-cart link; and ProjectData (no mode/schemaVersion) can leak artist economics into a customer quote. Fix: a capability map rendered from one table + absence tests; add mode + schemaVersion with a default-to-artist migration.

## Implications for Roadmap

The four researchers independently converge on the same dependency-respecting sequence. This is the load-bearing recommendation and should anchor the roadmap.

### Phase 1: Vendor Cleanup (remove Prodigi)
**Rationale:** Smallest, isolated, tsc-guided warm-up that touches the vendor type union everywhere it will matter later; do first so the Customer canvas-spec only ever offers fulfillable vendors.
**Delivers:** prodigi removed from VENDOR_REGISTRY + narrowed 'lumaprints' | 'finerworks' union across checkout.ts/App.tsx/Step3Canvas.tsx/tests; a load-time migration remapping persisted selectedVendor: 'prodigi' to lumaprints.
**Addresses:** Vendor cleanup (table stakes).
**Avoids:** Pitfall 16 (dangling references + the $0 unknown-vendor fallback; must pair with the guard below).

### Phase 2: Pricing Accuracy (PRICE-01 / PRICE-02)
**Rationale:** Every downstream number (quote, fee, packet total) trusts this; do before any optimizer or quote work.
**Delivers:** 500-tier branch in defaultPacketCost; missing price to Infinity/flag not $0; unknown-vendor calculateCanvasCost returns null/throws; integer-cents money helper with a sum(line items) === total reconciliation test; tier-boundary tests around the < 0.05 epsilon.
**Avoids:** Pitfalls 6, 7, 8.

### Phase 3: Data Integrity (DATA-01)
**Rationale:** The customer packet must never ship a silently-dropped or wrong-product color.
**Delivers:** variants.integrity.test.ts (unique-or-allow-listed variant IDs, no empty reachable mappings, full palette coverage); runtime surfacing of unmapped colors (never dropped).
**Avoids:** Pitfalls 9, 15.

### Phase 4: Bag-Optimization Aggregator
**Rationale:** Now that prices are validated, MOVE the inline App.tsx reduction into a pure aggregator so legend, cart, and packet share byte-identical numbers.
**Delivers:** pure planOrderSupply(counts, shape, priceDb) to optimized bag list + totals + hasUnpricedSize; dye-lot <=800 invariant and known-tricky-count tests (1x2000 beats 1x1000+2x500).
**Uses:** existing exact bounded search in bagPlanner.ts (keep; never downgrade to greedy or add an LP solver).
**Avoids:** Pitfall 14.

### Phase 5: Service Fee to engine/pricing.ts
**Rationale:** Consumes Phases 2+4; the fee sits after subtotal, before total, Customer-mode only.
**Delivers:** pure computeQuote(parts, feePercent); configurable %; defined rounding rule so fee + subtotal reconcile.
**Avoids:** Pitfalls 6 (fee rounding), 10 (un-honorable quote; label as "estimate, confirmed at fulfillment").

### Phase 6: Order-Packet Assembler + Serializer
**Rationale:** Consumes Phases 1-5 + export; defined here as pure blocks while App.tsx is still the familiar wizard.
**Delivers:** versioned OrderPacket schema (schemaVersion, quote snapshot in cents, bySize as Record, CSPRNG packetId, review flags); PNG as a downloaded Blob not embedded in localStorage; no network/payments/auth.
**Avoids:** Pitfalls 11, 12, 13, 17.

### Phase 7: Viewport-Native Wizard Rework (Rework #1, standalone)
**Rationale:** With engine blocks pure and mode-agnostic, rework the presentation ONCE. Strictly mode-agnostic; both modes share it.
**Delivers:** useWizard extended to step descriptors; ViewportHud introduced alongside existing sidebars; step bodies strangler-migrated one at a time behind the existing *PanelCollapsed toggles; sidebar shells deleted last.
**Uses:** optional @preact/signals; native Popover/Anchor for HUD anchoring.
**Avoids:** Pitfalls 1, 2 (ship green: 178 tests + new wizard tests, before touching mode; preserve the <1ms SYMBOL-03 view switcher).

### Phase 8: Mode Split (Rework #2, capability-map layer, LAST UI phase)
**Rationale:** Rides ON TOP of the stabilized wizard as a thin selector; never branched into the old sidebar wizard.
**Delivers:** persisted useAppMode; useWizard parameterized by mode; a capability map (canEditPrices, canSeeAffiliate, canBuildDrillCart, showServiceFee, showOrderPacket) rendered from one auditable table; persistent mode indicator; mode + schemaVersion in ProjectData with carry-over rules; absence tests (Customer must not render the price table, affiliate ref/rfsn params, or the drill-cart link).
**Avoids:** Pitfalls 3, 4, 5.

### Phase Ordering Rationale
- **Correctness before UI churn:** the four pricing/data fixes (Phases 1-3) are pure, test-guarded, and unblock a trustworthy quote; the quote, fee, and packet all compound on them.
- **Pure blocks before presentation:** Phases 4-6 isolate every mode-relevant decision into pure functions, so the later mode split is a one-line selector at each seam, not a re-plumb.
- **Two UI reworks strictly separated:** the wizard (mode-agnostic) must ship green before the mode split rides on top; merging them forces the double-rework and loses the 178-test baseline.
- **Packet last:** it consumes final pricing/plan and a stable mode surface.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 7 (Viewport wizard):** the strangler migration of a 2,319-line god component is the highest-risk rework; /gsd-plan-phase --research-phase recommended to map the exact extraction seams (HUD, supply table, pricing panel) and preserve the SYMBOL-03 no-rerender invariant.
- **Phase 8 (Mode split):** the capability map + persisted-state migration + absence-test strategy warrant a research pass, especially the ProjectData schemaVersion/mode carry-over rules.

Phases with standard patterns (skip research-phase):
- **Phases 1-5:** well-scoped, code-grounded, pure-engine changes with existing test harnesses (bagPlanner.test.ts, checkout.test.ts); integration points already cited by file/function/line.
- **Phase 6:** the OrderPacket schema is fully specified in ARCHITECTURE.md; mostly execution.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Base stack fixed; additions verified against npm/MDN/Baseline data and a direct read of bagPlanner/export/checkout; near-zero new deps by design. |
| Features | MEDIUM-HIGH | UX patterns grounded in best-in-class creative tools + POD/RFQ norms; some Customer-flow specifics reasoned from adjacent industries (manual craft fulfillment is lightly standardized). Dependency/blocker notes are code-grounded. |
| Architecture | HIGH | Grounded in the actual v2.1 source with integration points cited by file/function/line; the shared-primitive pattern and strangler seam are verified, not inferred. |
| Pitfalls | HIGH | Several are live bugs read directly from source (PRICE-01/02, DATA-01 holes, $0 vendor fallback); sequencing recommendation is the load-bearing, cross-validated output. |

**Overall confidence:** HIGH

### Gaps to Address
- **Optimizer objective ambiguity:** the milestone says "fewest bags" but minCostBulk minimizes cost. Clarify during Phase 4 planning whether to minimize packets with cost as tiebreak (a one-line comparator change); a requirements decision, not a stack change.
- **Duplicate variant IDs (731/732, 781/782):** the DATA-01 test must adjudicate whether these are intended aliases (allow-list) or genuine data bugs (fix); resolve during Phase 3 with the data owner.
- **Canvas-cost interpolation readability:** linear interpolation can yield odd-looking quote figures; decide a customer-facing rounding rule during Phase 5 so totals read as trustworthy.
- **Single-file packet packaging:** whether a .zip (needs fflate) vs multi-file/self-contained-JSON deliverable is required is an unresolved UX decision for Phase 6; default to zero-dep unless a single-file email attachment is a hard requirement.
- **Privacy posture:** capturing customer orders begins to touch the "nothing leaves the browser" promise; carry an explicit privacy note (design stays local; the packet is deliberately shared for fulfillment) up to PROJECT.md during Phase 6.

## Sources

### Primary (HIGH confidence)
- GemPixel v2.1 source (direct read): src/App.tsx, src/engine/{bagPlanner,checkout,variants,projectStore,export,types}.ts, src/features/wizard/{useWizard.ts,steps/*}; live bugs, integration points, shared-primitive pattern cited by file/function/line.
- .planning/PROJECT.md + .planning/milestones/v2.1-REQUIREMENTS.md; v3.0 milestone goal, client-side scope boundary, deferred v4.0 backend/payments; PRICE-01/02, DATA-01, SEC-01, WR-02.
- npm / MDN / Baseline 2026: @preact/signals (2.9.2), fflate (0.8.3), Popover API, CSS Anchor Positioning, Web Share API.

### Secondary (MEDIUM confidence)
- Figma/Canva UX comparisons (contextual UI, canvas-centric interaction, dismiss-once coach marks).
- Print-on-demand / manual-fulfillment order handling (transparent pricing, order-detail packets, RFQ/quote flows): Order Desk, Shopify, Printful.
- Tour-library bundle benchmarks (cited only to deliberately reject Shepherd/Joyride/driver.js).
- Developer profile (.agents/GEMINI.md): regression-averse, dislikes overlapping states, prefers browser-native lightweight solutions.

### Tertiary (LOW confidence)
- Manual/offline fulfillment specifics for made-to-order craft products reasoned from adjacent industries (custom-commission shops) rather than a single canonical competitor.

---
*Research completed: 2026-07-12*
*Ready for roadmap: yes*
