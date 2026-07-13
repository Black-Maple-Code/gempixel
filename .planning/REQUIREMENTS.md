# Requirements: GemPixel

**Defined:** 2026-07-12
**Milestone:** v3.0 Two-Mode Viewport Experience
**Core Value:** Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.

## Milestone v3.0 Requirements

Committed scope for v3.0. Each maps to exactly one roadmap phase. Grounded in `.planning/research/SUMMARY.md`. **PRICE-01, PRICE-02, and DATA-01 are carried in from the deferred v2.1 set** because the customer quote, service fee, and order packet all depend on trustworthy pricing.

### Vendor Cleanup

- [x] **VENDOR-02**: Prodigi is removed as a canvas vendor — only Lumaprints and FinerWorks are selectable — and a saved project that referenced Prodigi migrates to a valid vendor without ever showing a $0 canvas (unknown-vendor cost is guarded, not silently 0).

### Pricing Accuracy

- [x] **PRICE-01**: The per-packet cost shown for a 500-count drill bag is correct and priced at its own tier, not a larger or nonexistent tier. *(carried from v2.1; live bug: `defaultPacketCost` has no 500 branch)*
- [x] **PRICE-02**: An unpriced bag size is never treated as free ($0); the cost/optimizer never selects a size because its price is missing (missing price is excluded or flagged, never self-selected as the cheapest). *(carried from v2.1; live bug: `priceDb[size] ?? 0`)*
- [x] **PRICE-03**: All money math uses integer cents and reconciles — the sum of the itemized line items always equals the displayed total, and no customer-facing $0 line ever appears for a real billable item.

### Data Integrity

- [x] **DATA-01**: An automated integrity test verifies the drill-variant table — unique (or explicitly allow-listed) variant IDs, no empty reachable size mappings, and every palette DMC color has a mapping; an unmapped color is surfaced to the user, never silently dropped. *(carried from v2.1; known holes: empty mappings 471/798, duplicate IDs 731/732, 781/782 to adjudicate)*

### Supply Optimization

- [x] **BAG-01**: The gem-bag optimizer minimizes the **number of bags** while respecting the dye-lot consistency rule, using total cost as the tiebreaker.
- [x] **BAG-02**: The user can see the optimized supply plan — per-color bags, total bag count, and total cost — with a plain-language explanation of the dye-lot "why".
- [x] **BAG-03**: The user can see how much the optimized plan saves versus a naive per-color purchase (the "why these bags" savings explainer). *(differentiator)*

### Service Fee

- [ ] **FEE-01**: A configurable percent-based service/handling fee is applied to Customer orders and shown as its own itemized line (percent and dollar amount), disclosed before the order is submitted. Ships configurable with a placeholder default set before launch.

### Customer Order Flow

- [ ] **ORDER-01**: In Customer mode, the user can turn a finished design into a structured order packet containing the design PNG, canvas spec, optimized gem-bag list, itemized totals, and the service fee.
- [ ] **ORDER-02**: Before submitting, the user reviews an itemized order summary; after submitting, they receive a saved confirmation carrying a unique order reference ID.
- [ ] **ORDER-03**: An order that exceeds any configurable threshold — total drill count, dollar total, color count, or physical canvas size — is automatically flagged for human review with "we'll confirm with you" messaging.
- [ ] **ORDER-04**: The order packet is a versioned, self-contained, JSON-round-trippable document whose schema is designed to be ingested unchanged by the future v4.0 order-management backend (quote snapshot in integer cents; no PII transmitted anywhere this milestone).
- [ ] **ORDER-05**: The user can hand off the order packet entirely client-side — download by default, with a share/email fallback — and the design PNG is delivered as a file rather than embedded in localStorage.

### Viewport-Native Wizard

- [ ] **VIEWPORT-01**: The most-used design controls are available as contextual, in-viewport surfaces (extending the Phase 9 HUD), so the user can complete core work without opening the sidebars.
- [ ] **VIEWPORT-02**: The guided flow is driven from the viewport (step guidance appears in-context) and the expand/collapse sidebars + page-flip wizard are progressively retired, with no regression to existing behavior (the 178-test baseline and the <1ms Grid/Symbol/Photo view switcher are preserved).
- [ ] **VIEWPORT-03**: A first-run, dismissible coach-mark tour introduces new users to the viewport controls, using browser-native anchoring (no tour library). *(differentiator)*

### Mode Split

- [ ] **MODE-01**: The user can choose between Customer and Artist mode; the choice is persisted, reversible, and preserves the current design when switched.
- [ ] **MODE-02**: Each mode exposes only its capabilities via a single capability map — Artist sees the editable cost table, affiliate links, and the drill cart; Customer sees the guided buy flow, service fee, and order packet and never sees affiliate parameters, the raw price table, or the drill-cart link (verified by absence tests, not just presence tests).
- [ ] **MODE-03**: A URL parameter can launch the app directly into Customer or Artist mode. *(differentiator)*
- [ ] **MODE-04**: Saved projects carry a `mode` and `schemaVersion`; loading a pre-v3.0 project defaults to Artist mode with a defined carry-over rule, so artist-only economics never leak into a customer quote.

## Future Requirements (Deferred)

Acknowledged but not in the v3.0 roadmap.

### v4.0 — Fulfillment Backend (the order packet is designed to feed this)

- **BACKEND-01**: Order-management backend + admin dashboard — orders queue for review, gem counts are verified, and design PNGs are pushed to the printer.
- **PAY-01**: Automated payment processing for Customer orders (manual/offline in v3.0).
- **FULFILL-01**: Direct printer/vendor API fulfillment (Lumaprints / FinerWorks / DiamondDrillsUSA).

### Carried from v2.1 (still deferred)

- **LOAD-01**: A reloaded saved project preserves its saved canvas price (not overwritten by the automatic recompute).
- **LOAD-02**: A reloaded saved project renders the grid it was saved with, regardless of current substitution/smoothing toggles.
- **SEC-01**: A partner canvas URL is validated against an http/https allowlist before it can be opened, and the unfinished partner-link path is wired up safely or removed.

## Out of Scope

Explicitly excluded from v3.0. Anti-features surfaced by research are documented here to prevent scope creep.

| Feature | Reason |
|---------|--------|
| In-app / automated payment processing (Stripe, PayPal) | Customer purchases are manual/offline this milestone; automated payments are v4.0. |
| Order-management backend, admin dashboard, server-side order storage | Frontend-first; the v3.0 order packet is the forward-compatible contract the v4.0 backend will ingest. |
| User accounts / roles / auth | Mode is a persisted client preference, not an account. Keeps the tool private and lightweight. |
| Server-side PII storage or browser-sent email (EmailJS/SMTP) | Any embedded email key is effectively a backend; deferred to v4.0. Packet delivery stays client-side (download/share). |
| Live vendor inventory, sales-tax/VAT calculation | Out of scope for a quote-based manual flow; adds backend coupling. |
| Heavy tour libraries (Shepherd/Joyride/intro.js), ILP/LP solver, full React | Bundle-weight and architectural avoidances already decided; coach-marks are browser-native and the bag optimizer is an exact bounded search. |
| AI-based color enhancement or style generation | Stick to clean mathematical color matching (standing exclusion). |

## Traceability

Final phase mapping (phases 15–19, continuing from the previous milestone's last phase, 14). Finalized by the roadmapper 2026-07-12. Ordering respects the research's load-bearing dependency sequence: correctness → optimized supply plan → service fee + order packet → viewport wizard → mode split (last). The two UI reworks (Phase 18, Phase 19) are separate and never merged.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VENDOR-02 | Phase 15 — Trustworthy Pricing & Data Foundation | Complete |
| PRICE-01 | Phase 15 — Trustworthy Pricing & Data Foundation | Complete |
| PRICE-02 | Phase 15 — Trustworthy Pricing & Data Foundation | Complete |
| PRICE-03 | Phase 15 — Trustworthy Pricing & Data Foundation | Complete |
| DATA-01 | Phase 15 — Trustworthy Pricing & Data Foundation | Complete |
| BAG-01 | Phase 16 — Optimized Supply Plan & Savings | Complete |
| BAG-02 | Phase 16 — Optimized Supply Plan & Savings | Complete |
| BAG-03 | Phase 16 — Optimized Supply Plan & Savings | Complete |
| FEE-01 | Phase 17 — Service Fee & Customer Order Packet | Pending |
| ORDER-01 | Phase 17 — Service Fee & Customer Order Packet | Pending |
| ORDER-02 | Phase 17 — Service Fee & Customer Order Packet | Pending |
| ORDER-03 | Phase 17 — Service Fee & Customer Order Packet | Pending |
| ORDER-04 | Phase 17 — Service Fee & Customer Order Packet | Pending |
| ORDER-05 | Phase 17 — Service Fee & Customer Order Packet | Pending |
| VIEWPORT-01 | Phase 18 — Viewport-Native Wizard | Pending |
| VIEWPORT-02 | Phase 18 — Viewport-Native Wizard | Pending |
| VIEWPORT-03 | Phase 18 — Viewport-Native Wizard | Pending |
| MODE-01 | Phase 19 — Two-Mode Split (Customer / Artist) | Pending |
| MODE-02 | Phase 19 — Two-Mode Split (Customer / Artist) | Pending |
| MODE-03 | Phase 19 — Two-Mode Split (Customer / Artist) | Pending |
| MODE-04 | Phase 19 — Two-Mode Split (Customer / Artist) | Pending |

**Coverage:**

- Milestone v3.0 requirements: 21 total
- Mapped to phases: 21 (final)
- Unmapped: 0 ✓

**Notes on mode-conditional UI (each requirement still maps to exactly one phase):**

- FEE-01 and ORDER-01..05 build their pure engine + base UI in **Phase 17** (assembled while the app is still the familiar wizard, before the UI reworks). Their **Customer-only** exposure/gating is wired during **Phase 19** (the capability map), but the requirements are owned by Phase 17.
- BAG-02/BAG-03 (surfacing the optimizer + savings explainer) are UI mapped to **Phase 16** alongside the BAG-01 engine aggregator.

---
*Requirements defined: 2026-07-12 — Milestone v3.0 Two-Mode Viewport Experience. Traceability finalized 2026-07-12 (phases 15–19).*
