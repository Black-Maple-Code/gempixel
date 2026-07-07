# Phase 1: Core Engine & Color Mathematics - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 4
**Analogs found:** 0 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engine/color.ts` | utility | transform | None (Greenfield) | N/A |
| `src/engine/palette.ts` | config | transform | None (Greenfield) | N/A |
| `src/engine/__tests__/color.test.ts` | test | transform | None (Greenfield) | N/A |
| `scratch/generate-palette.js` | utility | batch | None (Greenfield) | N/A |

---

## Pattern Assignments

Since this is a greenfield project, no code analogs exist in the codebase. Instead, the patterns below are extracted from research decisions and verified library usage patterns in `01-RESEARCH.md`.

### `src/engine/color.ts` (utility, transform)

**Imports & Setup Pattern** (from `01-RESEARCH.md` L53-63):
Import tree-shakable functional methods from `culori/fn` and manually register XYZ and Lab spaces to configure the multi-step conversion pathway.
```typescript
import { useMode, modeRgb, modeXyz65, modeLab, converter, differenceCiede2000 } from 'culori/fn';

// Register color spaces to build the conversion path
const rgb = useMode(modeRgb);
const xyz65 = useMode(modeXyz65);
const lab = useMode(modeLab);

// Prepare automatic conversion to lab
const toLab = converter('lab');
```

**Alpha Blending Pattern** (from `01-RESEARCH.md` L67-72):
Blend transparent or semi-transparent source image pixels with a solid white background color (`#FFFFFF`) prior to color matching.
```typescript
// Target background color is solid white: [255, 255, 255]
// Normalize alpha from [0, 255] to [0.0, 1.0]
const aNormalized = alpha / 255;

const rBlended = r * aNormalized + 255 * (1 - aNormalized);
const gBlended = g * aNormalized + 255 * (1 - aNormalized);
const bBlended = b * aNormalized + 255 * (1 - aNormalized);
```

**Cache Lookup Pattern** (from `01-RESEARCH.md` L74-79):
Map exact raw input RGB values to already-computed DMC matches using a 24-bit bitwise primitive integer to avoid string allocation overhead.
```typescript
const matchCache = new Map<number, DmcColor>();

// Encode RGB into a single 24-bit integer
const key = (r << 16) + (g << 8) + b;
```

**Color Distance & Tie-Breaking Pattern** (from `01-RESEARCH.md` L81-94):
Loop through active color candidates using `differenceCiede2000` distance. Break ties deterministically using a strict inequality (`<`) to return the first matching color found in the reference array.
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

### `src/engine/palette.ts` (config, transform)

**Type Definitions & Structure** (from `01-RESEARCH.md` L103-120):
Define clear types for pre-calculated CIELAB D50 coordinates and reference DMC/Art Dot colors.
```typescript
export interface LabCoordinates {
  l: number;
  a: number;
  b: number;
}

export interface DmcColor {
  dmc: string;         // DMC code (e.g. "310", "BLANC")
  name: string;        // Color descriptive name
  hex: string;         // RGB Hex string (e.g. "#000000")
  r: number;           // Red integer (0-255)
  g: number;           // Green integer (0-255)
  b: number;           // Blue integer (0-255)
  lab: LabCoordinates;   // Precalculated CIELAB D50 coordinates
  kits: ("100" | "200")[]; // Assortment membership tags
}

export const DMC_PALETTE: DmcColor[] = [
  {
    dmc: "310",
    name: "Black",
    hex: "#000000",
    r: 0,
    g: 0,
    b: 0,
    lab: { l: 0, a: 0, b: 0 },
    kits: ["100", "200"]
  },
  // Additional entries...
];
```

---

### `src/engine/__tests__/color.test.ts` (test, transform)

**Vitest Test Suite Structure** (from `01-RESEARCH.md` L131-140):
Validate conversion math, transparency blending, deterministic matching, and stable tie-resolution using Vitest assertion patterns.
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { blendAlpha, matchColor, rgbToLab } from '../color';
import { DMC_PALETTE } from '../palette';

describe('Color Engine Math', () => {
  it('converts sRGB to CIELAB coordinate boundaries within tolerance', () => {
    const blackLab = rgbToLab(0, 0, 0);
    expect(blackLab.l).toBeCloseTo(0, 1);
    expect(blackLab.a).toBeCloseTo(0, 1);
    expect(blackLab.b).toBeCloseTo(0, 1);
  });

  it('blends transparent pixels with solid white background', () => {
    const result = blendAlpha(0, 0, 0, 0); // fully transparent
    expect(result).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('matches RGB values to the nearest DMC code', () => {
    const match = matchColor(0, 0, 0, DMC_PALETTE);
    expect(match.dmc).toBe("310");
  });

  it('resolves equidistant color ties stably using the first match', () => {
    // Inject mock candidate colors equidistant from a test color
    // Assert stable sorting returns the first index
  });
});
```

---

### `scratch/generate-palette.js` (utility, batch)

**Database Compilation Script** (from `01-RESEARCH.md` L148):
A development helper script stored in the scratch workspace directory to load raw manufacturer color maps, run them through Culori's converters, and write the static `src/engine/palette.ts` file.
```javascript
const fs = require('fs');
const path = require('path');
const { useMode, modeRgb, modeXyz65, modeLab, converter } = require('culori/fn');

// Configure Culori conversion pipeline
useMode(modeRgb);
useMode(modeXyz65);
useMode(modeLab);
const toLab = converter('lab');

const rawColors = [
  { dmc: "310", name: "Black", hex: "#000000", kits: ["100", "200"] },
  // ...
];

const processed = rawColors.map(color => {
  const r = parseInt(color.hex.slice(1, 3), 16);
  const g = parseInt(color.hex.slice(3, 5), 16);
  const b = parseInt(color.hex.slice(5, 7), 16);
  
  // Culori expects r, g, b scaled [0.0, 1.0]
  const lab = toLab({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
  
  return {
    ...color,
    r, g, b,
    lab: { l: lab.l, a: lab.a, b: lab.b }
  };
});

// Output code template to src/engine/palette.ts...
```

---

## Shared Patterns

### Manual Color Space Registration
* **Registry Rule**: To optimize bundle size, import explicitly from `culori/fn` and call `useMode()` for `modeRgb`, `modeXyz65`, and `modeLab` before invoking `converter('lab')`.
* **Application**: Applied globally in the color utility module `src/engine/color.ts` and the static palette generator script.

### Pure White Background Composition
* **Alpha Formula**: For any RGBA input, normalize alpha to `[0.0, 1.0]` and blend color components over `#FFFFFF`:
  $$C_{\text{blended}} = C_{\text{pixel}} \times A + 255 \times (1 - A)$$
* **Application**: Applied in the ingestion pipeline and matching preprocessing phase to normalize incoming canvas or pixel data.

---

## No Analog Found

As the project is entirely greenfield, **none of the target files have close analogs in the existing codebase**. 
All source directories are currently empty, requiring complete template setup derived from the documented patterns in `01-RESEARCH.md`.

---

## Metadata

**Analog search scope:** `C:\Users\rickf\.gemini\antigravity\scratch\gempixel`  
**Files scanned:** 1 (`GEMINI.md`)  
**Pattern extraction date:** 2026-07-07  
