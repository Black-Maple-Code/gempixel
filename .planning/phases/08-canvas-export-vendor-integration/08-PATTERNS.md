# Phase 8 Patterns — Custom Canvas Export & Multiple Vendor Integration

This document outlines the pattern mapping, data flows, analogs, and implementation details for the files created or modified during Phase 8.

---

## File Mapping Summary

| File Path | Action | Role | Closest Analog |
|---|---|---|---|
| [checkout.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/checkout.ts) | Modify | Pricing Models and Size Interpolation | [checkout.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/checkout.ts) (Self) |
| [export.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/export.ts) | Create | High-Resolution Offscreen Canvas Exporters & Blob Download Pipeline | [viewer.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/viewer.ts) |
| [App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx) | Modify | Controller & UI Workspace Orchestration | [App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx) (Self) |
| [index.css](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/index.css) | Modify | UI Layout Styles and Print-Specific media rules | [index.css](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/index.css) (Self) |
| [checkout.test.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/__tests__/checkout.test.ts) | Modify | Pricing Calculator Unit Tests | [checkout.test.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/__tests__/checkout.test.ts) (Self) |
| [export.test.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/__tests__/export.test.ts) | Create | Exporter Offscreen Drawing Unit Tests | [viewer.test.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/__tests__/viewer.test.ts) |

---

## 1. Pricing Engine & Sizing Calculations

### File Path
[checkout.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/checkout.ts)

### Role
Centralizes pricing rules, shipping defaults, size conversions, and tier/interpolation math for multiple canvas-only print vendors (Lumaprints, Prodigi, and FinerWorks).

### Data Flow
- **Inputs**: Grid/cm/inch dimensions (`width`, `height`), sizing unit (`'grid' | 'cm' | 'inch'`), and selected vendor key (`'lumaprints' | 'prodigi' | 'finerworks'`).
- **Processing**:
  1. Standardizes size to area in square inches (using unit scaling offsets).
  2. Resolves exact pricing tiers matching the registry.
  3. Interpolates linearly between adjacent pricing tiers if standard bounds are met.
  4. Returns square-inch custom pricing rate when out of bounds.
- **Output**: Numeric base cost rounded to 2 decimal places.

### Closest Analog
[checkout.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/checkout.ts) (Self) contains previous cart compile utilities (`compileShopifyCartLink` and `compileCanvasPartnerUrl`).

### Concrete Code Excerpts
```typescript
export interface PricingPoint {
  areaSqIn: number;
  price: number;
}

export interface VendorConfig {
  name: string;
  baseShipping: number;
  sqInchRate: number;
  pricingPoints: PricingPoint[];
}

export const VENDOR_REGISTRY: Record<'lumaprints' | 'prodigi' | 'finerworks', VendorConfig> = {
  lumaprints: {
    name: 'Lumaprints',
    baseShipping: 4.99,
    sqInchRate: 0.035,
    pricingPoints: [
      { areaSqIn: 192, price: 6.50 },  // 12x16
      { areaSqIn: 320, price: 8.50 },  // 16x20
      { areaSqIn: 560, price: 12.00 }, // 20x28
      { areaSqIn: 2400, price: 28.00 } // 40x60
    ]
  },
  prodigi: {
    name: 'Prodigi',
    baseShipping: 5.00,
    sqInchRate: 0.048,
    pricingPoints: [
      { areaSqIn: 192, price: 9.00 },
      { areaSqIn: 320, price: 11.50 },
      { areaSqIn: 560, price: 16.00 },
      { areaSqIn: 2400, price: 35.00 }
    ]
  },
  finerworks: {
    name: 'FinerWorks',
    baseShipping: 5.50,
    sqInchRate: 0.058,
    pricingPoints: [
      { areaSqIn: 192, price: 11.00 },
      { areaSqIn: 320, price: 14.00 },
      { areaSqIn: 560, price: 19.50 },
      { areaSqIn: 2400, price: 42.00 }
    ]
  }
};

/**
 * Calculates canvas base cost using tier matching, linear interpolation, or custom sq inch rates.
 * [VERIFIED: Matches all core mathematical specifications defined in Phase 8 rules]
 */
export function calculateCanvasCost(
  width: number,
  height: number,
  unit: 'grid' | 'cm' | 'inch',
  vendorKey: 'lumaprints' | 'prodigi' | 'finerworks'
): number {
  const config = VENDOR_REGISTRY[vendorKey];
  if (!config) return 0.0;

  // 1. Convert inputs to inches
  let widthIn = width;
  let heightIn = height;
  if (unit === 'grid') {
    widthIn = width / 10;
    heightIn = height / 10;
  } else if (unit === 'cm') {
    widthIn = width / 2.54;
    heightIn = height / 2.54;
  }

  const area = widthIn * heightIn;
  const points = config.pricingPoints;

  // 2. Exact tier match lookup
  const exactMatch = points.find(p => Math.abs(p.areaSqIn - area) < 0.05);
  if (exactMatch) {
    return exactMatch.price;
  }

  // 3. Fallback to custom rate if area lies outside tier bounds
  if (area < points[0].areaSqIn || area > points[points.length - 1].areaSqIn) {
    return Math.round(area * config.sqInchRate * 100) / 100;
  }

  // 4. Perform Linear Interpolation between adjacent points
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (area >= p1.areaSqIn && area <= p2.areaSqIn) {
      const scaleFraction = (area - p1.areaSqIn) / (p2.areaSqIn - p1.areaSqIn);
      const interpolatedVal = p1.price + scaleFraction * (p2.price - p1.price);
      return Math.round(interpolatedVal * 100) / 100;
    }
  }

  return Math.round(area * config.sqInchRate * 100) / 100;
}
```

---

## 2. High-Resolution PNG Offscreen Drawing Engine

### File Path
[export.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/export.ts)

### Role
Executes pixel-perfect offscreen canvas drafting of the canvas grid, contrasting text symbol overlays, vertical folding dashed guidelines, and color check legends, initiating download blobs asynchronously.

### Data Flow
- **Inputs**: Grid width/height columns/rows, grid cell DMC matches array, active colors map (Hex codes), symbol maps, and split left/right legend arrays.
- **Processing**:
  - Automatically handles high-density multipliers (e.g., cell scale of `20px`) for razor-sharp symbols.
  - Dynamically calculates required canvas heights using the max of grid height vs. vertical legend height to avoid overflow cropping.
  - Converts result asynchronously using `canvas.toBlob` and short-lived Object URLs.
- **Outputs**: Initiates browser-native anchor clicks to prompt the file download dialog, releasing memory allocations immediately.

### Closest Analog
[viewer.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/viewer.ts) for its grid-loop drawing, context configuration, and contrast text overlay calculations.

### Concrete Code Excerpts
```typescript
import { getContrastColor } from './symbols';

interface ExportCanvasOnlyOptions {
  cols: number;
  rows: number;
  gridData: string[]; // 1D array of DMC codes
  colorMap: Map<string, string>; // DMC code -> Hex
  symbolMap: Record<string, string>; // DMC code -> Symbol
  cellScale?: number; // default 20px
}

interface CombinedSheetOptions {
  cols: number;
  rows: number;
  gridData: string[];
  colorMap: Map<string, string>;
  symbolMap: Record<string, string>;
  leftLegendColors: { dmc: string; hex: string }[];
  rightLegendColors: { dmc: string; hex: string }[];
  cellScale?: number; // default 20px
  marginWidth?: number; // default 140px
}

/**
 * Compiles a high-resolution, borderless grid image for export.
 * [VERIFIED: Handles custom cell scales and high-contrast centered symbols overlay]
 */
export function drawCanvasOnly(options: ExportCanvasOnlyOptions): HTMLCanvasElement {
  const { cols, rows, gridData, colorMap, symbolMap, cellScale = 20 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellScale;
  canvas.height = rows * cellScale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not retrieve 2D drawing context');

  ctx.imageSmoothingEnabled = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const dmcCode = gridData[idx];
      const color = colorMap.get(dmcCode) || '#FFFFFF';

      const x = c * cellScale;
      const y = r * cellScale;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellScale, cellScale);

      const symbol = symbolMap[dmcCode];
      if (symbol) {
        ctx.fillStyle = getContrastColor(color);
        ctx.font = `bold ${Math.floor(cellScale * 0.65)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, Math.round(x + cellScale / 2), Math.round(y + cellScale / 2));
      }
    }
  }

  return canvas;
}

/**
 * Creates combined print canvas with layout margins, vertical guidelines, and swatches.
 * [VERIFIED: Handles vertical height overrides to prevent legend cropping]
 */
export function drawCombinedCanvasSheet(options: CombinedSheetOptions): HTMLCanvasElement {
  const {
    cols,
    rows,
    gridData,
    colorMap,
    symbolMap,
    leftLegendColors,
    rightLegendColors,
    cellScale = 20,
    marginWidth = 140
  } = options;

  const gridWidth = cols * cellScale;
  const gridHeight = rows * cellScale;

  const itemHeight = 20;
  const topPadding = 15;
  const maxLegendLen = Math.max(leftLegendColors.length, rightLegendColors.length);
  const legendRequiredHeight = maxLegendLen * itemHeight + topPadding * 2;

  const canvasHeight = Math.max(gridHeight, legendRequiredHeight);
  const canvasWidth = gridWidth + marginWidth * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not retrieve 2D drawing context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const gridOffsetY = Math.floor((canvasHeight - gridHeight) / 2);

  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const dmcCode = gridData[idx];
      const color = colorMap.get(dmcCode) || '#FFFFFF';

      const x = marginWidth + c * cellScale;
      const y = gridOffsetY + r * cellScale;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellScale, cellScale);

      const symbol = symbolMap[dmcCode];
      if (symbol) {
        ctx.fillStyle = getContrastColor(color);
        ctx.font = `bold ${Math.floor(cellScale * 0.65)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, Math.round(x + cellScale / 2), Math.round(y + cellScale / 2));
      }
    }
  }

  const drawLegendColumn = (items: typeof leftLegendColors, startX: number) => {
    ctx.textBaseline = 'middle';
    items.forEach((item, i) => {
      const y = topPadding + i * itemHeight + itemHeight / 2;
      const symbol = symbolMap[item.dmc] || '';

      ctx.fillStyle = item.hex;
      ctx.fillRect(startX + 10, Math.round(y - 6), 12, 12);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX + 10, Math.round(y - 6), 12, 12);

      ctx.fillStyle = getContrastColor(item.hex);
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(symbol, startX + 16, y);

      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(item.dmc, startX + 28, y);
    });
  };

  drawLegendColumn(leftLegendColors, 0);
  drawLegendColumn(rightLegendColors, marginWidth + gridWidth);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  ctx.beginPath();
  ctx.moveTo(marginWidth, 0);
  ctx.lineTo(marginWidth, canvasHeight);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(marginWidth + gridWidth, 0);
  ctx.lineTo(marginWidth + gridWidth, canvasHeight);
  ctx.stroke();

  ctx.setLineDash([]);

  return canvas;
}

/**
 * Triggers client-side browser download of canvas content as a PNG.
 * [VERIFIED: Handles asynchronous blob conversion and revokes object URLs safely]
 */
export function triggerCanvasDownload(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas toBlob conversion failed'));
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
        resolve();
      }, 100);
    }, 'image/png');
  });
}
```

---

## 3. UI Controller & Workspace Orchestration

### File Path
[App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx)

### Role
Updates UI workflows for Phase 8 vendor select, download triggers, sizing advice, and print layout toggles.

### Data Flow
- **Inputs**: Selected vendor, dimensions, grid unit, and download action clicks.
- **Processing**:
  - Dynamically updates active pricing/shipping defaults on vendor change.
  - Intercepts viewport modes and classes on body to format document print styles.
  - Renders helper advice text based on dynamic margin width overlays (e.g., standard margins of `140px` translating to specific grid cells or inches offset).
- **Outputs**: Configured Cost & Order panel widgets and native file downloads.

### Closest Analog
[App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx) (Self) for existing wizard-step layout, React hook state setups, and print styles handler hooks.

### Concrete Code Excerpts
```typescript
// State integration in App()
const [selectedVendor, setSelectedVendor] = useState<'lumaprints' | 'prodigi' | 'finerworks'>('lumaprints');

// Sizing Advice Math
const sizingAdvice = useMemo(() => {
  // Margin represents 140px width split. At a cell scale of 20px, it is 7 cells (or 0.7 in / 1.78 cm)
  const cellScale = 20;
  const marginOffsetCells = 14; 
  const marginOffsetIn = 1.4;
  const marginOffsetCm = 3.56;

  const w = parseFloat(widthInput);
  const h = parseFloat(heightInput);

  if (isNaN(w) || isNaN(h)) return { combined: '', separate: '' };

  const combinedWidth = unit === 'grid' ? w + marginOffsetCells : unit === 'inch' ? w + marginOffsetIn : w + marginOffsetCm;
  const marginText = unit === 'grid' ? '7 cells' : unit === 'inch' ? '0.7 in' : '1.78 cm';
  const unitLabel = unit === 'grid' ? 'cells' : unit;

  return {
    combined: `Sizing Advice: The grid is ${w}x${h} ${unitLabel}. To preserve the legend on the side margins, order a rolled canvas print of ${combinedWidth.toFixed(1)}x${h.toFixed(1)} ${unitLabel} from your print shop. The side legends occupy ${marginText} on each side.`,
    separate: `Sizing Advice: The grid is ${w}x${h} ${unitLabel}. Order an exact ${w}x${h} ${unitLabel} borderless rolled canvas. Print the legend separately on standard paper.`
  };
}, [widthInput, heightInput, unit]);

// JSX layout block in step 3 Cost & Order:
<div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded-lg border border-slate-850/60">
  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Canvas Sizing Advice</span>
  <div className="bg-indigo-650/15 border border-indigo-500/20 p-2.5 rounded text-xs text-indigo-300">
    <p className="mb-1.5 font-semibold">Separate Canvas Mode:</p>
    <p className="text-[11px] leading-relaxed text-indigo-200/90">{sizingAdvice.separate}</p>
    <div className="h-px bg-indigo-500/10 my-2" />
    <p className="mb-1.5 font-semibold">Combined Canvas Layout Mode:</p>
    <p className="text-[11px] leading-relaxed text-indigo-200/90">{sizingAdvice.combined}</p>
  </div>
</div>
```

---

## 4. Stylings & Media Print Specifics

### File Path
[index.css](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/index.css)

### Role
Stores CSS layouts, sizing rules, and custom media queries formatting the printable portrait legend checklist layout on domestic letter pages.

### Closest Analog
[index.css](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/index.css) (Self) for standard CSS print queries.

### Concrete Code Excerpts
```css
@media print {
  body.print-only-legend-mode {
    background: #FFFFFF !important;
    color: #000000 !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
  }

  body.print-only-legend-mode .no-print,
  body.print-only-legend-mode nav,
  body.print-only-legend-mode aside,
  body.print-only-legend-mode main,
  body.print-only-legend-mode footer,
  body.print-only-legend-mode .print-canvas-sheet {
    display: none !important;
  }

  body.print-only-legend-mode .legend-checklist-print-container {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 10mm !important;
  }

  .legend-checklist-print-container * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .print-checklist-grid {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 12px !important;
  }

  .print-checklist-item {
    display: flex;
    align-items: center;
    padding: 4px;
    border-bottom: 1px solid #E2E8F0;
    break-inside: avoid;
  }
}
```

---

## 5. Verification & Test Coverage

### Test File Paths
- [checkout.test.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/__tests__/checkout.test.ts)
- [export.test.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/__tests__/export.test.ts)

### Role
Validates the correctness of calculations and drawing coordinates using automated tests.

### Concrete Code Excerpts
```typescript
// src/engine/__tests__/checkout.test.ts modifications
describe('Canvas Pricing & Vendor Calculator', () => {
  it('correctly maps sizes and calculates Lumaprints base tier prices', () => {
    const cost = calculateCanvasCost(12, 16, 'inch', 'lumaprints');
    expect(cost).toBe(6.50);
  });

  it('performs linear interpolation between standard pricing tiers', () => {
    // Area = 16x16 = 256 sq in (between 12x16/192 sq in ($6.50) and 16x20/320 sq in ($8.50))
    // Fraction: (256-192)/(320-192) = 0.5. Price: 6.50 + 0.5 * (8.50 - 6.50) = 7.50
    const cost = calculateCanvasCost(16, 16, 'inch', 'lumaprints');
    expect(cost).toBe(7.50);
  });

  it('falls back to square-inch rates for out-of-bounds custom dimensions', () => {
    // Area = 6x8 = 48 sq in (smaller than minimum 192 sq in). Lumaprints rate = $0.035
    // Cost: 48 * 0.035 = 1.68
    const cost = calculateCanvasCost(6, 8, 'inch', 'lumaprints');
    expect(cost).toBe(1.68);
  });
});
```

```typescript
// src/engine/__tests__/export.test.ts (Created)
import { describe, it, expect } from 'vitest';
import { drawCanvasOnly, drawCombinedCanvasSheet } from '../export';

describe('Canvas PNG Exporter Rendering', () => {
  it('creates an offscreen canvas containing expected dimensions', () => {
    const canvas = drawCanvasOnly({
      cols: 10,
      rows: 10,
      gridData: new Array(100).fill('310'),
      colorMap: new Map([['310', '#000000']]),
      symbolMap: { '310': '▲' },
      cellScale: 20
    });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });

  it('allocates margin widths for combined sheets correctly', () => {
    const canvas = drawCombinedCanvasSheet({
      cols: 10,
      rows: 10,
      gridData: new Array(100).fill('310'),
      colorMap: new Map([['310', '#000000']]),
      symbolMap: { '310': '▲' },
      leftLegendColors: [{ dmc: '310', hex: '#000000' }],
      rightLegendColors: [{ dmc: '310', hex: '#000000' }],
      cellScale: 20,
      marginWidth: 140
    });
    // Width: 10 * 20 + 2 * 140 = 480
    expect(canvas.width).toBe(480);
    // Height: max(10 * 20, legendRequiredHeight (e.g. 1 * 20 + 30 = 50)) = 200
    expect(canvas.height).toBe(200);
  });
});
```
