# GemPixel

## What This Is

GemPixel is a client-side utility web application designed for diamond painting/gem art artists. It takes a user-loaded picture and converts it into a grid representation showing how it will look as gem art, matching the image colors to standard Art Dot/DMC manufacturer color indexes (100 and 200 color kits) and custom sub-palettes. It serves as a supply planning tool that outputs the exact color codes and dot counts needed for the canvas.

## Core Value

Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.

## Current Milestone: v3.0 Two-Mode Viewport Experience — ⚠️ FORCE-CLOSED 2026-07-13 (partial, 40%)

**Status:** Force-closed at 40% (2 of 5 phases). Shipped only the correctness foundation — **Phase 15** (trustworthy pricing & data) and **Phase 16** (optimized supply plan & savings). The two namesake capabilities — the **viewport-native wizard** and the **Customer/Artist mode split** — and the **service-fee + customer order packet** flow were never built. Phases 17/18/19 (FEE-01, ORDER-01..05, VIEWPORT-01..03, MODE-01..04) are carried to the Backlog for a future milestone. See `.planning/MILESTONES.md` → v3.0 Known Gaps.

**Original goal (unmet):** Move GemPixel into a viewport-native, guided experience with two tailored paths — self-serve **Artist** and done-for-you **Customer** — backed by trustworthy pricing and a fulfillment-ready customer order flow.

**Target features:**
- **Viewport-native interactive wizard** — the app lives in the viewport; contextual options and guidance surface in-canvas as needed (extending the Phase 9 HUD), progressively phasing out expand/collapse sidebars and the page-flipping wizard.
- **Mode selector + two-mode UX** — Customer vs Artist, each a tailored path through the viewport wizard.
- **Artist mode** — refined self-serve: design → order own canvas (Lumaprints / FinerWorks) + drill cart to diamonddrillsusa.com.
- **Vendor cleanup** — remove Prodigi as a canvas option; keep Lumaprints + FinerWorks.
- **Price accuracy** — correct 500-bag cost, no $0 unpriced sizes, and a drill-variant integrity test (pulls in deferred PRICE-01/02, DATA-01) so quotes and fees are trustworthy.
- **Percent-based service fee** — customer quote includes a configurable % fee for quality/handling.
- **Customer purchase flow** — "Buy" captures a structured order packet (PNG + optimized gem-bag list + canvas spec + fee + totals) for manual/offline fulfillment; large orders flagged for human review.
- **Gem-bag purchase optimization** — fewest bags while preserving dye-lot color consistency.

**Scope boundary:** Frontend-first and still client-side. Payments are manual/offline this milestone. The customer order packet is designed to feed a real order-management **backend + admin dashboard**, which — together with automated payments and direct printer/vendor API fulfillment — is **deferred to v4.0**. This milestone intentionally begins crossing the historical "client-side only / no backend" constraint (see Out of Scope).

## Requirements

### Validated

- Map each pixel/grid cell to the nearest available DMC color from selected color indexes using RGB/Lab color distance formulas (Validated in Phase 01: Core Engine & Color Mathematics).
- Support Art Dot 100-color and 200-color manufacturer indexes (Validated in Phase 01: Core Engine & Color Mathematics).
- Load local images (JPEG, PNG, etc.) in-browser (Validated in Phase 02: Client-side Engine & Worker Architecture).
- Specify canvas size using two modes: direct grid dimensions (rows/cols) or physical dimensions (cm/inches) with standard density calculations (2.5mm per dot, 10 dots/inch) (Validated in Phase 02: Client-side Engine & Worker Architecture).
- Enable visual inspection of the grid with zoom/pan and custom styling (square vs. round drill representation) (Validated in Phase 03: Canvas Viewer & Zoom/Pan Interaction).
- Render a pixelated grid representation of the image (Validated in Phase 04: Supply Planning, Customization & Exports).
- Support custom sub-palette selection/filtering (allowing the artist to include or exclude specific colors from matching) (Validated in Phase 04: Supply Planning, Customization & Exports).
- Display a supply specification report showing required color codes, names, and exact quantities of dots needed (Validated in Phase 04: Supply Planning, Customization & Exports).

**Milestone v2.0 (shipped, Phases 5–9):**
- Direct Canvas Ordering Partnership — order custom sticky-glue canvases matching the project layout from partnered suppliers (Validated in Phase 5).
- Custom Drill Cart Checkout — compile affiliate/purchase cart links to Diamond Drills USA for the optimized drill bags (Validated in Phase 5).
- Streamlined Commission Journey — 4-step wizard + local commission workspace (Validated in Phase 6).
- Symbol-overlay canvas, margin legends, multi-vendor PNG export, and viewport HUD navigation (Validated in Phases 7–9).

**Milestone v2.1 (shipped 2026-07-12, Phases 11 + 13):**
- Storage robustness & error feedback — app survives blocked/private-mode storage, persisted settings centralized behind one `usePersistentState` helper, and save/download/checkout failures surfaced in a dismissible banner (Validated in Phase 11, STORE-01/02, ERR-01).
- Off-main-thread image decode — the resample + `getImageData` readback + box-sampling now run in the matcher Web Worker via a zero-copy `ImageBitmap` transfer, keeping the UI responsive on large images with bit-identical output (Validated in Phase 13, PERF-01).

**Milestone v3.0 Two-Mode Viewport Experience (force-closed partial 2026-07-13, Phases 15–16 shipped):**
- Trustworthy pricing & data foundation — Prodigi removed and the unknown-vendor canvas cost guarded so it can never be a silent $0 (`calculateCanvasCost` returns `number | null`; a load-time `normalizeVendor` migrates legacy/tampered `selectedVendor`); the missing 500-bag tier added, the cost minimizer no longer self-selects an unpriced $0-phantom size (missing price → `Infinity`, unplannable colors flagged/surfaced), and itemized line items reconcile exactly to the displayed total via a canonical integer-cents `money.ts` (epsilon-safe round-half-up); a DATA-01 drill-variant integrity test ratchets against duplicate-ID / empty-mapping drift and unmapped grid colors are surfaced at runtime rather than silently dropped (Validated in Phase 15, VENDOR-02 + PRICE-01/02/03 + DATA-01).
- Optimized supply plan & savings — `minCostBulk` packs each bulk color into the fewest bags within a locked overshoot cap (deterministic order, legend/cart can't diverge); `naiveColorPack` + the shared `planOrderSupply` aggregator produce one reconciled integer-cents plan (optimized rows + totals + naive baseline + a clamped-≥0 savings figure); the optimized fewest-bags plan is the sole displayed plan (the `optimizeBagsCost` toggle and fixed-size controls retired), with an always-on savings headline, an a11y "Why these bags?" dye-lot explainer, and an isolated print-only Supply Plan Report (Validated in Phase 16, BAG-01/02/03).

### Active

**No active milestone.** v3.0 was force-closed partial on 2026-07-13; the next milestone starts via `/gsd-new-milestone`.

**Deferred from v3.0 (force-close gaps — the milestone's headline scope, never built; requirements preserved in `milestones/v3.0-REQUIREMENTS.md`):**
- [ ] Service Fee & Customer Order Packet — % service fee line + versioned self-contained JSON order packet with review/confirmation/threshold-flagging/client-side handoff (FEE-01, ORDER-01..05).
- [ ] Viewport-Native Wizard — contextual in-viewport controls replacing sidebars + page-flip flow, ships green, mode-agnostic (VIEWPORT-01..03).
- [ ] Two-Mode Split (Customer / Artist) — capability-map layer giving each mode a tailored path with no leakage (MODE-01..04).

**Still deferred to a future milestone** (roadmapped under v2.1, never built — requirements preserved in `milestones/v2.1-REQUIREMENTS.md`):
- [ ] Project Load Correctness — restored projects keep their saved price and grid (LOAD-01, LOAD-02).
- [ ] Security & Cleanup — validate the partner canvas URL against an http/https allowlist and wire-up-or-remove the unfinished partner-link path (SEC-01).

**Deferred to v4.0** (target for the customer order packet built in v3.0):
- [ ] Order-management backend + admin dashboard — order queue, gem-count review, push PNG to printer.
- [ ] Automated payments (customer flow is manual/offline in v3.0).
- [ ] Direct printer/vendor API fulfillment.

### Out of Scope

- [ ] Server-side processing or user accounts — kept the utility lightweight and client-side through v2.1. **Being revisited in v3.0/v4.0:** the Customer mode introduces done-for-you fulfillment, so a server-side order-management backend is now a planned v4.0 capability. v3.0 stays client-side (order-packet generation only).
- [ ] AI-based color enhancement or style generation — stick to clean mathematical color matching.
- [ ] In-app / automated payment processing — customer purchases are handled manually/offline in v3.0; automated payments deferred to v4.0.

## Context

The target user is a professional or hobbyist gem art artist who takes custom commissions. Currently, there is no simple tool to map custom image colors to the specific Art Dot kits (100 and 200 colors). A key pain point is estimating the exact number of gem drills needed before starting a project.

**Current state (v3.0 partial, 2026-07-13):** Preact 10 + Vite 6 + TypeScript (strict) + Tailwind v4; `culori` color science; native Web Worker for CIEDE2000 matching + off-main-thread image decode; persistence via a guarded `localStorage` helper. 100% client-side, no backend. A canonical integer-cents `engine/money.ts` now backs all pricing. Shipped to `Black-Maple-Code/gempixel` master; first prod deploy tagged `0.1.0` (gem-pixel.com), grid-symbol redesign committed (2978605..db586e3, deploy pending). Known tech debt carried forward: Phases 07/08/09 lack formal UAT sign-off; Phases 10/14 deferred from v2.1; **v3.0 force-closed at 40% — Phases 17/18/19 (service fee + order packet, viewport wizard, mode split) never built.**

## Constraints

- **Tech Stack**: Vanilla HTML/JavaScript/CSS or a lightweight framework running entirely in-browser.
- **Color Accuracy**: Colors must map to the standard DMC color code system since Art Dot matches DMC numbers.
- **Privacy & Speed**: Run completely in the browser; images should never upload to a server.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side processing | Fast, secure, zero server maintenance costs. | — Ingested and scaled entirely client-side (Phase 02) |
| Multi-resizing modes | Supports both canvas purchasing (cm/inches) and detailed planning (rows/cols). | — Physical size to dot formulas implemented (Phase 02) |
| Art Dot Kit Indexing | Direct mapping to 100/200 sets to match user's physical inventory. | — Compiled statically (Phase 01) |
| Color space conversions & distance | Use manually registered Culori modes, sRGB -> XYZ -> Lab, 24-bit bitwise cache, and CIEDE2000 distance. | — Implemented in color.ts (Phase 01) |
| Sizing Mapping Mode | Crop/Cover mode centered on image | — Implemented in ingest.ts (Phase 02) |
| Downsampling Algorithm | Box Sampling (Area Averaging) for accurate color representation | — Implemented in ingest.ts (Phase 02) |
| Concurrency Engine | Single persistent Web Worker with batching and abort signaling | — Implemented in matcher.worker.ts (Phase 02) |
| RGBA Match Cache | Persisted across dimension changes, cleared only on palette edits | — Implemented in worker-client.ts (Phase 02) |
| Transform Handling | Pointer Events (drag pan) + Wheel Listener (scale zoom) | — Implemented in viewer.ts (Phase 03) |
| Zoom Anchor | Cursor-centered offset updates | — Implemented in viewer.ts (Phase 03) |
| Viewport Rendering | Double-buffered offscreen canvas blitted to screen | — Implemented in viewer.ts (Phase 03) |
| Grid Gaps Backing | Slate Gray `#2D3748` drawn behind cells | — Implemented in viewer.ts (Phase 03) |
| Direct Cart & Canvas Partnerships | Integrate direct affiliate cart building and custom canvas ordering links to monetize the tool while maintaining client-side execution. | — Shipped in Milestone v2.0 (Phase 5) |
| Post-milestone maintenance review | Ran GSD map-codebase + a full deep code review before further feature work; fixed 4 blockers, roadmapped remaining warnings as Milestone v2.1. | — REVIEW.md; blockers fixed via quick tasks 2026-07-12 |
| Off-main-thread image decode | Evict resample + `getImageData` readback + box-sampling from the main thread via a transferred `ImageBitmap` into the existing matcher worker (topology A), reusing the B2 abort; keep output bit-identical. | ✓ Shipped Phase 13; execute-time code review caught + fixed a stale-decode-rejection bug and an EXIF parity bug the tests missed |
| v2.1 scope cut | Ship only the two highest-value review items (Phases 11 + 13); defer Phases 10/12/14 to a later rewrite. | ⚠ Revisit — deferred requirements carried in `milestones/v2.1-REQUIREMENTS.md` |
| v3.0 two-mode pivot | Split into Customer (done-for-you) and Artist (self-serve) modes inside a viewport-native wizard; begin crossing the client-side-only constraint. Frontend-first — order backend, payments, and printer APIs deferred to v4.0. | ◆ In progress (Milestone v3.0) |
| v3.0 payments manual/offline | Capture customer orders as an exportable packet and fulfill manually rather than building payment processing now. | ◆ Lowers v3.0 risk; automated payments = v4.0 |
| v3.0 force-closed at 40% | Closed the milestone after only the correctness foundation (Phases 15–16) shipped; the two UI reworks (viewport wizard, mode split) and the service-fee/order-packet flow (Phases 17–19) were carried to the Backlog rather than built. | ⚠️ Revisit — headline scope unmet; re-scope into a fresh milestone (`milestones/v3.0-*` preserves criteria) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-13 — Milestone v3.0 Two-Mode Viewport Experience FORCE-CLOSED at 40% (Phases 15–16 shipped: VENDOR-02 + PRICE-01/02/03 + DATA-01 + BAG-01/02/03, 8/21 requirements). Phases 17–19 (FEE/ORDER/VIEWPORT/MODE) never built — carried to Backlog. Next: `/gsd-new-milestone`.*
