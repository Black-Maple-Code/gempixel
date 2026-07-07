<!-- GSD:project-start source:PROJECT.md -->

## Project

**GemPixel**

GemPixel is a client-side utility web application designed for diamond painting/gem art artists. It takes a user-loaded picture and converts it into a grid representation showing how it will look as gem art, matching the image colors to standard Art Dot/DMC manufacturer color indexes (100 and 200 color kits) and custom sub-palettes. It serves as a supply planning tool that outputs the exact color codes and dot counts needed for the canvas.

**Core Value:** Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.

### Constraints

- **Tech Stack**: Vanilla HTML/JavaScript/CSS or a lightweight framework running entirely in-browser.
- **Color Accuracy**: Colors must map to the standard DMC color code system since Art Dot matches DMC numbers.
- **Privacy & Speed**: Run completely in the browser; images should never upload to a server.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## 1. Stack Selection Summary

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

## 2. Core Development Environment & Tooling

### Vite (`^6.0.0`) & TypeScript (`^5.0.0`)

* **Rationale**: Vite is the industry standard for fast frontend development. It features instantaneous hot module replacement (HMR) and relies on ESBuild for rapid compiling. Vite natively supports Web Workers using URL constructors (`new Worker(new URL('./matcher.worker.ts', import.meta.url))`), eliminating worker-bundling configuration hurdles.
* **Why TypeScript**: Executing conversions across three distinct color spaces (sRGB $\rightarrow$ XYZ $\rightarrow$ CIELAB) requires strict validation of data shapes. Typing prevents passing un-normalized sRGB arrays into math functions and enforces clear payload structures between the UI thread and background Web Workers.

## 3. UI Framework & Styling

### Preact (`^10.25.0`) & Tailwind CSS (`^4.0.0`)

* **Rationale**: The core of GemPixel is Canvas-based. However, the app requires a robust UI dashboard to:
* Preact is a drop-in React replacement with a fraction of the bundle weight (~4KB minified + gzipped). It provides clean, state-driven rendering for form fields and tables, keeping UI complexity low while avoiding the performance and bundle size penalties of React.
* Tailwind CSS compiles down to a single optimized utility stylesheet, introducing zero runtime JavaScript and minimal styling overhead.

## 4. Specialized Libraries & APIs

### Color Science: Culori (`^4.0.2`)

* **Rationale**: Raw Euclidean distance in sRGB space ($d = \sqrt{\Delta R^2 + \Delta G^2 + \Delta B^2}$) ignores human visual biology. GemPixel must use the **CIEDE2000** distance algorithm in the **CIELAB** color space. 
* Rather than implementing the complex CIEDE2000 math (which contains several trigonometric corrections for hue, lightness, and chroma), GemPixel uses `culori`. It is highly modular, has zero external dependencies, and supports *tree-shaking*. By importing from `culori/fn`, we bundle only the specific color space converters and difference calculators needed:

## 5. Architectural Avoidance: What NOT to Use and Why

### ❌ What NOT to Use: Full React (`react` & `react-dom`)

* **Why**: React carries ~45KB of bundle weight and adds runtime virtual DOM reconciler overhead. Since the pixel grid is drawn entirely on Canvas, the DOM tree is very small (sidebar controls and simple tables). Preact's lightweight virtual DOM is a perfect fit.

### ❌ What NOT to Use: Heavy Canvas/Vector Libraries (e.g., Fabric.js, Paper.js)

* **Why**: Visual inspection of the canvas grid needs fast zoom and pan. Standard vector libraries (like Fabric.js) create large object graphs in memory (40,000 individual circles for a $200 \times 200$ canvas). This results in garbage collection spikes, memory bloat, and poor zoom/pan frame rates. A custom, lightweight HTML5 Canvas rendering loop drawn to standard coordinate transformations handles this with maximum performance.

### ❌ What NOT to Use: Third-Party Pan & Zoom Utilities (e.g., `panzoom` npm package)

* **Why**: Canvas zoom and pan are easily implemented in ~50 lines of TypeScript using standard pointer event listeners (`mousedown`, `mousemove`, `mouseup`, `wheel`) mapping offsets to a 2D matrix transformation. Using a generic library wrapper makes it difficult to support **Level-of-Detail (LOD)** rendering:

### ❌ What NOT to Use: External Image Resizing Libraries (e.g., Jimp, Pica)

* **Why**: Downsampling user photos to target grid dimensions (e.g., $120 \times 160$ pixels) is natively handled by the browser. By drawing the source image to an offscreen canvas at the target size:

### ❌ What NOT to Use: PDF Generation Libraries (e.g., jsPDF, pdfmake)

* **Why**: Generating PDF supply reports via libraries adds $200\text{KB}+$ of bundle bloat. Instead, GemPixel relies on **CSS print directives** (`@media print`) and native browser printing. By applying print-only CSS classes, calling `window.print()` hides the sidebar controls, formats the supply list as a clean multi-page document, and lets the browser save a high-quality vector PDF natively.

## 6. Color Matching Performance Engine

## 7. Recommended Vite Configuration

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agents/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
