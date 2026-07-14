# GemPixel

## What This Is

GemPixel is a client-side utility web application designed for diamond painting/gem art artists. It takes a user-loaded picture and converts it into a grid representation showing how it will look as gem art, matching the image colors to standard Art Dot/DMC manufacturer color indexes (100 and 200 color kits) and custom sub-palettes. It serves as a supply planning tool that outputs the exact color codes and dot counts needed for the canvas.

## Core Value

Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.

## Current Milestone: v4.0 Canvas-First Redesign

**Goal:** Rebuild the customer experience as a canvas-first, no-side-menus 4-step flow (Upload → Refine → Supplies → Order) in the new Atelier design system, working great on mobile, with accurate canvas quoting — recreated faithfully in the Preact/Vite codebase from the high-fidelity design handoff.

**Target features (frontend-only, client-side):**
- **Canvas-first flow, no side menus** — a horizontal 4-step bar (Upload → Refine → Supplies → Order) is the *only* navigator; the DMC color list, gem/drill bags, and cleanup tools are all surfaced inline. Retires the expand/collapse sidebars and page-flip wizard.
- **Refine (the key screen)** — live chart preview + an always-open refine rail: size cards with live drill counts, an edge-cleanup 4-segment control, and a **color-count slider whose max tracks the real detected color count** (lowering it merges rare one-off drills into a near-identical already-used shade, no visible change to the picture).
- **Supplies** — inline legend/supply table (symbol · swatch · DMC · drills+10% · bags) + an order-summary panel, wired to the shipped `planOrderSupply` engine so numbers can't diverge.
- **Order (confirm/handoff)** — a single confirm screen with an auto-filled, locked spec (Rolled Canvas, size from grid, finish) + a full price breakdown. Client-side handoff (no real payment/lab submission this milestone).
- **Atelier design system, light-only** — dark mode retired; new tokens (bg `#F4F1E9`, accent green `#0E6E5C`) and type (Newsreader / Pixelify Sans / Archivo / JetBrains Mono).
- **Mobile rework** — the same 4 steps in one portrait column on a phone; everything inline, never in a drawer.
- **Accurate canvas quoting** — real cols→inches mapping + a cost table (canvas + shipping + tax estimate) so the customer quote is correct.

**Scope boundary:** Frontend-first and still **100% client-side** — this milestone deliberately does NOT build the backend. The **backend ops console** (orders queue / order detail / sourcing), **Lumaprints API order submission + payments** (merchant-of-record), **server-side chart rendering** (PNG+PDF), **asset storage**, **shipment tracking** (canvas + drills), and **gem-sourcing POs** are all deferred to a later fulfillment milestone (v5.0). Live vendor rate APIs are out; quoting uses a curated cost table. The design handoff's Storyboard C is out of scope here.

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

**Milestone v4.0 Canvas-First Redesign** is active (opened 2026-07-13). See the Current Milestone section above for goal and target features; scoped requirements land in `.planning/REQUIREMENTS.md`. Frontend-only, 100% client-side; the fulfillment backend is explicitly deferred to v5.0.

**Deferred to v5.0 — Fulfillment Backend** (the design handoff's Storyboard C + server-side integrations; first real backend):
- [ ] Backend ops console — orders queue, order detail (three artifacts + print spec + gem quantities), sourcing aggregation → provider POs.
- [ ] Lumaprints API order submission (merchant-of-record) + payments + billing/address on file.
- [ ] Server-side chart rendering (PNG print + PDF legend) so "what shipped = what bought".
- [ ] Asset storage (source PNG + chart PNG/PDF by URL reference).
- [ ] Two independent shipment tracks per order (canvas via lab + drills via gem provider) via webhooks/polling.
- [ ] Live vendor rate APIs (Lumaprints / FinerWorks) — v4.0 uses a curated cost table instead.

**Superseded by v4.0** (the v3.0 force-close gaps — the two-mode/viewport/order-packet scope is replaced by the canvas-first redesign vision; criteria preserved in `milestones/v3.0-REQUIREMENTS.md`):
- ~~Service Fee & Customer Order Packet (FEE-01, ORDER-01..05)~~ — reconsidered under the redesigned Order step.
- ~~Viewport-Native Wizard (VIEWPORT-01..03)~~ — superseded by the canvas-first flow.
- ~~Two-Mode Split — Customer/Artist (MODE-01..04)~~ — the redesign is customer-first; a separate artist mode is not part of v4.0.

**Still deferred** (roadmapped under v2.1, never built — requirements preserved in `milestones/v2.1-REQUIREMENTS.md`):
- [ ] Project Load Correctness — restored projects keep their saved price and grid (LOAD-01, LOAD-02).
- [ ] Security & Cleanup — validate the partner canvas URL against an http/https allowlist and wire-up-or-remove the unfinished partner-link path (SEC-01).

### Out of Scope

- [ ] Backend / server-side processing this milestone — v4.0 stays 100% client-side; the fulfillment backend + admin console is a planned **v5.0** capability, not v4.0.
- [ ] Automated payment processing / real lab order submission — the v4.0 Order step is a client-side confirm/handoff; payments and Lumaprints API submission are v5.0.
- [ ] Dark mode — retired; ship the Atelier light theme only.
- [ ] Live vendor inventory / sales-tax/VAT calculation — quoting uses a curated cost table with a tax estimate, not live APIs.
- [ ] AI-based color enhancement or style generation — stick to clean mathematical color matching (standing exclusion).

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
| v4.0 canvas-first redesign (fresh direction) | Instead of resuming the v3.0 viewport/mode scope, pivot to a full customer-facing redesign from a high-fidelity design handoff: canvas-first no-side-menus 4-step flow + Atelier light-only design system + mobile rework + accurate quoting. Customer-first (no separate Artist mode). | ◆ In progress (Milestone v4.0) |
| v4.0 stays client-side; backend → v5.0 | Ship the frontend redesign only; defer the fulfillment backend (ops console, Lumaprints API + payments, server-side render, asset storage, shipment tracking, sourcing) to v5.0. Quoting uses a curated cost table, not live vendor APIs. | ◆ Lowers v4.0 risk; keeps the client-side-only invariant one more milestone |

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
*Last updated: 2026-07-14 — Milestone v4.0 in progress: Phases 20–22 shipped (Atelier design system + canvas-first shell → shared UI primitives → additive engine). Phase 22 validated QUOTE-01/02/03: one 2.5mm/dot density source (`engine/density.ts`), one integer-cents `engine/quote.ts` selector (line items sum exactly; $0 tax "calculated at vendor checkout"; combined shipping w/ dated provenance), plus the deterministic Delta-E-guarded `reduceToColorCount` + raw-keyed `detectedColorCount` engine support (all additive, engine-only, 325 tests green). Next: Phase 23 — the four screens in flow order. Backend/fulfillment deferred to v5.0.*
