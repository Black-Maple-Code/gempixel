# Requirements: GemPixel

**Defined:** 2026-07-13
**Milestone:** v4.0 Canvas-First Redesign
**Core Value:** Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.

## Milestone v4.0 Requirements

Committed scope for v4.0 — a **frontend-only, 100% client-side** rebuild of the customer experience as a canvas-first, no-side-menus 4-step flow in the new Atelier light design system, recreated faithfully in the existing Preact/Vite/Tailwind-v4 codebase from the high-fidelity design handoff. Grounded in `.planning/research/SUMMARY.md`. The fulfillment backend (ops console, Lumaprints API submission, payments, server-side render, shipment tracking, sourcing) is **deferred to v5.0**.

### Design System (Atelier, light-only)

- [ ] **DESIGN-01**: The app renders in the Atelier light theme only — dark mode is fully retired (the toggle, the persisted `gempixel_theme` key, the `[data-theme]` CSS, and the canvas viewer's theme dependency are all removed) so a returning user never sees a half-dark UI.
- [ ] **DESIGN-02**: The UI is built from the Atelier design tokens (palette, radii, shadows, 8px spacing) and self-hosted webfonts (Newsreader / Archivo / JetBrains Mono) with no external font requests and no font-driven layout shift (FOUT/CLS).

### Canvas-First Shell & Navigation

- [ ] **SHELL-01**: A horizontal 4-step bar (Upload → Refine → Supplies → Order) is the *only* navigator — no sidebars, hamburger, or page-flip wizard; the user advances via the primary CTA and returns via completed steps.
- [ ] **SHELL-02**: The flow is validation-gated (no Refine without an uploaded image; no Supplies without a computed match) and every step's controls are surfaced inline in the flow, never in a drawer.

### Upload

- [ ] **UPLOAD-01**: The user starts a project by dragging/dropping or browsing for a photo, and can reopen a recent project from an inline list.

### Refine (the keystone screen)

- [ ] **REFINE-01**: The user picks a canvas size from cards that each show the grid dimensions, the **true physical inches derived from the 2.5mm/dot (10 dots/inch) density** (never a hard-coded mock label), and a live drill count; changing size re-renders the preview and updates counts live.
- [ ] **REFINE-02**: Preset sizes are presented as recommendations, and the user can order a **custom canvas size** (cols/inches, with sane clamps) when a preset doesn't fit — since printed legends may require a varying canvas size.
- [ ] **REFINE-03**: An edge-cleanup control (Off / Light / Med / Strong → smoothing strength 0–3) re-renders the chart live to smooth ragged edges.
- [ ] **REFINE-04**: A color-count slider whose **maximum equals the real detected color count** lets the user reduce colors; lowering it deterministically merges rare one-off drills into the CIEDE2000-nearest already-used shade, keeping the legend, cart, and quote in sync with no visible change to the picture (post-process, no worker re-run per tick).
- [ ] **REFINE-05**: Advanced controls — color kit (100 / 200 / all), color exclusion, and drill shape (square / round) — default sensibly (kit = all, shape = square) and are available under an "Advanced" disclosure in Refine rather than as their own step.

### Supplies

- [ ] **SUPPLIES-01**: The Supplies screen shows the chart legend / supply table (symbol · swatch · DMC code + name · drills incl. +10% safety · bags) computed from the shared `planOrderSupply` engine, plus the dye-lot "why these bags?" explanation.
- [ ] **SUPPLIES-02**: An inline order-summary panel shows the itemized quote (total drills, bags, canvas print + size, shipping, tax estimate, total) sourced from the single-source quote selector so it can never diverge from the Order screen.

### Accurate Quoting

- [ ] **QUOTE-01**: Every physical-size and inch figure shown anywhere in the app is derived from grid dimensions through one density helper (2.5mm/dot) — no hard-coded inch labels from the mock.
- [ ] **QUOTE-02**: The customer quote is computed in exactly one place in integer cents (drills + canvas + shipping + tax estimate) via `money.ts`, and the Supplies "Est. total", the Order total, and the sum of the itemized line items are always exactly equal.
- [ ] **QUOTE-03**: Tax and any curated vendor/shipping rate are clearly labeled as **estimates** with a dated "rates as of" provenance; no figure is presented as a finalized charge.

### Order (confirm & client-side handoff)

- [ ] **ORDER-01**: The Order screen presents an auto-filled, **locked** print spec (Rolled Canvas fixed, size from grid, finish) plus a finish selection and a ship-to address and the itemized quote — nothing GemPixel already resolved has to be re-entered.
- [ ] **ORDER-02**: The user completes the flow via an honest client-side handoff — reviewing the summary and **downloading a versioned, self-contained order packet** (design/chart, canvas spec, optimized gem-bag list, integer-cents quote snapshot; schema forward-compatible with the future v5.0 backend) — with no implied payment and no fake receipt (real payment + lab submission are v5.0).

### Mobile & Touch

- [ ] **MOBILE-01**: The same 4-step journey works in a single portrait column on a phone (≈300px wide), with every control inline (never a drawer).
- [ ] **MOBILE-02**: The user can zoom and pan the chart on touch devices (pinch-to-zoom + on-screen zoom controls) without the page scrolling (`touch-action: none` on the canvas).

## Future Requirements (Deferred)

Acknowledged but not in the v4.0 roadmap.

### v5.0 — Fulfillment Backend (the order packet is designed to feed this)

- **BACKEND-01**: Backend ops console — orders queue, order detail (three artifacts + print spec + gem quantities), sourcing aggregation → provider POs (design handoff Storyboard C).
- **LAB-01**: Lumaprints API order submission (GemPixel as merchant of record) + real payment processing + billing/address on file.
- **RENDER-01**: Server-side chart rendering (PNG print + PDF legend) so "what shipped = what bought"; asset storage by URL reference.
- **TRACK-01**: Two independent shipment tracks per order (canvas via lab + drills via gem provider) via webhooks/polling.
- **RATES-01**: Live vendor rate APIs (Lumaprints / FinerWorks) replacing the curated v4.0 cost table.

### v4.x — Redesign follow-ons

- **REFINE-06**: Tunable Delta-E hard-guard threshold on color merges (v4.0 ships a fixed conservative guard).
- **ORDER-03**: Richer finish/canvas visualization proof on the Order screen.

### Carried from earlier milestones (still deferred)

- **LOAD-01 / LOAD-02**: A reloaded saved project preserves its saved canvas price and renders the grid it was saved with (v2.1).
- **SEC-01**: Partner canvas URL validated against an http/https allowlist; unfinished partner-link path wired up or removed (v2.1).

## Out of Scope

Explicitly excluded from v4.0.

| Feature | Reason |
|---------|--------|
| Backend / server-side processing | v4.0 stays 100% client-side; the fulfillment backend + admin console is a planned **v5.0** capability. |
| Automated payment processing / real lab order submission | The v4.0 Order step is a client-side confirm/handoff; payments + Lumaprints API submission are v5.0. |
| Server-side chart rendering, asset storage, shipment tracking, sourcing POs | Design handoff Storyboard C + server integrations — v5.0. |
| Live vendor inventory / rate APIs, real sales-tax/VAT calculation | v4.0 quoting uses a curated cost table with a labeled tax estimate, not live APIs. |
| Dark mode | Retired; ship the Atelier light theme only. |
| A separate "Artist" mode / two-mode split | v4.0 is customer-first; the v3.0 mode-split scope is superseded, not resumed. |
| Heavy UI / slider / font-loader / PDF libraries | Browser-native + hand-built primitives per the standing architectural avoidances; self-hosted `@fontsource` only. |
| AI-based color enhancement or style generation | Standing exclusion — clean mathematical color matching only. |

## Traceability

Phase mapping assigned by the roadmapper (`/gsd-new-milestone` → roadmap step, 2026-07-13). Phase numbering continues from the previous milestone (v3.0 ended at Phase 19 → v4.0 spans Phases 20–25). All 19 v4.0 requirements are mapped to exactly one phase (100% coverage); Phases 21 (shared UI primitives) and 25 (strangler cleanup) are infrastructure/cleanup phases that carry no REQ-ID by design.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DESIGN-01 | Phase 20 | Pending |
| DESIGN-02 | Phase 20 | Pending |
| SHELL-01 | Phase 20 | Pending |
| SHELL-02 | Phase 20 | Pending |
| QUOTE-01 | Phase 22 | Pending |
| QUOTE-02 | Phase 22 | Pending |
| QUOTE-03 | Phase 22 | Pending |
| UPLOAD-01 | Phase 23 | Pending |
| REFINE-01 | Phase 23 | Pending |
| REFINE-02 | Phase 23 | Pending |
| REFINE-03 | Phase 23 | Pending |
| REFINE-04 | Phase 23 | Pending |
| REFINE-05 | Phase 23 | Pending |
| SUPPLIES-01 | Phase 23 | Pending |
| SUPPLIES-02 | Phase 23 | Pending |
| ORDER-01 | Phase 23 | Pending |
| ORDER-02 | Phase 23 | Pending |
| MOBILE-01 | Phase 24 | Pending |
| MOBILE-02 | Phase 24 | Pending |

**Coverage:**

- Milestone v4.0 requirements: 19 total
- Mapped to phases: 19 (100%)
- Unmapped: 0
- Phases carrying no REQ-ID (infrastructure/cleanup, by design): Phase 21 (Shared UI Primitives), Phase 25 (Retire Legacy Steps + Cleanup)

**Notes:**

- The two marquee Refine transforms already exist in the engine (edge cleanup = `smoothing.ts::smoothMatches`; drill-merge = `color.ts::substituteLowCountColors`); REFINE-03/04 are mostly rewiring + one additive `reduceToColorCount` (target-N vs the existing threshold). The additive engine work (`detectedColorCount`, `reduceToColorCount`) lands isolated in **Phase 22** (engine-only commits); the UI wiring for REFINE-04 lands in **Phase 23**.
- QUOTE-01/02 and SUPPLIES-02 share one integer-cents `engine/quote.ts` selector (extending the `planOrderSupply` single-source pattern) so no total can diverge — the selector is built in **Phase 22** and consumed by the Supplies + Order screens in **Phase 23**.
- The strangler discipline (App.tsx stays state owner, pure screen children, `engine/*` never diffs inside a UI phase, 240+ tests green each commit) is a build constraint honored in the phase ordering — engine changes isolated to Phase 22, one screen swapped in at a time in Phase 23, cleanup last in Phase 25. It directly prevents the v3.0 "two big UI reworks at once → force-closed" failure.

---
*Requirements defined: 2026-07-13 — Milestone v4.0 Canvas-First Redesign. Frontend-only; backend deferred to v5.0. Grounded in `.planning/research/SUMMARY.md`. Phase mapping assigned 2026-07-13 (Phases 20–25).*
