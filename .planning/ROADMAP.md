# Roadmap: GemPixel

## Milestones

- ✅ **v2.0** — Phases 1–9 (shipped 2026-07-10): color engine → worker pipeline → canvas viewer → supply planning → partnerships → commission UX → symbols → multi-vendor export → viewport HUD.
- ✅ **v2.1 Post-Review Remediation** — Phases 10–14 (shipped 2026-07-12): active scope **Phases 11 + 13** (storage robustness + off-main-thread decode). Phases **10, 12, 14 deferred** — see Backlog.
- ⚠️ **v3.0 Two-Mode Viewport Experience (partial)** — Phases 15–19 (force-closed 2026-07-13 at 40%): shipped the correctness foundation only — **Phases 15 + 16** (trustworthy pricing/data + optimized supply plan & savings). Phases **17, 18, 19 never built** — the viewport-native wizard, the Customer/Artist mode split, and the service-fee/order-packet flow are deferred. See Backlog.

Full phase details for shipped milestones are archived in `milestones/v2.1-ROADMAP.md` and `milestones/v3.0-ROADMAP.md`.

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
- [ ] Phase 12: Supply Pricing Accuracy — **deferred** (PRICE-01, PRICE-02, DATA-01) — superseded by v3.0 Phase 15
- [x] Phase 13: Performance — Off-Main-Thread Decode (3/3) — 2026-07-12 (PERF-01)
- [ ] Phase 14: Security & Cleanup — **deferred** (SEC-01)

Pre-milestone: review blockers B1–B4 fixed via quick tasks (260711-wvv, 260711-x6p, 260712-05k, 260712-0io).

</details>

<details>
<summary>⚠️ v3.0 Two-Mode Viewport Experience — Phases 15–19 (FORCE-CLOSED 2026-07-13 at 40%; shipped 15 + 16 only)</summary>

**Shipped (the correctness foundation, all test-guarded):**

- [x] Phase 15: Trustworthy Pricing & Data Foundation (3/3) — 2026-07-13 (VENDOR-02, PRICE-01/02/03, DATA-01)
- [x] Phase 16: Optimized Supply Plan & Savings (4/4) — 2026-07-13 (BAG-01/02/03)

**Never built (force-closed as known gaps — carried to Backlog):**

- [ ] Phase 17: Service Fee & Customer Order Packet — **not started** (FEE-01, ORDER-01..05)
- [ ] Phase 18: Viewport-Native Wizard — **not started** (VIEWPORT-01..03)
- [ ] Phase 19: Two-Mode Split (Customer / Artist) — **not started** (MODE-01..04)

Full success criteria for all five phases preserved in `milestones/v3.0-ROADMAP.md`; requirements in `milestones/v3.0-REQUIREMENTS.md`.

</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1–9 (v2.0 suite) | v2.0 | 19/19 | Complete | 2026-07-07 → 07-10 |
| 11. Storage Robustness & Error Feedback | v2.1 | 3/3 | Complete | 2026-07-12 |
| 13. Performance — Off-Main-Thread Decode | v2.1 | 3/3 | Complete | 2026-07-12 |
| 10. Project Load Correctness | v2.1 | — | Deferred | — |
| 12. Supply Pricing Accuracy | v2.1 | — | Deferred (superseded by Phase 15) | — |
| 14. Security & Cleanup | v2.1 | — | Deferred | — |
| 15. Trustworthy Pricing & Data Foundation | v3.0 | 3/3 | Complete | 2026-07-13 |
| 16. Optimized Supply Plan & Savings | v3.0 | 4/4 | Complete | 2026-07-13 |
| 17. Service Fee & Customer Order Packet | v3.0 | — | Deferred (force-close gap) | — |
| 18. Viewport-Native Wizard | v3.0 | — | Deferred (force-close gap) | — |
| 19. Two-Mode Split (Customer / Artist) | v3.0 | — | Deferred (force-close gap) | — |

## Backlog

Deferred work to be re-scoped/rewritten in a future milestone (start with `/gsd-new-milestone`). Original success criteria are preserved in the milestone archives noted below.

**From v3.0 (force-closed 2026-07-13 — the milestone's headline scope, never built).** Success criteria in `milestones/v3.0-ROADMAP.md`; requirements in `milestones/v3.0-REQUIREMENTS.md`:

- **Phase 17 — Service Fee & Customer Order Packet:** % service fee as its own itemized line + a versioned, self-contained, JSON-round-trippable customer order packet (design PNG, canvas spec, optimized gem-bag list, itemized totals in integer cents, no PII) with review → confirmation (unique order ref) → threshold auto-flagging → client-side download/share handoff, schema designed to feed the v4.0 backend unchanged. (FEE-01, ORDER-01..05)
- **Phase 18 — Viewport-Native Wizard (UI rework #1, must ship green):** most-used controls as contextual in-viewport surfaces extending the Phase 9 HUD; sidebars + page-flip wizard progressively retired with no regression (178-test baseline + <1ms Grid/Symbol/Photo switcher preserved); first-run dismissible coach-mark tour via browser-native anchoring (no tour library). Strictly mode-agnostic. (VIEWPORT-01..03)
- **Phase 19 — Two-Mode Split (Customer / Artist) (UI rework #2, last):** thin capability-map layer over the stabilized wizard; persisted/reversible mode choice preserving the design; Artist sees cost table + affiliate links + drill cart, Customer sees guided buy flow + service fee + order packet and never the raw price table / affiliate params / drill-cart link (absence tests); URL param launches a mode directly; saved projects carry `mode` + `schemaVersion` with pre-v3.0 → Artist carry-over so artist economics never leak into a customer quote. (MODE-01..04)

**From v2.1 (still deferred).** Original success criteria in `milestones/v2.1-ROADMAP.md`; requirements in `milestones/v2.1-REQUIREMENTS.md`:

- **Phase 10 — Project Load Correctness:** a restored saved project keeps its saved canvas price (not the auto-recomputed vendor cost) and renders the exact saved grid regardless of current substitution/smoothing toggles. (LOAD-01 review W1, LOAD-02 review W2)
- **Phase 14 — Security & Cleanup:** validate compiled partner canvas URLs against an http/https allowlist (block `javascript:`/`data:`), and wire-up-or-remove the unfinished `compileCanvasPartnerUrl` path. (SEC-01 W10, IN-02)
