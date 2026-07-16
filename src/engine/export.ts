import { getContrastColor, symbolFontPx } from './symbols';

/** White wrap-margin (in grid cells) applied around the combined legend sheet. */
const OUTER_MARGIN_CELLS = 3;

/**
 * Physical blank gap between the grid picture and the legend column, so a framer
 * can wrap a border over the artwork edge without covering the color key. A drill
 * cell is one dot at 10 dots/inch = 2.54mm, so 3cm ≈ 11.8 cells; at `cellScale`
 * px/cell that is `3 / 0.254 * cellScale` px.
 */
const LEGEND_GAP_CM = 3;
const CM_PER_CELL = 0.254; // 2.54mm per drill (10 dots/inch)
const legendGapPx = (cellScale: number) => Math.round((LEGEND_GAP_CM / CM_PER_CELL) * cellScale);

/**
 * Wider white wrap-margin (in grid cells) for the standalone Canvas Grid PNG.
 * At 10 dots/inch this is ~2 inches per side — enough blank canvas for a framer
 * to gallery-wrap / stretch the finished piece. Exported so the sizing advice
 * can recommend a matching rolled-canvas order size.
 */
export const FRAMER_MARGIN_CELLS = 20;

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
 */
export function drawCanvasOnly(options: ExportCanvasOnlyOptions): HTMLCanvasElement {
  const { cols, rows, gridData, colorMap, symbolMap, cellScale = 20 } = options;

  // Generous white framer wrap margin around the grid.
  const outerMargin = FRAMER_MARGIN_CELLS * cellScale;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellScale + outerMargin * 2;
  canvas.height = rows * cellScale + outerMargin * 2;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not retrieve 2D drawing context');

  // Paint white margin backing
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Disable antialiasing for crisp grid cells
  ctx.imageSmoothingEnabled = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const dmcCode = gridData[idx];
      const color = colorMap.get(dmcCode) || '#FFFFFF';

      const x = outerMargin + c * cellScale;
      const y = outerMargin + r * cellScale;

      // Draw cell backing block
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellScale, cellScale);

      // Draw centered character overlay
      const symbol = symbolMap[dmcCode];
      if (symbol) {
        ctx.fillStyle = getContrastColor(color);
        ctx.font = `bold ${symbolFontPx(Math.floor(cellScale * 0.65), symbol)}px 'Archivo Variable', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, Math.round(x + cellScale / 2), Math.round(y + cellScale / 2));
      }
    }
  }

  return canvas;
}

/** Options for the additive standalone-legend renderer (Phase-26 D-05). */
interface LegendOnlyOptions {
  leftLegendColors: { dmc: string; hex: string }[];
  rightLegendColors: { dmc: string; hex: string }[];
  symbolMap: Record<string, string>;
  cellScale?: number; // accepted for call-site symmetry; the legend band is grid-independent
}

/**
 * Shared per-item legend draw: color swatch backing, black stroke, contrast symbol,
 * and 9px monospace DMC label. Called by BOTH `drawCombinedCanvasSheet` and
 * `drawLegendOnly` so the two legend renderings stay in sync. Internal only — not
 * exported and does not alter any exported signature (Phase-22 freeze / D-05).
 */
function drawLegendItems(
  ctx: CanvasRenderingContext2D,
  legendColors: { dmc: string; hex: string }[],
  symbolMap: Record<string, string>,
  metrics: {
    itemsPerCol: number;
    itemHeight: number;
    topPadding: number;
    startX: number;
    colSpacing: number;
    legendOffsetY: number;
  }
): void {
  const { itemsPerCol, itemHeight, topPadding, startX, colSpacing, legendOffsetY } = metrics;

  legendColors.forEach((item, index) => {
    const colIdx = Math.floor(index / itemsPerCol);
    const rowIdx = index % itemsPerCol;

    const x = startX + 10 + colIdx * colSpacing;
    const y = legendOffsetY + topPadding + rowIdx * itemHeight + itemHeight / 2;
    const symbol = symbolMap[item.dmc] || '';

    // Draw Swatch Border & Color Backing
    ctx.fillStyle = item.hex;
    ctx.fillRect(x, Math.round(y - 5), 10, 10);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, Math.round(y - 5), 10, 10);

    // Center Symbol inside swatch
    ctx.fillStyle = getContrastColor(item.hex);
    ctx.font = `bold ${symbolFontPx(8, symbol)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(symbol, x + 5, y);

    // Render DMC color label next to swatch
    ctx.fillStyle = '#000000';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.dmc, x + 18, y);
  });
}

/**
 * Creates combined print canvas with layout margins, vertical guidelines, and swatches.
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
    marginWidth = 200
  } = options;

  const gridWidth = cols * cellScale;
  const gridHeight = rows * cellScale;

  // Combine both legend arrays into a single list
  const allLegendColors = [...leftLegendColors, ...rightLegendColors];
  const totalColors = allLegendColors.length;

  // Determine number of columns (2 or 3)
  const numCols = totalColors > 40 ? 3 : 2;
  const itemsPerCol = Math.ceil(totalColors / numCols);

  const itemHeight = 18;
  const topPadding = 15;
  const legendRequiredHeight = itemsPerCol * itemHeight + topPadding * 2;

  // Inner height of content (grid vs legend)
  const innerAreaHeight = Math.max(gridHeight, legendRequiredHeight);

  // Extra white wrap margin around the whole sheet (matches drawCanvasOnly).
  const outerMargin = OUTER_MARGIN_CELLS * cellScale;

  // 3cm of blank canvas between the grid and the legend (border/frame room).
  const legendGap = legendGapPx(cellScale);

  // Canvas dimensions (blank left margin + grid + legend gap + legend margin +
  // outer white margin on all sides). The gap is added only on the legend side.
  const canvasWidth = gridWidth + marginWidth * 2 + outerMargin * 2 + legendGap;
  const canvasHeight = innerAreaHeight + marginWidth * 2 + outerMargin * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not retrieve 2D drawing context');

  // Paint sheet backing (White background is required for print designs)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Grid offsets centered within the inner content area (buffered by margins)
  const gridOffsetY = outerMargin + marginWidth + Math.floor((innerAreaHeight - gridHeight) / 2);
  const legendOffsetY = outerMargin + marginWidth + Math.floor((innerAreaHeight - legendRequiredHeight) / 2);

  // 1. Render Core Grid Cells
  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const dmcCode = gridData[idx];
      const color = colorMap.get(dmcCode) || '#FFFFFF';

      const x = outerMargin + marginWidth + c * cellScale;
      const y = gridOffsetY + r * cellScale;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellScale, cellScale);

      const symbol = symbolMap[dmcCode];
      if (symbol) {
        ctx.fillStyle = getContrastColor(color);
        ctx.font = `bold ${symbolFontPx(Math.floor(cellScale * 0.65), symbol)}px 'Archivo Variable', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, Math.round(x + cellScale / 2), Math.round(y + cellScale / 2));
      }
    }
  }

  // 2. Draw Margins (split into columns on the right side), pushed past the 3cm
  //    blank gap so the color key never sits on the framer's border allowance.
  ctx.textBaseline = 'middle';
  const startX = outerMargin + marginWidth + gridWidth + legendGap;
  const colSpacing = Math.floor((marginWidth - 25) / numCols); // distribute columns

  drawLegendItems(ctx, allLegendColors, symbolMap, {
    itemsPerCol,
    itemHeight,
    topPadding,
    startX,
    colSpacing,
    legendOffsetY
  });

  // 3. Draw Symmetrical Folding dashed guidelines around the grid
  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  const guideTop = outerMargin;
  const guideBottom = canvasHeight - outerMargin;
  const guideLeft = outerMargin;
  const guideRight = canvasWidth - outerMargin;
  const gridLeftX = outerMargin + marginWidth;
  const gridRightX = outerMargin + marginWidth + gridWidth;

  // Left vertical guide
  ctx.beginPath();
  ctx.moveTo(gridLeftX, guideTop);
  ctx.lineTo(gridLeftX, guideBottom);
  ctx.stroke();

  // Right vertical guide
  ctx.beginPath();
  ctx.moveTo(gridRightX, guideTop);
  ctx.lineTo(gridRightX, guideBottom);
  ctx.stroke();

  // Top horizontal guide
  ctx.beginPath();
  ctx.moveTo(guideLeft, gridOffsetY);
  ctx.lineTo(guideRight, gridOffsetY);
  ctx.stroke();

  // Bottom horizontal guide
  ctx.beginPath();
  ctx.moveTo(guideLeft, gridOffsetY + gridHeight);
  ctx.lineTo(guideRight, gridOffsetY + gridHeight);
  ctx.stroke();

  // Reset dashboard configurations
  ctx.setLineDash([]);

  return canvas;
}

/**
 * Renders ONLY the color legend band as its own borderless HTMLCanvasElement — the
 * same swatch / symbol / label the combined sheet draws, sized to the legend alone
 * (no grid, no margins, no folding guides). Additive export (Phase-26 D-05); it does
 * not touch any Phase-22-frozen renderer signature and downloads through
 * `triggerCanvasDownload` unchanged.
 */
export function drawLegendOnly(options: LegendOnlyOptions): HTMLCanvasElement {
  const { leftLegendColors, rightLegendColors, symbolMap } = options;

  // Combine both legend arrays into a single list (identical to the combined sheet).
  const allLegendColors = [...leftLegendColors, ...rightLegendColors];
  const totalColors = allLegendColors.length;

  // Legend column metrics — SAME rules as drawCombinedCanvasSheet.
  const numCols = totalColors > 40 ? 3 : 2;
  const itemsPerCol = Math.ceil(totalColors / numCols);
  const itemHeight = 18;
  const topPadding = 15;

  // Band geometry: swatch (10px) sits at x+10, DMC label at x+18. A 70px column
  // comfortably fits a 4-digit "9px monospace" code; 10px padding on each side.
  const colSpacing = 70;
  const sidePadding = 10;

  // Size the canvas to the legend band ONLY — never the grid-inclusive width.
  const canvasWidth = numCols * colSpacing + sidePadding * 2;
  const canvasHeight = itemsPerCol * itemHeight + topPadding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not retrieve 2D drawing context');

  // Paint white backing (print designs require an opaque white ground).
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.textBaseline = 'middle';
  drawLegendItems(ctx, allLegendColors, symbolMap, {
    itemsPerCol,
    itemHeight,
    topPadding,
    startX: 0,
    colSpacing,
    legendOffsetY: 0
  });

  return canvas;
}

/**
 * Triggers client-side browser download of canvas content as a PNG.
 */
export function triggerCanvasDownload(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas toBlob conversion failed'));
        return;
      }

      // Generate object URL pointer
      const downloadUrl = URL.createObjectURL(blob);

      // Construct temporary anchor tag
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;

      // Mount, trigger, and unmount
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      // Defer revocation to guarantee execution has started in the download thread
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
        resolve();
      }, 100);
    }, 'image/png');
  });
}
