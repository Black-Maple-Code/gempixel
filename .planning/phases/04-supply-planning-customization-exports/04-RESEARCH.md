# Phase 04 Research: Supply Planning, Customization & Exports

## User Constraints

### Locked Decisions (verbatim from 04-CONTEXT.md)
*   **Viewport Highlighting**
    *   **D-01:** Implement **Dimming non-selected colors** as the highlight mode (VIEW-03). When a color row is selected in the legend, draw that highlighted color cells with full opacity, while dimming all other canvas cells to low opacity (`20%` or `0.2` alpha). This makes highlighted colors visually stand out immediately.
*   **Sub-palette Customization**
    *   **D-02:** Implement **Instant recalculation on toggle** (PALETTE-03). When check/unchecking color options in the sub-palette checklist, instantly re-run the Web Worker color matching task using the active candidates set. In-flight tasks are aborted automatically by `MatcherClient` to maintain main thread responsiveness.
*   **Supply Planning & Safety Margins**
    *   **D-03:** Add a **+10% safety margin** to all exact dot counts (REPORT-02).
    *   **D-04:** Implement **Standard 200-drill packet rounding** (REPORT-02). Round safety-adjusted drill counts up to the nearest multiple of 200, and display the recommended number of purchase packets/bags required (e.g. count of 385 drills requires 2 packets of 200).
    *   **D-05:** Display a tabular legend checklist summary showing DMC codes, swatches, exact dot counts, and recommended packets (REPORT-01).
*   **Exports & Printing**
    *   **D-06:** Implement **CSS print layouts** using native media queries (`@media print`) and trigger exports via the native browser print interface `window.print()` (REPORT-03). The print layout hides sidebar menus, formats columns, and adjusts grids onto clean pages without requiring heavy PDF libraries.
*   **Carrying Forward from Phase 3**
    *   **D-07 (from P3-D-07):** The Preact component initializes `CanvasViewer` on a container canvas and delegates drag-pan and scroll-zoom events to it.

---

## Technical Domain Research

### 1. Preact & Tailwind CSS v4 Integration

#### A. Preact + Vite Setup
To build the user interface, we install `preact` and its Vite configuration preset `@preact/preset-vite`.
We update `vite.config.ts` to include the Preact plugin:
```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()]
});
```
We also update `tsconfig.json` to instruct the compiler to compile JSX/TSX elements using Preact's virtual DOM structure:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

#### B. Tailwind CSS v4 Setup
Tailwind CSS v4 introduces a fast native compiler. We configure it by adding `@tailwindcss/vite` plugin to `vite.config.ts`:
```typescript
import tailwindcss from '@tailwindcss/vite';
// ...
export default defineConfig({
  plugins: [preact(), tailwindcss()]
});
```
In our global styles file `src/index.css`, we import Tailwind directly using standard v4 directives:
```css
@import "tailwindcss";
```

---

### 2. Viewport Highlighting & Opacity Calculations

To dim non-selected colors, we modify the offscreen double-buffering blitting method in `CanvasViewer`.
When blitting the offscreen cached grid onto the main canvas, we cannot use a single `drawImage` if different cells require different opacities. Instead, during highlighting:
1. **Highlighting Drawing Pass**: We configure `ctx.globalAlpha = 0.2` (dimmed opacity) and blit the entire offscreen cached canvas.
2. **Overlay Drawing Pass**: We draw only the cells containing the highlighted color at full opacity (`ctx.globalAlpha = 1.0`). We calculate their position on the display canvas using the scale offsets:
   ```typescript
   if (this.highlightedColor) {
     this.ctx.globalAlpha = 0.2;
     // draw everything dimmed first
     this.ctx.drawImage(this.offscreenCanvas, ...);
     
     // draw highlighted cells fully opaque
     this.ctx.globalAlpha = 1.0;
     const cellSize = 16;
     for (let row = 0; row < this.gridHeight; row++) {
       for (let col = 0; col < this.gridWidth; col++) {
         const code = this.cellMatches[row * this.gridWidth + col];
         if (code === this.highlightedColor) {
           const color = this.colorMap.get(code) || '#2D3748';
           this.ctx.fillStyle = color;
           
           const destX = this.offsetX + col * cellSize * this.scale;
           const destY = this.offsetY + row * cellSize * this.scale;
           const destW = cellSize * this.scale;
           const destH = cellSize * this.scale;
           
           if (this.drillStyle === 'square') {
             this.ctx.fillRect(destX, destY, destW, destH);
           } else {
             this.ctx.beginPath();
             this.ctx.arc(destX + destW/2, destY + destH/2, 0.45 * destW, 0, Math.PI * 2);
             this.ctx.fill();
           }
         }
       }
     }
   }
   ```
This blends double-buffered panning performance with accurate color highlighting.

---

### 3. Supply Calculations

#### A. Safety Margin & Packets Formula
Given the exact count $C_{\text{exact}}$ of drills for a specific DMC color, the safety-increased count $C_{\text{safety}}$ with $+10\%$ margin is:
$$C_{\text{safety}} = \lceil C_{\text{exact}} \times 1.1 \rceil$$
Standard Art Dot drill packets contain exactly 200 drills. The recommended purchase packets count $P_{\text{packets}}$ is:
$$P_{\text{packets}} = \lceil C_{\text{safety}} / 200 \rceil$$
The final purchase count $C_{\text{purchase}}$ is:
$$C_{\text{purchase}} = P_{\text{packets}} \times 200$$

---

### 4. CSS Print Layouts

To create print layouts without external PDF libraries, we use CSS `@media print` directives in `src/index.css`:
- Hide sidebar control panels and non-printable elements using `display: none`.
- Reset layouts and grid margins to fit standard letter/A4 paper dimensions.
- Center the canvas grid.
- Format the legend checklist as a neat table across pages.

```css
@media print {
  body {
    background: white;
    color: black;
  }
  .no-print {
    display: none !important;
  }
  .print-area {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  table {
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
}
```
Triggering the export button calls the browser print interface:
```typescript
window.print();
```
This formats pages natively into vectors, converting them to PDF.
