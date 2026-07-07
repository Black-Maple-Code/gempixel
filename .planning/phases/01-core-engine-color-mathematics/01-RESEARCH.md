# Phase 01 Research: Core Engine & Color Mathematics

## User Constraints

### Locked Decisions (verbatim from 01-CONTEXT.md)
*   **Color Science Library Integration**
    *   **D-01:** Import tree-shakable functions from `culori/fn` and register modes manually to optimize bundle size.
    *   **D-02:** Blend transparent and semi-transparent pixels with a solid white background color (`#FFFFFF`) before color matching.
    *   **D-03:** Use an exact in-memory `Map` cache mapping raw RGB integers to matched DMC colors, cleared at the start of each matching run.
    *   **D-04:** Use Culori's built-in automatic multi-step converter by registering `modeRgb`, `modeXyz`, `modeLab`, and calling `converter('lab')`.
*   **Static Color Index Storage & Format**
    *   **D-05:** Compile color indexes directly into a TypeScript file as constants, bundling them with the application for instant loading and zero network fetch overhead.
    *   **D-06:** Store DMC color codes as strings (e.g., `"310"`, `"BLANC"`, `"ECRU"`) to faithfully preserve official DMC names and designations.
    *   **D-07:** Structure the Art Dot 100-color and 200-color datasets as a single unified catalog containing all unique colors, with membership metadata (e.g. `kits: ["100", "200"]`) to prevent duplication and streamline lookups.
    *   **D-08:** Store both RGB hex codes (for drawing the canvas UI) and pre-calculated CIELAB L/a/b coordinates in the compiled color index to avoid converting reference colors during matching runs.
*   **Matching Logic & Extensibility**
    *   **D-09:** Design matching functions to accept flat, serializable inputs (e.g., flat `Uint8ClampedArray` for image data, array of active DMC codes) to make integration with Web Workers seamless.
    *   **D-10:** Pre-filter the reference color index before entering the matching loop, passing only active color candidates to the distance-matching algorithm.
    *   **D-11:** Resolve rare color ties (when two DMC colors are equidistant to a target pixel) by picking the first encountered color in the reference array (stable matching) to ensure deterministic outcomes and high performance.
    *   **D-12:** Return a flat array of matched DMC codes corresponding to grid cell positions, along with a separate aggregated count summary object for supplies.

### Discretion Areas
*   None. All key gray areas were discussed and decided.

### Deferred Ideas
*   None.

---

## Project Constraints (from GEMINI.md)

*   **Tech Stack**: Vanilla HTML/JavaScript/CSS or a lightweight framework running entirely in-browser. [CITED: GEMINI.md:L13]
*   **Language**: TypeScript (`^5.0.0`) for static typing of color models (RGB, XYZ, Lab). [CITED: GEMINI.md:L28]
*   **Color Science Library**: Culori (`^4.0.2`) to calculate CIEDE2000 distance in CIELAB color space. [CITED: GEMINI.md:L31]
*   **Architectural Avoidance**:
    *   ❌ Do NOT use full React (`react` & `react-dom`). Use Preact (`^10.25.0`) instead. [CITED: GEMINI.md:L61]
    *   ❌ Do NOT use heavy Canvas/Vector libraries (e.g. Fabric.js, Paper.js). Use custom Canvas 2D loops. [CITED: GEMINI.md:L65]
    *   ❌ Do NOT use third-party pan/zoom utility libraries. Implement standard pointer event transformations. [CITED: GEMINI.md:L69]
    *   ❌ Do NOT use external image resizing libraries. Use offscreen canvas drawings. [CITED: GEMINI.md:L73]
    *   ❌ Do NOT use PDF generation libraries (e.g. jsPDF). Use CSS print layouts and `window.print()`. [CITED: GEMINI.md:L77]
*   **GSD Workflow Enforcement**: Always run phase commands through the GSD runner to keep planning and execution in sync. [CITED: GEMINI.md:L110]

---

## Technical Domain Research

### 1. Color Science & Culori Integration

#### A. Manual Mode Registration with `culori/fn`
To enable manual registration and tree-shaking for bundle size optimization, we import explicitly from the functional namespace `culori/fn`. `culori` relies on an internal registry. In order for the automatic converter to map from `rgb` to `lab`, it needs the intermediate standard transition spaces registered. 
The standard sRGB-to-CIELAB conversion path goes from sRGB (D65 white point) through XYZ (D65 or D50) to CIELAB (D50 white point). In Culori, the modes are registered via `useMode` [CITED: culorijs.org]:

```typescript
import { useMode, modeRgb, modeXyz65, modeLab, converter, differenceCiede2000 } from 'culori/fn';

// Register color spaces to build the conversion path
const rgb = useMode(modeRgb);
const xyz65 = useMode(modeXyz65);
const lab = useMode(modeLab);

// Prepare automatic conversion to lab
const toLab = converter('lab');
```

By manually registering `modeRgb`, `modeXyz65`, and `modeLab`, Culori resolves the multi-step transformation path using the D65 standard for sRGB and performs Bradford chromatic adaptation to D50 for CIELAB [ASSUMED].

#### B. Alpha Blending Equation
For transparent and semi-transparent pixels, standard alpha composition must be performed over solid white `#FFFFFF` (RGB: `[255, 255, 255]`) before converting to CIELAB. The formulas are [ASSUMED]:
$$R_{\text{blended}} = R_{\text{pixel}} \times A_{\text{pixel}} + 255 \times (1 - A_{\text{pixel}})$$
$$G_{\text{blended}} = G_{\text{pixel}} \times A_{\text{pixel}} + 255 \times (1 - A_{\text{pixel}})$$
$$B_{\text{blended}} = B_{\text{pixel}} \times A_{\text{pixel}} + 255 \times (1 - A_{\text{pixel}})$$
where $A_{\text{pixel}} = \frac{\text{alpha}}{255}$ (normalized from the range $[0, 255]$ to $[0.0, 1.0]$).

#### C. Exact Color Cache Optimization
To bypass expensive distance calculations, we map raw input RGB values to matched DMC color objects. Combining the red, green, and blue bytes into a single 24-bit primitive integer avoids string allocation overhead and is highly optimized by JS virtual engines [ASSUMED]:
$$\text{RGB\_Integer} = (R \ll 16) + (G \ll 8) + B$$
```typescript
const matchCache = new Map<number, DmcColor>();
```

#### D. Color Tie-Breaker Logic
To ensure deterministic results, when multiple DMC colors are equidistant (rare tie), we maintain a strict inequality check (`<` rather than `<=`) which preserves the first encountered color in the reference array (stable matching) [ASSUMED]:
```typescript
let minDistance = Infinity;
let bestMatch: DmcColor | null = null;

for (const candidate of activeCandidates) {
  const dist = differenceCiede2000(pixelLab, candidate.lab);
  if (dist < minDistance) {
    minDistance = dist;
    bestMatch = candidate;
  }
}
```

---

### 2. Unified Static Catalog Schema

To prevent duplicate references and support custom sub-palette queries, standard DMC and Art Dot colors are stored in a unified database. Each color has precalculated CIELAB coordinates to prevent redundant conversions during matching loops [ASSUMED].

#### A. TypeScript Interfaces
```typescript
export interface LabCoordinates {
  l: number;
  a: number;
  b: number;
}

export interface DmcColor {
  dmc: string;       // DMC code (e.g. "310", "BLANC")
  name: string;      // Color descriptive name
  hex: string;       // RGB Hex string (e.g. "#000000")
  r: number;         // Red integer (0-255)
  g: number;         // Green integer (0-255)
  b: number;         // Blue integer (0-255)
  lab: LabCoordinates; // Precalculated CIELAB D50 coordinates
  kits: ("100" | "200")[]; // Assortment membership tags
}
```

#### B. Sourcing Kit Data and Hex calibration
*   **DMC Numbers**: Standard embroidery floss and diamond painting charts match identically. Color codes include numbers ($150 - 3866$) and text keys (`"BLANC"`, `"ECRU"`) [CITED: artdot.com].
*   **Overlaps**: The database is filtered at runtime to candidates where `kits.includes(selectedKit)` [ASSUMED].
*   **DMC Color Calibration Gaps**: Digital hex values for DMC colors are not officially published by DMC. Different community databases (e.g., `adrianj/CrossStitchCreator` vs. `seanockert/rgb-to-dmc`) have minor hex variances (e.g., Ecru ranges from `#fff7e7` to `#f0eada`) [VERIFIED: npm registry]. We will freeze a hand-calibrated subset mapping standard RGB hex and precalculate coordinates using Culori.

---

### 3. Test Strategy & Verification

#### A. Automated Unit Testing (Vitest)
Unit tests will verify:
1.  **sRGB to CIELAB Conversion accuracy**: Check conversion coordinates against known standard samples (e.g. Pure Black `#000000` $\rightarrow L^*=0, a^*=0, b^*=0$; Pure White `#FFFFFF` $\rightarrow L^* \approx 100$).
2.  **Alpha Blending correctness**: Test that transparent inputs (`r=0, g=0, b=0, a=0`) blend perfectly to white (`r=255, g=255, b=255`) and semi-transparent colors scale correctly.
3.  **Color Matching Determinism**: Verify that specific hex colors map to their exact DMC color codes within reasonable thresholds (e.g., `#000000` matches `"310"`, `#ffffff` matches `"BLANC"` or `"White"`).
4.  **Tie Resolution Stability**: Verify that equal distances preserve the first candidate in the array.

#### B. Acceptance Tolerances
*   **CIELAB Coordinates**: Tolerance within $\pm 0.05$ units of Culori's reference outputs to account for rounding.
*   **CIEDE2000 Distance**: $\Delta E_{00}$ distance calculations must match Culori's reference outputs exactly. (Values $\Delta E_{00} < 1.0$ are considered imperceptible to the human eye, while values between $1.0 - 2.0$ are barely perceptible under close study).

---

## Recommendations for Phase 1 Plan

1.  **Workspace Recommendation**: Set `C:\Users\rickf\.gemini\antigravity\scratch\gempixel` as the active workspace in the editor [CITED: User Info].
2.  **Vitest Setup**: Install `vitest` [ASSUMED] as a devDependency to execute math tests.
3.  **Build Database Script**: Include a small, local compilation script (`scratch/generate-palette.js`) in `C:\Users\rickf\.gemini\antigravity\brain\98bc3d30-5f37-4da0-bfd6-5e246ee436b4/scratch/` that converts raw RGB parameters to CIELAB coordinates using Culori and prints a clean, copy-pasteable TypeScript catalog file (`src/engine/palette.ts`).
4.  **Unit Tests**: Establish unit tests in `src/engine/__tests__/color.test.ts` checking conversion matrices, blending logic, caching maps, and matching queries.
