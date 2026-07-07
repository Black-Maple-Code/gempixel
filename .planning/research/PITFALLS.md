# GemPixel Project Pitfalls: Color Mapping, Performance, & Rendering

This document identifies major pitfalls in the domain of browser-based image processing, canvas grids, and DMC/Art Dot color mapping. These insights prevent planning mistakes and guide phase-level engineering decisions.

---

## 1. Perceptual Color Matching Failures (RGB Euclidean Distance)

### Description
Calculating color distance using standard Euclidean formula in the sRGB color space ($\sqrt{\Delta R^2 + \Delta G^2 + \Delta B^2}$) does not align with human vision. The human eye is highly sensitive to green and red wavelengths and less sensitive to blue. Using naive RGB distance results in muddy skin tones, loss of detail in shadow regions, and incorrect palette choices (e.g., bright yellow mapping to pale gray instead of cream).

```
Naive RGB Distance:   (R1 - R2)² + (G1 - G2)² + (B1 - B2)²  --> Ignores human eyes
Perceptual CIELAB:   L*, a*, b* Color Space (CIEDE2000)     --> Highly accurate matching
```

### Warning Signs
* Visual inspection reveals mapped grid colors look "off," muddy, or visually discordant (especially in faces or smooth gradients).
* Pastels or highly saturated colors map to starkly incorrect color families (e.g., pale pink maps to white or gray).
* Automated unit tests verify that a color matching function returns "the closest match" mathematically but ignore subjective visual fidelity.

### Prevention Strategy
* **Use CIEDE2000 in CIELAB (L\*a\*b\*) Color Space**: Convert incoming sRGB colors to CIELAB using a standard reference white point (D65) and gamma correction, then compute distances using the CIEDE2000 formula.
* **Pre-Compute & Cache Palette Values**: Converting sRGB to CIELAB and executing CIEDE2000 calculations is mathematically expensive (uses trigonometric functions). Pre-convert and cache all DMC/Art Dot palette colors into CIELAB coordinates at app initialization.
* **Avoid Complex Real-time conversions on UI thread**: Keep the conversion logic pure and lightweight.

### Phase Mapping
* **Phase 1: Core Engine & Color Mathematics**

---

## 2. Main Thread Freezing (UI Thread Blocking)

### Description
Color matching is an $O(N \times M)$ operation, where $N$ is the number of grid cells and $M$ is the size of the target DMC palette. For a typical $150 \times 200$ grid (30,000 cells) matched against the Art Dot 200 palette (200 colors), the engine must perform 6,000,000 color distance calculations. If executed synchronously on the main thread, the browser window will freeze, animations will stutter, and the browser may display a "Page Unresponsive" alert.

### Warning Signs
* The browser UI locks up or becomes laggy for more than 100ms when uploading an image or modifying grid size.
* DevTools performance profiling shows long-running scripting tasks (>50ms) block the main thread.
* Loading spinners or progress bars freeze mid-processing.

### Prevention Strategy
* **Offload to a Web Worker**: Execute the entire pixel scaling, CIELAB conversion, and palette matching logic inside a background Web Worker.
* **Use Transferable Objects**: Pass raw pixel buffers (`Uint8ClampedArray`) to and from the worker via transferables to avoid high-cost serialization/deserialization copies.
* **Progress Reporting**: Emits progress updates (e.g., every 10% completed) from the worker to drive a fluid, non-blocking progress bar on the main UI.

### Phase Mapping
* **Phase 2: Client-side Engine & Worker Architecture**

---

## 3. Rendering Latency & Memory Bloat with Large Canvas Grids

### Description
A grid representation of diamond art contains tens of thousands of drills (e.g., a $200 \times 200$ canvas has 40,000 cells). Naively rendering these as thousands of individual DOM elements (such as SVG nodes or HTML `div` tags) causes memory exhaustion and tab crashes. Similarly, drawing individual shapes (symbols, circle outlines, square backgrounds) onto a standard HTML5 Canvas 2D context using individual drawing commands (`.arc()`, `.rect()`, `.fill()`) on every animation frame during zoom/pan yields sub-10 FPS performance.

### Warning Signs
* Sluggish zoom or pan behavior (< 30 FPS) when exploring the grid.
* High RAM usage (exceeding 150MB for the tab) visible in browser task managers.
* Noticeable delay/flicker when drawing symbols inside grid squares.

### Prevention Strategy
* **Double-Buffering with Offscreen Canvas**: Render the static grid image (colors and symbols) once onto an `OffscreenCanvas` at the full target resolution. During pan/zoom gestures, blit the cached canvas onto the visible canvas using `ctx.drawImage()`, which is a single, GPU-accelerated $O(1)$ operation.
* **Frustum Culling**: When rendering symbols and drill borders in high-detail zoom modes, render only the subset of cells currently within the visible viewport.
* **Dynamic Detail Level (LOD)**: When panning or zooming rapidly, skip drawing symbols and complex drill shapes. Render simple solid-colored pixel blocks, then redraw crisp details (symbols, borders) only after zooming/panning stops (debounced).

### Phase Mapping
* **Phase 3: Canvas Viewer & Zoom/Pan Interaction**

---

## 4. DMC-to-Physical Color Divergence (Hex Code Inconsistencies)

### Description
DMC floss does not have an official RGB or Hex color standard published by the manufacturer. Various online databases (e.g., cyberstitchers, stitchpalettes) define hex codes differently. Using a poor or uncalibrated color database causes visual mismatch where the physical diamond painting drills look drastically different from the screen preview.

### Warning Signs
* Screen preview shows a bright purple, but the physical Art Dot kit drill (matched to the same DMC code) is actually dark navy or brown.
* User reports that completed projects look significantly different in contrast/hue compared to the screen preview.

### Prevention Strategy
* **Curate & Freeze the Palette**: Do not scrape random tables at runtime. Hand-curate and bundle a static, verified DMC-to-RGB conversion table matching standard Art Dot 100/200 kits.
* **Visual Warnings & Code Supremacy**: Emphasize to the user that screen colors are representations only and depend heavily on screen calibration. Ensure that the actual **DMC Code** is printed prominently in the UI and exports as the primary source of truth.
* **Delta-E Dynamic Warnings**: Highlight regions where the matched color has a high delta-E distance (> 5.0) from the target image pixel, warning the user of potential matching inaccuracies.

### Phase Mapping
* **Phase 1: Core Engine & Data Curation**

---

## 5. Underestimating Drill Quantities in Supply Reports

### Description
Providing exact color match counts (e.g., telling the user they need exactly 421 drills of DMC 310) leads to shortages. In physical diamond art, drills are lost, static-damaged, or contain minor manufacturing defects. Additionally, physical drills are purchased or sorted in standard bags (often 200 or 1000 drills per pack).

### Warning Signs
* Customers complain they ran out of drills mid-project.
* Difficulty translating exact counts into purchasing decisions (e.g., not knowing how many bags to buy).

### Prevention Strategy
* **Wastage Buffer Calculations**: Always apply a standard safety margin (typically 10% to 15% extra drills) on top of the exact calculated pixel count.
* **Dual Quantities Reporting**: Show both the raw count (essential for understanding exact composition) and the recommended count (with the safety margin).
* **Package Quantization**: Group counts into physical packaging units (e.g., standard bags of 200 or 1000 drills) to assist in quick inventory checking and purchasing.

### Phase Mapping
* **Phase 4: Supply Planning & Export Reports**

---

## 6. Aspect Ratio Distortion (Warping and Stretching)

### Description
Source images rarely match the target physical canvas dimensions (e.g., a square 1:1 photo mapped onto a 30cm x 40cm rectangular canvas). Naively stretching the image grid to fit the bounds distorts features (e.g., circular faces become elongated ellipses).

### Warning Signs
* Rendered drills look like oblong shapes or grid squares look uneven.
* Stretched or warped objects in the grid preview.

### Prevention Strategy
* **Aspect Ratio Padding or Cropping**: Provide standard scale-to-fit options:
  * **Fit (Letterbox/Pillarbox)**: Pad the edges with blank space to maintain the original aspect ratio.
  * **Fill (Crop)**: Crop the image to match the physical aspect ratio.
  * **Stretch**: Permit distortion but display a prominent warning to the user.
* **Physical Drill Constraint**: Enforce the physical density of 2.5mm per drill (10 drills per inch). The grid rows and columns should always be integer counts calculated from physical dimensions.

### Phase Mapping
* **Phase 2: Grid Scaling & Resizing Logic**

---

## Summary Matrix

| Pitfall | Core Threat | Prevention Key | Implementation Phase |
| :--- | :--- | :--- | :--- |
| **RGB Euclidean Distance** | Muddy, incorrect colors | CIEDE2000 in CIELAB color space | Phase 1: Core Engine & Color Math |
| **Main Thread Blocking** | Browser UI freezing | Web Worker-based math processing | Phase 2: Client-side Engine & Worker |
| **Canvas Render Latency** | Low zoom/pan FPS | Double-buffering & viewport culling | Phase 3: Canvas Viewer & Interaction |
| **Hex Code Inconsistency** | Physical kit color mismatches | Curated static DMC table + code labels | Phase 1: Core Engine & Data Curation |
| **Exact Count Shortages** | Insufficient gem supply | 15% waste buffer + package rounding | Phase 4: Supply Planning & Reports |
| **Aspect Ratio Stretch** | Stretched / warped canvases | Enforce fit/crop tools and 2.5mm sizing | Phase 2: Grid Scaling & Resizing Logic |
