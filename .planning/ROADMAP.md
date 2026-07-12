# Roadmap: GemPixel

## Overview

GemPixel is a client-side utility web application designed for diamond painting and gem art planning. This roadmap outlines the transition from a core color-matching library (Phase 1), to a client-side image-downscaling engine offloaded to Web Workers (Phase 2), then to an interactive graphics-accelerated Canvas viewport (Phase 3), and finally to a supply planner dashboard featuring sub-palette selection, highlighting, and print exports (Phase 4).

## Phases

- [x] **Phase 1: Core Engine & Color Mathematics** - Establish accurate color conversion libraries and static manufacturer data structures. (completed 2026-07-07)
- [x] **Phase 2: Client-side Engine & Worker Architecture** - Load images client-side, downsample/fit to size, and execute color matching on a background Web Worker with caching. (completed 2026-07-07)
- [x] **Phase 3: Canvas Viewer & Zoom/Pan Interaction** - Implement high-performance interactive grid preview canvas with zoom, pan, and custom drill styles. (completed 2026-07-07)
- [x] **Phase 4: Supply Planning, Customization & Exports** - Generate printable supply reports, customize sub-palettes, highlight canvas colors, and export to PDF. (completed 2026-07-07)
- [x] **Phase 5: Supply Partnerships & Checkout Integration** - Integrate canvas supplier redirects and Diamond Drills USA shopping cart generators with affiliate parameters. (completed 2026-07-07)
- [x] **Phase 6: Commission Workspace & Streamlined Artist UX** - Build a local portfolio workspace manager and refactor sidebar inputs into a simplified 4-step wizard journey. (completed 2026-07-08)
- [x] **Phase 7: Symbol-Overlay Canvas & Margin Legends** - Render unique recognizable icons in canvas cells, build a printable margin legend fold layout, and support 3-way viewer switching. (completed 2026-07-09)
- [x] **Phase 8: Custom Canvas Export & Multiple Vendor Integration** - Add high-resolution PNG downloads for Option C (combined sheet vs separate grid), Dynamic Sizing Advice, and integrate Lumaprints (default) alongside Prodigi/FinerWorks options. (completed 2026-07-09)
- [x] **Phase 9: Viewport HUD Overlay & Intuitive Wizard Navigation UX** - Implement a floating viewport Heads-Up Display (HUD) overlay for interactive controls, redesign next/back step navigation buttons, and logically group sidebar settings. (completed 2026-07-10)

### Milestone v2.1 — Post-Review Remediation

Address the remaining warnings from the maintenance code review (`.planning/codebase/REVIEW.md`). Blockers B1–B4 already fixed via quick tasks.

**Active scope (2026-07-12 decision):** Phases **11** (storage robustness + error surface) and **13** (off-main-thread decode). Phases **10**, **12**, and **14** are **deferred** to a later version / the feature roadmap — kept below as backlog, not in the current execution scope.

- [ ] **Phase 10: Project Load Correctness** *(deferred)* - Fix the saved-project load path so a restored project keeps its saved canvas price and renders the exact grid that was saved. (LOAD-01, LOAD-02)
- [x] **Phase 11: Storage Robustness & Error Feedback** *(active)* - Make localStorage access safe so the app mounts in private-browsing/blocked-storage, centralize persisted settings behind one helper, and surface save/download/checkout failures to the user. (STORE-01, STORE-02, ERR-01) (completed 2026-07-12)
- [ ] **Phase 12: Supply Pricing Accuracy** *(deferred)* - Correct 500-count bag pricing, stop treating unpriced sizes as free, and add a drill-variant integrity test. (PRICE-01, PRICE-02, DATA-01)
- [ ] **Phase 13: Performance — Off-Main-Thread Decode** *(active)* - Move image decode/box-sampling off the main thread so large images no longer jank the UI on match. (PERF-01)
- [ ] **Phase 14: Security & Cleanup** *(deferred)* - Validate partner canvas URLs against an http/https allowlist and either wire up or remove the unfinished partner-link path. (SEC-01)

## Phase Details

### Phase 1: Core Engine & Color Mathematics

**Goal**: Establish accurate color conversion libraries and static manufacturer data structures.
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: ENGINE-01, ENGINE-02, PALETTE-01, PALETTE-02
**Success Criteria** (what must be TRUE):

  1. The program matches arbitrary sRGB colors to the nearest DMC/Art Dot code using CIEDE2000 color distance.
  2. The system loads static lists for both Art Dot 100-color and Art Dot 200-color manufacturer indexes.
  3. Automated test suite verifies correct matching results and color conversions within acceptable tolerances.

**Plans**: 2/2 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold config (Vite/TS/Vitest) and implement core sRGB-to-CIELAB, blending, caching, and CIEDE2000 math.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Compile static reference indexes for Art Dot 100 and 200 color kits and implement data integrity tests.

### Phase 2: Client-side Engine & Worker Architecture

**Goal**: Load images client-side, downsample/fit to size, and execute color matching on a background Web Worker with caching.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, ENGINE-03, ENGINE-04
**Success Criteria** (what must be TRUE):

  1. User can drag and drop/load a PNG or JPEG image entirely client-side.
  2. User can specify canvas size in direct dimensions (rows/cols) or physical dimensions (cm/inches) and see computed dot sizes.
  3. The color-matching loop executes asynchronously in a Web Worker, keeping UI frame rate responsive.
  4. Recalculation uses an RGBA cache to bypass redundant distance checks on similar colors.

**Plans**: 2/2 plans complete

Plans:

- [ ] 02-01-PLAN.md — Build HTML5 File API loader and canvas-based image downscaler with Crop/Cover and Box Sampling.
- [ ] 02-02-PLAN.md — Integrate background Web Worker for CIEDE2000 color matching with RGBA caching and abort signaling.

### Phase 3: Canvas Viewer & Zoom/Pan Interaction

**Goal**: Implement high-performance interactive grid preview canvas with zoom, pan, and custom drill styles.
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: VIEW-01, VIEW-02
**Success Criteria** (what must be TRUE):

  1. User can zoom and pan the pixelated canvas preview using mouse scroll, click-and-drag, or touch pointer events.
  2. User can toggle between Square and Round drill styles and immediately see the visual representation update.
  3. Canvas rendering remains smooth (60 FPS during zoom/pan) even for large grid dimensions (e.g. 100x100).

**Plans**: 2/2 plans complete

**UI hint**: yes

Plans:

- [ ] 03-01-PLAN.md — Build interactive HTML5 Canvas viewport renderer with mouse/pointer matrix transformation support.
- [ ] 03-02-PLAN.md — Add Square and Round drill rendering styles with offscreen double-buffering optimizations.

### Phase 4: Supply Planning, Customization & Exports

**Goal**: Generate printable supply reports, customize sub-palettes, highlight canvas colors, and export to PDF.
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: PALETTE-03, VIEW-03, REPORT-01, REPORT-02, REPORT-03
**Success Criteria** (what must be TRUE):

  1. User can view a tabular supply list showing DMC codes, names, swatches, and exact dot counts with a safety margin (e.g., +10%).
  2. User can check/uncheck colors in the sub-palette list and see the preview canvas update colors dynamically based only on active palette items.
  3. Selecting a row in the supply report highlights all occurrences of that color in the grid preview.
  4. User can trigger the browser print dialog to output a clean, print-formatted PDF of the canvas grid and supply checklist.

**Plans**: 3/3 plans complete

**UI hint**: yes

Plans:

- [x] 04-01-PLAN.md — Design Preact supply checklist and sub-palette exclusion interface.
- [x] 04-02-PLAN.md — Implement legend color-highlight grid overlay logic.
- [x] 04-03-PLAN.md — Create CSS print layouts and print-to-PDF export mechanism.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Engine & Color Mathematics | 2/2 | Complete    | 2026-07-07 |
| 2. Client-side Engine & Worker Architecture | 2/2 | Complete    | 2026-07-07 |
| 3. Canvas Viewer & Zoom/Pan Interaction | 2/2 | Complete    | 2026-07-07 |
| 4. Supply Planning, Customization & Exports | 3/3 | Complete    | 2026-07-07 |

### Phase 5: Supply Partnerships & Checkout Integration

**Goal**: Integrate canvas provider sizing redirect links and Diamond Drills USA affiliate shopping cart generation.
**Mode**: standard
**Depends on**: Phase 4
**Requirements**: PARTNER-01, PARTNER-02
**Success Criteria** (what must be TRUE):

  1. User can choose a partner canvas supplier and see an "Order Sticky Canvas" button that opens their site pre-filled with the active canvas rows, columns, and layout dimensions.
  2. User can view a "Buy Custom Drills Cart" link that compiles all exact drill sizes and quantities into a single referral cart at Diamond Drills USA for easy checkout.

**Plans**: 2/2 plans complete

Plans:

- [x] 05-01-PLAN.md — Build canvas partner redirect link integrations passing sizing parameters.
- [x] 05-02-PLAN.md — Implement Diamond Drills USA shopping cart link compiler with affiliate referral tracking.

### Phase 6: Commission Workspace & Streamlined Artist UX

**Goal**: Implement local portfolio workspace tracking, save custom commissions (metadata, files, configurations), and clean up sidebar input hierarchy.
**Mode**: standard
**Depends on**: Phase 5
**Requirements**: ARTIST-01, ARTIST-02
**Success Criteria** (what must be TRUE):

  1. User can view a "My Commissions" sidebar dashboard listing saved projects with names, custom client quotes, and date added.
  2. All commission metadata and palette customization states are stored locally and persist across page reloads.
  3. Sidebar controls are consolidated into a clean 4-step wizard: (1) Upload, (2) Canvas Size & Style, (3) Legend & Palette, (4) Quoting & Ordering.

**Plans**: 2/2 plans complete

Plans:

- [x] 06-01-PLAN.md — Build local storage database and project switcher for multiple commission projects.
- [x] 06-02-PLAN.md — Redesign sidebar controls into a simplified 4-step wizard workflow.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Engine & Color Mathematics | 2/2 | Complete    | 2026-07-07 |
| 2. Client-side Engine & Worker Architecture | 2/2 | Complete    | 2026-07-07 |
| 3. Canvas Viewer & Zoom/Pan Interaction | 2/2 | Complete    | 2026-07-07 |
| 4. Supply Planning, Customization & Exports | 3/3 | Complete    | 2026-07-07 |
| 5. Supply Partnerships & Checkout Integration | 2/2 | Complete    | 2026-07-07 |
| 6. Commission Workspace & Streamlined Artist UX | 2/2 | Complete    | 2026-07-08 |
| 7. Symbol-Overlay Canvas & Margin Legends | 2/2 | Complete    | 2026-07-09 |
| 8. Custom Canvas Export & Multiple Vendor Integration | 2/2 | Complete    | 2026-07-09 |
| 9. Viewport HUD Overlay & Intuitive Wizard Navigation UX | 2/2 | Complete    | 2026-07-10 |

### Phase 7: Symbol-Overlay Canvas & Margin Legends

**Goal**: Render distinguishable symbols/icons inside grid cells on canvas, print margins legend hidden when stretched/framed, and support seamless 3-way viewer toggling.
**Mode**: standard
**Depends on**: Phase 6
**Requirements**: SYMBOL-01, SYMBOL-02, SYMBOL-03
**Success Criteria** (what must be TRUE):

  1. Curated database of 80+ visually unique symbols, allocated dynamically to active palette colors in order of color usage quantity.
  2. Canvas cells render symbol overlays centering characters, with font color adapted to cell color luminance for maximum readability (black text on light cells, white text on dark cells).
  3. Seamless 3-way viewport switcher allows instant toggling between "Grid Colors", "Grid + Symbols", and "Original Photo" in <1ms without Preact DOM re-renders.
  4. Printable canvas layout forces symbol view and positions color checklist legend in margins outside dashed fold boundaries.

**Plans**: 2/2 plans complete

Plans:

- [x] 07-01-PLAN.md — Core dynamic symbol database and luminance-based canvas text overlay.
- [x] 07-02-PLAN.md — 3-way viewport switcher and printable margin legend fold layout.

### Phase 8: Custom Canvas Export & Multiple Vendor Integration

**Goal**: Add downloadable high-res PNG outputs for Option C, dynamic margin sizing recommendations, and integrate Lumaprints alongside Prodigi and FinerWorks.
**Mode**: standard
**Depends on**: Phase 7
**Requirements**: EXPORT-01, EXPORT-02, VENDOR-01
**Success Criteria** (what must be TRUE):

  1. Step 3 select dropdown lets user switch canvas print providers between Lumaprints, Prodigi, and FinerWorks, dynamically updating base/custom price matching and default shipping rate.
  2. Option C downloads generate high-resolution sharp PNG files: "Canvas Only" (borderless grid + symbols) and "Combined Canvas Sheet" (left/right legend sidebars separated by dashed guidelines).
  3. UI displays clear sizing recommendations advising the artist on what size blank rolled canvas sheet to purchase based on selected layout option.
  4. "Print Legend Sheet" provides a clean, borderless layout for home printers on standard Letter/A4 paper.

**Plans**: 2/2 plans complete

Plans:

- [x] 08-01-PLAN.md — Multiple canvas vendors selection, pricing engine refactoring, and sizing advice.
- [x] 08-02-PLAN.md — High-resolution PNG canvas export engine (Option C) and home printer legend layout.

### Phase 9: Viewport HUD Overlay & Intuitive Wizard Navigation UX

**Goal**: Implement a floating viewport HUD overlay, improve wizard step navigation, and organize settings.
**Mode**: standard
**Depends on**: Phase 8
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):

  1. Floating overlay HUD inside the canvas viewport lets users toggle view modes (Colors, Symbols, Original), highlight colors, and view coordinate grids directly on canvas.
  2. Next and Back buttons redesigned as a persistent, styled footer bar or intuitive navigation panel showing step progress clearly.
  3. Sidebar configurations are categorized logically (e.g., Image settings vs Color Palette options) with tooltips and clean labels.

**Plans**: 2/2 plans complete

Plans:

- [x] 09-01-PLAN.md — CanvasViewer Zoom APIs and stylesheet additions for glassmorphic Viewport HUD.
- [x] 09-02-PLAN.md — App.tsx UI refactoring: stepper navigation, details accordions, viewport HUD integration, and unit tests alignment.

### Phase 10: Project Load Correctness

**Goal**: Fix the saved-project load path so a restored project keeps its saved canvas price and renders the exact grid that was saved.
**Mode**: standard
**Depends on**: Phase 9 (uses the commission workspace / project store)
**Requirements**: LOAD-01, LOAD-02
**Success Criteria** (what must be TRUE):

  1. A user overrides the canvas price, saves, and reloads the project — the restored price is shown, not the auto-recomputed vendor cost. (review W1)
  2. A project saved with a given substitution/smoothing state renders the same grid on reload, regardless of the session's current toggle state. (review W2)
  3. A regression test covers the load path (restored price survives the cost-recompute effect; restored grid is not re-processed with current toggles).

**Plans**: TBD (run `/gsd-plan-phase 10`)

### Phase 11: Storage Robustness & Error Feedback

**Goal**: Make localStorage access safe so the app mounts under blocked/private storage, centralize persisted settings behind one helper, and surface save/download/checkout failures to the user.
**Mode**: standard
**Depends on**: Phase 10
**Requirements**: STORE-01, STORE-02, ERR-01
**Success Criteria** (what must be TRUE):

  1. With site storage blocked (private browsing), the app still mounts and is usable — no unguarded read/write throws during render. (review W3)
  2. All persisted settings flow through a single `usePersistentState` helper; the duplicated lazy-init/effect boilerplate is removed. (review W3, IN-01)
  3. A failed save, download, or checkout shows a clear inline message instead of a silent no-op; the unmapped-colors-log parse is guarded. (review W4, W5)

**Plans**: 3/3 plans complete

Plans:
**Wave 1**

- [x] 11-01-PLAN.md — Build the safeStorage guard module + usePersistentState hook with format-preserving codecs and unit tests. (STORE-01, STORE-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 11-02-PLAN.md — Migrate the 7 persisted App.tsx settings onto usePersistentState, guard Step3Canvas clear-log, add blocked-storage mount test. (STORE-01, STORE-02)

**Wave 3** *(blocked on Wave 2 — same App.tsx file)*

- [x] 11-03-PLAN.md — Unified actionError banner for download/checkout/save failures, guard the checkout log parse, ERR-01 integration tests + banner human-verify. (ERR-01)

### Phase 12: Supply Pricing Accuracy

**Goal**: Correct 500-count bag pricing, stop treating unpriced sizes as free, and add a drill-variant integrity test.
**Mode**: standard
**Depends on**: Phase 9 (supply/checkout engine)
**Requirements**: PRICE-01, PRICE-02, DATA-01
**Success Criteria** (what must be TRUE):

  1. Selecting a 500-count default bag shows the correct per-packet cost (not the inflated 5000-tier fallback). (review W6)
  2. A bag size with no price entry is never chosen as "cheapest" at $0; missing prices are treated as ineligible/unknown and surfaced. (review W7)
  3. An automated test asserts drill-variant integrity: unique variant IDs, complete bag-size mappings, and every palette DMC has a mapping. (review IN-03)

**Plans**: TBD (run `/gsd-plan-phase 12`)

### Phase 13: Performance — Off-Main-Thread Decode

**Goal**: Move image decode and box-sampling off the main thread so large images no longer jank the UI on every match trigger.
**Mode**: standard
**Depends on**: Phase 11 (error surface for worker-side decode failures)
**Requirements**: PERF-01
**Success Criteria** (what must be TRUE):

  1. Loading/re-matching a large source image (e.g. 4000×3000) keeps the UI responsive; decode/downsample no longer block paint on the main thread. (review W8)
  2. Matching output is unchanged from the current main-thread pipeline (parity test on a fixture image).

**Plans**: 3 plans

Plans:
**Wave 1**

- [ ] 13-01-PLAN.md — Relocate resample/readback/box-sample into matcher.worker.ts behind the transferred-ImageBitmap message contract (worker + client + hook + tests, atomic). (PERF-01)

**Wave 2** *(blocked on Wave 1)*

- [ ] 13-02-PLAN.md — Wire the phase-labeled loading overlay ("Preparing image…" → "Matching colors: {n}%") and generalize the error-banner copy in App.tsx. (PERF-01)

**Wave 3** *(blocked on Wave 2 — manual gate)*

- [ ] 13-03-PLAN.md — Human-verify responsiveness, bit-identical parity (D-11 one-time fixture diff), and the unsupported-browser hard-fail banner. (PERF-01)

### Phase 14: Security & Cleanup

**Goal**: Validate partner canvas URLs against an http/https allowlist and either wire up or remove the unfinished partner-link path.
**Mode**: standard
**Depends on**: Phase 9 (checkout module)
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):

  1. A compiled partner canvas URL is rejected (not returned/opened) unless its scheme is http/https; `javascript:`/`data:` templates are blocked. (review W10)
  2. The `canvasTemplate` / `compileCanvasPartnerUrl` path is either wired to an actual openable link (with the validation above) or removed along with its persisted state. (review IN-02)

**Plans**: TBD (run `/gsd-plan-phase 14`)
