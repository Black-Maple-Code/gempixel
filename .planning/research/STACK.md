# Technology Stack Dimension: GemPixel

This document defines the official technology stack for **GemPixel**, specifying libraries, build configurations, and client-side design decisions to implement a high-fidelity image-to-diamond-painting match utility. 

GemPixel runs entirely client-side in the browser. It requires zero server infrastructure, ensuring fast rendering, privacy, and zero maintenance costs.

---

## 1. Stack Selection Summary

Below is the summary of the chosen technologies, versions, confidence levels, and roles.

| Tech Layer | Prescriptive Recommendation | Version | Confidence Level | Core Role in GemPixel |
| :--- | :--- | :--- | :--- | :--- |
| **Bundler & Dev Server** | [Vite](https://vite.dev/) | `^6.0.0` | **High** | Code bundling, hot module replacement, TypeScript parsing, static asset packaging, and native Web Worker bundling. |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5.0.0` | **High** | Static typing for color space models (RGB, XYZ, Lab), coordinate grids, state payloads, and canvas config interfaces. |
| **View Framework** | [Preact](https://preactjs.com/) | `^10.25.0` | **High** | High-performance, lightweight UI engine (<4KB) to manage sidebar configurations, palette checkboxes, size fields, and supply stats. |
| **Styling Framework** | [Tailwind CSS](https://tailwindcss.com/) | `^4.0.0` | **High** | Utility-first CSS for responsive dashboard Layout, modals, sliders, and color preview grids. |
| **Color Science Library** | [Culori](https://culorijs.org/) | `^4.0.2` | **High** | Industry-standard, tree-shakable color library providing conversions to CIELAB space and CIEDE2000 distance matching formulas. |
| **Concurrency API** | Native Browser Web Workers | — | **High** | Background threading to offload heavy color matching calculations and prevent main thread lockups. |
| **File Access API** | HTML5 File API & Object URLs | — | **High** | High-performance file reading and memory references (`URL.createObjectURL`) for local images. |
| **Grid Render Engine** | HTML5 Canvas 2D | — | **High** | Interactive canvas layer drawing drill shapes, gridlines, and symbols. Supports GPU-accelerated blitting and custom zoom/pan. |
| **Data Export Layer** | Data URIs + CSS Print Styles | — | **High** | Tabular CSV export via browser download and PDF generation using browser printing (`window.print()`). |

---

## 2. Core Development Environment & Tooling

### Vite (`^6.0.0`) & TypeScript (`^5.0.0`)
* **Rationale**: Vite is the industry standard for fast frontend development. It features instantaneous hot module replacement (HMR) and relies on ESBuild for rapid compiling. Vite natively supports Web Workers using URL constructors (`new Worker(new URL('./matcher.worker.ts', import.meta.url))`), eliminating worker-bundling configuration hurdles.
* **Why TypeScript**: Executing conversions across three distinct color spaces (sRGB $\rightarrow$ XYZ $\rightarrow$ CIELAB) requires strict validation of data shapes. Typing prevents passing un-normalized sRGB arrays into math functions and enforces clear payload structures between the UI thread and background Web Workers.

---

## 3. UI Framework & Styling

### Preact (`^10.25.0`) & Tailwind CSS (`^4.0.0`)
* **Rationale**: The core of GemPixel is Canvas-based. However, the app requires a robust UI dashboard to:
  1. Input grid size (rows/cols) or physical size ($cm$/inches).
  2. Toggle manufacturer kits (Art Dot 100, Art Dot 200, Full DMC).
  3. Filter and check/uncheck 447 individual DMC colors in a custom sub-palette.
  4. Render the supply list report.
* Preact is a drop-in React replacement with a fraction of the bundle weight (~4KB minified + gzipped). It provides clean, state-driven rendering for form fields and tables, keeping UI complexity low while avoiding the performance and bundle size penalties of React.
* Tailwind CSS compiles down to a single optimized utility stylesheet, introducing zero runtime JavaScript and minimal styling overhead.

---

## 4. Specialized Libraries & APIs

### Color Science: Culori (`^4.0.2`)
* **Rationale**: Raw Euclidean distance in sRGB space ($d = \sqrt{\Delta R^2 + \Delta G^2 + \Delta B^2}$) ignores human visual biology. GemPixel must use the **CIEDE2000** distance algorithm in the **CIELAB** color space. 
* Rather than implementing the complex CIEDE2000 math (which contains several trigonometric corrections for hue, lightness, and chroma), GemPixel uses `culori`. It is highly modular, has zero external dependencies, and supports *tree-shaking*. By importing from `culori/fn`, we bundle only the specific color space converters and difference calculators needed:
  ```typescript
  import { differenceCiede2000, parse, rgb, lab } from 'culori/fn';
  ```
  This keeps the final compiled bundle footprint under 5KB for color science utilities.

---

## 5. Architectural Avoidance: What NOT to Use and Why

To maintain a fast, lightweight, and single-file client-side deployment profile, the following libraries are explicitly barred from the project stack:

### ❌ What NOT to Use: Full React (`react` & `react-dom`)
* **Why**: React carries ~45KB of bundle weight and adds runtime virtual DOM reconciler overhead. Since the pixel grid is drawn entirely on Canvas, the DOM tree is very small (sidebar controls and simple tables). Preact's lightweight virtual DOM is a perfect fit.

### ❌ What NOT to Use: Heavy Canvas/Vector Libraries (e.g., Fabric.js, Paper.js)
* **Why**: Visual inspection of the canvas grid needs fast zoom and pan. Standard vector libraries (like Fabric.js) create large object graphs in memory (40,000 individual circles for a $200 \times 200$ canvas). This results in garbage collection spikes, memory bloat, and poor zoom/pan frame rates. A custom, lightweight HTML5 Canvas rendering loop drawn to standard coordinate transformations handles this with maximum performance.

### ❌ What NOT to Use: Third-Party Pan & Zoom Utilities (e.g., `panzoom` npm package)
* **Why**: Canvas zoom and pan are easily implemented in ~50 lines of TypeScript using standard pointer event listeners (`mousedown`, `mousemove`, `mouseup`, `wheel`) mapping offsets to a 2D matrix transformation. Using a generic library wrapper makes it difficult to support **Level-of-Detail (LOD)** rendering:
  * At scale $< 4\times$, render fast solid squares.
  * At scale $4\times - 8\times$, render circles (round drills).
  * At scale $> 8\times$, render circles with centered DMC symbols.
  Custom zoom/pan lets us restrict drawing to only visible elements in the canvas viewport (frustum culling) and selectively skip expensive detail drawing during rapid pan gestures.

### ❌ What NOT to Use: External Image Resizing Libraries (e.g., Jimp, Pica)
* **Why**: Downsampling user photos to target grid dimensions (e.g., $120 \times 160$ pixels) is natively handled by the browser. By drawing the source image to an offscreen canvas at the target size:
  ```typescript
  offscreenCtx.drawImage(imageElement, 0, 0, targetW, targetH);
  const rawPixelData = offscreenCtx.getImageData(0, 0, targetW, targetH).data;
  ```
  We harness GPU-accelerated browser algorithms, yielding near-instant results with zero package weight.

### ❌ What NOT to Use: PDF Generation Libraries (e.g., jsPDF, pdfmake)
* **Why**: Generating PDF supply reports via libraries adds $200\text{KB}+$ of bundle bloat. Instead, GemPixel relies on **CSS print directives** (`@media print`) and native browser printing. By applying print-only CSS classes, calling `window.print()` hides the sidebar controls, formats the supply list as a clean multi-page document, and lets the browser save a high-quality vector PDF natively.

---

## 6. Color Matching Performance Engine

Executing CIEDE2000 calculations for every pixel in a grid is computationally demanding. For a $150 \times 200$ canvas (30,000 pixels) matched against the Art Dot 200 kit (200 colors), the engine runs up to 6 million distance comparisons. The stack incorporates two critical configurations to ensure a smooth, jank-free interface:

1. **Background Web Worker Threading**: The image downsampling outputs a raw `Uint8ClampedArray` (RGBA pixel buffer). GemPixel posts this buffer to a background Web Worker as a **Transferable Object**:
   ```typescript
   worker.postMessage({ pixelBuffer: arrayBuffer, palette: activePalette }, [arrayBuffer]);
   ```
   Transferring the buffer avoids serialization overhead. The Web Worker executes the Culori conversions and returns the matched DMC coordinates without blocking the main UI thread.
2. **RGBA Hash Caching**: Real-world photos contain extensive blocks of identical color pixels (backgrounds, shadows, sky). The Web Worker maintains an in-memory cache map:
   ```typescript
   const matchCache = new Map<number, string>(); // RGBA_integer_hash -> DMC_code
   ```
   For each pixel, the worker hashes the RGBA values. If the hash exists in the cache, the worker bypasses the XYZ $\rightarrow$ Lab conversion and CIEDE2000 comparison loops. This cache resolves up to $75\%$ of pixel checks, keeping color matching under 150ms.

---

## 7. Recommended Vite Configuration

To ensure optimal build output, tree-shaking, and Web Worker loading, the following `vite.config.ts` setup is prescribed:

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  worker: {
    format: 'es',
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        passes: 2,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separate Culori to allow parallel network loading
          if (id.includes('node_modules/culori')) {
            return 'color-science';
          }
        },
      },
    },
  },
});
```
