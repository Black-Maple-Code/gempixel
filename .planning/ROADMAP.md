# Roadmap: GemPixel

## Milestones

- ✅ **v2.0** — Phases 1–9 (shipped 2026-07-10): color engine → worker pipeline → canvas viewer → supply planning → partnerships → commission UX → symbols → multi-vendor export → viewport HUD.
- ✅ **v2.1 Post-Review Remediation** — Phases 10–14 (shipped 2026-07-12): active scope **Phases 11 + 13** (storage robustness + off-main-thread decode). Phases **10, 12, 14 deferred** — see Backlog.

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

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1–9 (v2.0 suite) | v2.0 | 19/19 | Complete | 2026-07-07 → 07-10 |
| 11. Storage Robustness & Error Feedback | v2.1 | 3/3 | Complete | 2026-07-12 |
| 13. Performance — Off-Main-Thread Decode | v2.1 | 3/3 | Complete | 2026-07-12 |
| 10. Project Load Correctness | v2.1 | — | Deferred | — |
| 12. Supply Pricing Accuracy | v2.1 | — | Deferred | — |
| 14. Security & Cleanup | v2.1 | — | Deferred | — |

## Backlog

Deferred from v2.1 — to be re-scoped/rewritten in a future milestone (start with `/gsd-new-milestone`). Original success criteria are preserved in `milestones/v2.1-ROADMAP.md`; original requirements in `milestones/v2.1-REQUIREMENTS.md`.

- **Phase 10 — Project Load Correctness:** a restored saved project keeps its saved canvas price (not the auto-recomputed vendor cost) and renders the exact saved grid regardless of current substitution/smoothing toggles. (LOAD-01 review W1, LOAD-02 review W2)
- **Phase 12 — Supply Pricing Accuracy:** correct 500-count bag per-packet cost, never treat an unpriced size as free ($0), and add a drill-variant integrity test. (PRICE-01 W6, PRICE-02 W7, DATA-01 IN-03)
- **Phase 14 — Security & Cleanup:** validate compiled partner canvas URLs against an http/https allowlist (block `javascript:`/`data:`), and wire-up-or-remove the unfinished `compileCanvasPartnerUrl` path. (SEC-01 W10, IN-02)
