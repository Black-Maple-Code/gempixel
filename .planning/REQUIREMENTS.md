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

- [ ] **PARTNER-01**: User can select canvas options and generate custom links to canvas suppliers (with sizing/dimensions parameters passed) to order sticky-glue canvas prints matching the layout.
- [ ] **PARTNER-02**: User can build and export an optimized cart link to Diamond Drills USA containing the exact combination of drill bags needed, integrating partner affiliate tracking.

### commission artist experience

- [ ] **ARTIST-01**: User can save and manage multiple custom commission projects locally (via localStorage) to quickly switch layouts, quotes, and progress.
- [ ] **ARTIST-02**: Refactor sidebar controls and input layouts into a streamlined step-by-step workflow to guide the artist from image ingestion -> design preview -> quoting -> supply ordering.

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
| PARTNER-01 | Phase 5 | Pending |
| PARTNER-02 | Phase 5 | Pending |
| ARTIST-01 | Phase 6 | Pending |
| ARTIST-02 | Phase 6 | Pending |

**Coverage:**

- Milestone v1.0 requirements: 17 total (17 complete)
- Milestone v2.0 requirements: 4 total (0 complete)
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-06*
*Last updated: 2026-07-07 after Milestone v2.0 planning*
