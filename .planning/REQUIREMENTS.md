# Requirements: GemPixel

**Defined:** 2026-07-06
**Core Value:** Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Ingestion & Sizing

- [x] **INGEST-01**: User can load local images (PNG, JPG/JPEG) client-side without server upload.
- [x] **INGEST-02**: User can select image sizing behaviors (fit or crop) to preserve aspect ratio.
- [x] **INGEST-03**: User can specify direct canvas dimensions in rows and columns (e.g. 40x40 dots).
- [x] **INGEST-04**: User can specify canvas size in physical dimensions (cm/inches) with automatic dot calculation based on standard drill size (2.5mm per drill / 10 dots per inch).

### Color Matching Engine

- [x] **ENGINE-01**: Map sRGB pixels from the source image to the CIELAB color space.
- [x] **ENGINE-02**: Match sRGB pixels to the nearest DMC catalog color using the CIEDE2000 color distance formula.
- [x] **ENGINE-03**: Process matching loops asynchronously using Web Workers to prevent UI thread lockups.
- [x] **ENGINE-04**: Implement an RGBA-to-DMC match lookup cache to bypass redundant distance checks on similar colors.

### Palettes & Inventory

- [x] **PALETTE-01**: Support matching against the Art Dot 100-color manufacturer index.
- [x] **PALETTE-02**: Support matching against the Art Dot 200-color manufacturer index.
- [x] **PALETTE-03**: User can toggle specific colors on/off in a sub-palette selector, triggering instant client-side recalculation to other kit colors.

### Interactive Grid Preview

- [x] **VIEW-01**: User can zoom and pan the preview grid using pointer events.
- [x] **VIEW-02**: User can toggle between Square (full grid cell coverage) and Round (circular representation showing gaps) drill styles.
- [x] **VIEW-03**: User can highlight occurrences of a selected color in the grid preview by selecting it in the legend/report.

### Supply Reporting & Export

- [x] **REPORT-01**: Display a table summarizing the required DMC codes, names, swatches, and exact dot counts.
- [x] **REPORT-02**: Add a configurable safety margin (default +10% to +15%) to exact counts and round counts to recommend purchase packaging units.
- [x] **REPORT-03**: User can export the supply list and grid details as a clean, printable PDF using native browser print media formatting.

## Milestone v2.0 Requirements: Partnerships & Artist UX

### ordering & partnerships

- [x] **PARTNER-01**: User can select canvas options and generate custom links to canvas suppliers (with sizing/dimensions parameters passed) to order sticky-glue canvas prints matching the layout.
- [x] **PARTNER-02**: User can build and export an optimized cart link to Diamond Drills USA containing the exact combination of drill bags needed, integrating partner affiliate tracking.

### commission artist experience

- [x] **ARTIST-01**: User can save and manage multiple custom commission projects locally (via localStorage) to quickly switch layouts, quotes, and progress.
- [x] **ARTIST-02**: Refactor sidebar controls and input layouts into a streamlined step-by-step workflow to guide the artist from image ingestion -> design preview -> quoting -> supply ordering.

### Symbol-Overlay Canvas & Margin Legends (Phase 7)

- [x] **SYMBOL-01**: Curated database of 80+ visually unique symbols, allocated dynamically to active palette colors in order of color usage quantity.
- [x] **SYMBOL-02**: Canvas cells render symbol overlays centering characters, with font color adapted to cell color luminance for maximum readability (black text on light cells, white text on dark cells).
- [x] **SYMBOL-03**: Seamless 3-way viewport switcher allows instant toggling between "Grid Colors", "Grid + Symbols", and "Original Photo" in <1ms without Preact DOM re-renders. Printable canvas layout forces symbol view and positions color checklist legend in margins outside dashed fold boundaries.

### Custom Canvas Export & Multiple Vendor Integration (Phase 8)

- [x] **EXPORT-01**: Support downloading high-resolution PNG image exports under Option C (Separate Canvas grid-only vs Combined Canvas Sheet with margin legends and vertical wrap fold lines).
- [x] **EXPORT-02**: Provide dynamic canvas sizing calculations and advice displayed inline based on selected layout (accounting for margin sizes).
- [x] **VENDOR-01**: Integrate Lumaprints as the primary default canvas vendor, and Prodigi + FinerWorks as user-selectable dropdown options, dynamically updating product costing and default shipping rates.

### Viewport HUD & Intuitive Wizard Navigation (Phase 9)

- [x] **NAV-01**: Replace or style Next/Back buttons to be intuitive, contextual, and prominent.
- [x] **NAV-02**: Move active layout, view toggles, color highlights, and basic canvas settings directly into a floating HUD overlay (Heads-Up Display) inside the canvas viewport, reducing sidebar clutter.
- [x] **NAV-03**: Re-organize settings logically, group them, and display clear tooltips or descriptive labels.

## Milestone v2.1 Requirements: Post-Review Remediation

Derived from the maintenance code review (`.planning/codebase/REVIEW.md`). The four
blockers (B1–B4) were already fixed via quick tasks (260711-wvv, 260711-x6p, 260712-05k,
260712-0io); these requirements cover the remaining review warnings.

### Project Load Correctness

- [ ] **LOAD-01**: When a user reloads a saved project, its saved canvas price is preserved and not overwritten by the automatic cost recompute. (review W1)
- [ ] **LOAD-02**: When a user reloads a saved project, the rendered grid matches what was saved, regardless of the session's current substitution/smoothing toggles. (review W2)

### Storage Robustness & Error Feedback

- [x] **STORE-01**: The app loads and functions even when localStorage is unavailable or blocked (e.g. private browsing) — no storage read/write throws during mount. (review W3)
- [x] **STORE-02**: All persisted settings read/write through a single safe helper (`usePersistentState`), so a storage error in one setting cannot break the app and duplicated boilerplate is removed. (review W3, IN-01)
- [ ] **ERR-01**: When a save, download, or checkout action fails, the user sees a clear message instead of a silent no-op (extends the match-error surface to the remaining paths). (review W4, W5)

### Supply Pricing Accuracy

- [ ] **PRICE-01**: The per-packet cost shown for a 500-count drill bag is correct and not priced as a larger/nonexistent tier. (review W6)
- [ ] **PRICE-02**: An unpriced bag size is never treated as free ($0); cost minimization never selects a size because its price is missing. (review W7)
- [ ] **DATA-01**: An automated integrity test verifies the drill-variant table — unique variant IDs, complete bag-size mappings, and every palette DMC has a mapping. (review IN-03)

### Performance

- [ ] **PERF-01**: Loading or re-matching a large source image keeps the UI responsive — image decode and box-sampling do not block the main thread. (review W8)

### Security & Cleanup

- [ ] **SEC-01**: A partner canvas URL is validated against an http/https allowlist before it can be opened, and the unfinished partner-link path is either wired up safely or removed. (review W10, IN-02)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side accounts & storage | Keeps client-side lightweight, low overhead, and private. |
| Drawing canvas & brush tools | The app is a pattern generator; users can edit images before upload. |
| In-app payment processing | Redirect to external partner checkout pages with affiliate/partner links. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INGEST-01 | Phase 2 | Complete |
| INGEST-02 | Phase 2 | Complete |
| INGEST-03 | Phase 2 | Complete |
| INGEST-04 | Phase 2 | Complete |
| ENGINE-01 | Phase 1 | Complete |
| ENGINE-02 | Phase 1 | Complete |
| ENGINE-03 | Phase 2 | Complete |
| ENGINE-04 | Phase 2 | Complete |
| PALETTE-01 | Phase 1 | Complete |
| PALETTE-02 | Phase 1 | Complete |
| PALETTE-03 | Phase 4 | Complete |
| VIEW-01 | Phase 3 | Complete |
| VIEW-02 | Phase 3 | Complete |
| VIEW-03 | Phase 4 | Complete |
| REPORT-01 | Phase 4 | Complete |
| REPORT-02 | Phase 4 | Complete |
| REPORT-03 | Phase 4 | Complete |
| PARTNER-01 | Phase 5 | Complete |
| PARTNER-02 | Phase 5 | Complete |
| ARTIST-01 | Phase 6 | Complete |
| ARTIST-02 | Phase 6 | Complete |
| SYMBOL-01 | Phase 7 | Complete |
| SYMBOL-02 | Phase 7 | Complete |
| SYMBOL-03 | Phase 7 | Complete |
| EXPORT-01 | Phase 8 | Complete |
| EXPORT-02 | Phase 8 | Complete |
| VENDOR-01 | Phase 8 | Complete |
| NAV-01 | Phase 9 | Complete |
| NAV-02 | Phase 9 | Complete |
| NAV-03 | Phase 9 | Complete |
| LOAD-01 | Phase 10 | Pending |
| LOAD-02 | Phase 10 | Pending |
| STORE-01 | Phase 11 | Complete |
| STORE-02 | Phase 11 | Complete |
| ERR-01 | Phase 11 | Pending |
| PRICE-01 | Phase 12 | Pending |
| PRICE-02 | Phase 12 | Pending |
| DATA-01 | Phase 12 | Pending |
| PERF-01 | Phase 13 | Pending |
| SEC-01 | Phase 14 | Pending |

**Coverage:**

- Milestone v1.0 requirements: 17 total (17 complete)
- Milestone v2.0 requirements (Phases 5–9): 13 total (13 complete)
- Milestone v2.1 requirements (Phases 10–14, post-review remediation): 10 total (0 complete)
- Mapped to phases: 40
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-06*
*Last updated: 2026-07-12 — opened Milestone v2.1 (post-review remediation)*
