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
- [ ] **ENGINE-03**: Process matching loops asynchronously using Web Workers to prevent UI thread lockups.
- [ ] **ENGINE-04**: Implement an RGBA-to-DMC match lookup cache to bypass redundant distance checks on similar colors.

### Palettes & Inventory

- [x] **PALETTE-01**: Support matching against the Art Dot 100-color manufacturer index.
- [x] **PALETTE-02**: Support matching against the Art Dot 200-color manufacturer index.
- [ ] **PALETTE-03**: User can toggle specific colors on/off in a sub-palette selector, triggering instant client-side recalculation to other kit colors.

### Interactive Grid Preview

- [ ] **VIEW-01**: User can zoom and pan the preview grid using pointer events.
- [ ] **VIEW-02**: User can toggle between Square (full grid cell coverage) and Round (circular representation showing gaps) drill styles.
- [ ] **VIEW-03**: User can highlight occurrences of a selected color in the grid preview by selecting it in the legend/report.

### Supply Reporting & Export

- [ ] **REPORT-01**: Display a table summarizing the required DMC codes, names, swatches, and exact dot counts.
- [ ] **REPORT-02**: Add a configurable safety margin (default +10% to +15%) to exact counts and round counts to recommend purchase packaging units.
- [ ] **REPORT-03**: User can export the supply list and grid details as a clean, printable PDF using native browser print media formatting.

## v2 Requirements

### Advanced Logic

- **ENGINE-05**: Confetti reduction pass (median noise-reduction filter) to smooth isolated single pixels.
- **PALETTE-04**: Custom palette import/export via JSON files.
- **VIEW-04**: Render symbol overlays on individual grid cells when zoomed in high enough (Level-of-Detail).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side accounts & storage | Keeps client-side lightweight, low overhead, and private. |
| Drawing canvas & brush tools | The app is a pattern generator; users can edit images before upload. |
| E-Commerce integrations | Defer to direct printout checklist. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INGEST-01 | Phase 2 | Complete |
| INGEST-02 | Phase 2 | Complete |
| INGEST-03 | Phase 2 | Complete |
| INGEST-04 | Phase 2 | Complete |
| ENGINE-01 | Phase 1 | Complete |
| ENGINE-02 | Phase 1 | Complete |
| ENGINE-03 | Phase 2 | Pending |
| ENGINE-04 | Phase 2 | Pending |
| PALETTE-01 | Phase 1 | Complete |
| PALETTE-02 | Phase 1 | Complete |
| PALETTE-03 | Phase 4 | Pending |
| VIEW-01 | Phase 3 | Pending |
| VIEW-02 | Phase 3 | Pending |
| VIEW-03 | Phase 4 | Pending |
| REPORT-01 | Phase 4 | Pending |
| REPORT-02 | Phase 4 | Pending |
| REPORT-03 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-06*
*Last updated: 2026-07-06 after roadmap creation*
