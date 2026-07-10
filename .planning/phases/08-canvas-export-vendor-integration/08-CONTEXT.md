# Phase 8 Context — Custom Canvas Export & Multiple Vendor Integration

Locked design decisions, requirements, and user preferences for Phase 8.

## User Decisions

### 1. Canvas Vendor Options & Pricing
We are replacing PrintKK with three canvas-only rolled print vendors. **Lumaprints** is the primary default vendor, with **Prodigi** and **FinerWorks** as user-selectable dropdown options in Step 3.

Base pricing mappings for rolled canvas:

| Vendor | 12" x 16" (3:4) | 16" x 20" (4:5) | 20" x 28" (5:7) | 40" x 60" (2:3) | Base Shipping | Sq. Inch Rate (Custom) |
|---|---|---|---|---|---|---|
| **Lumaprints** *(Primary)* | $6.50 | $8.50 | $12.00 | $28.00 | $4.99 | $0.035 |
| **Prodigi** | $9.00 | $11.50 | $16.00 | $35.00 | $5.00 | $0.048 |
| **FinerWorks** | $11.00 | $14.00 | $19.50 | $42.00 | $5.50 | $0.058 |

- Custom size cost calculation: `Width (in) * Height (in) * Sq. Inch Rate`, rounded to 2 decimal places.

### 2. Option C Export Workflow
Provide two download options and one direct print option in the Cost & Order workspace panel:
- **Download Canvas Only (PNG):** Exports a high-resolution, borderless PNG image containing *only* the grid cells and their symbol overlays.
- **Download Combined Canvas Sheet (PNG):** Exports a high-resolution PNG image containing the left legend (140px width), a dashed fold boundary guide, the grid canvas, a dashed fold boundary guide, and the right legend (140px width).
- **Print Legend Sheet:** Launches browser print layout containing *only* the color check legend (DMC code, swatch, symbol) formatted for standard desktop home printers (A4/Letter paper).

### 3. Dynamic Sizing Advice
When selecting the layout view, render a prominent helper panel advising the user on canvas sizing:
- **For Combined Sheet:** *"Sizing Advice: The grid is {width}x{height} {unit}. To preserve the legend on the side margins, order a rolled canvas print of **{width + X}x{height} {unit}** from your print shop. The side legends occupy {margin} {unit} on each side."*
- **For Separate Canvas:** *"Sizing Advice: The grid is {width}x{height} {unit}. Order an exact **{width}x{height} {unit}** borderless rolled canvas. Print the legend separately on standard paper."*

---

## Success Criteria

1. **Vendor Selection:** Dropdown select lists Lumaprints (default), Prodigi, and FinerWorks, dynamically recalculating canvas cost and default shipping.
2. **PNG Export Engine:** Canvas grid and symbols are redrawn and compiled at a high resolution (e.g. 15-20px per cell) onto an offscreen canvas and downloaded as a sharp, clean PNG file.
3. **Combined Layout Compilation:** Generates combined canvas image with left/right legends split, swatches colored, symbols centered, and dashed vertical guidelines.
4. **Print Legend Layout:** Allows printing the legend list alone on paper without exporting the canvas itself.
5. **Typescript & Test Coverage:** All unit/integration tests run green, and all types compile clean.
