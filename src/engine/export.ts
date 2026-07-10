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
 */
export function drawCanvasOnly(options: ExportCanvasOnlyOptions): HTMLCanvasElement {
  const { cols, rows, gridData, colorMap, symbolMap, cellScale = 20 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellScale;
  canvas.height = rows * cellScale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not retrieve 2D drawing context');

  // Disable antialiasing for crisp grid cells
  ctx.imageSmoothingEnabled = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const dmcCode = gridData[idx];
      const color = colorMap.get(dmcCode) || '#FFFFFF';

      const x = c * cellScale;
      const y = r * cellScale;

      // Draw cell backing block
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellScale, cellScale);

      // Draw centered character overlay
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

  // Canvas dimensions (margin/buffer applied symmetrically on all sides)
  const canvasWidth = gridWidth + marginWidth * 2;
  const canvasHeight = innerAreaHeight + marginWidth * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not retrieve 2D drawing context');

  // Paint sheet backing (White background is required for print designs)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Grid offsets centered within the inner content area (buffered by marginWidth)
  const gridOffsetY = marginWidth + Math.floor((innerAreaHeight - gridHeight) / 2);
  const legendOffsetY = marginWidth + Math.floor((innerAreaHeight - legendRequiredHeight) / 2);

  // 1. Render Core Grid Cells
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

  // 2. Draw Margins (split into columns on the right side)
  ctx.textBaseline = 'middle';
  const startX = marginWidth + gridWidth;
  const colSpacing = Math.floor((marginWidth - 25) / numCols); // distribute columns

  allLegendColors.forEach((item, index) => {
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
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(symbol, x + 5, y);

    // Render DMC color label next to swatch
    ctx.fillStyle = '#000000';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.dmc, x + 18, y);
  });

  // 3. Draw Symmetrical Folding dashed guidelines around the grid
  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  // Left vertical guide
  ctx.beginPath();
  ctx.moveTo(marginWidth, 0);
  ctx.lineTo(marginWidth, canvasHeight);
  ctx.stroke();

  // Right vertical guide
  ctx.beginPath();
  ctx.moveTo(marginWidth + gridWidth, 0);
  ctx.lineTo(marginWidth + gridWidth, canvasHeight);
  ctx.stroke();

  // Top horizontal guide
  ctx.beginPath();
  ctx.moveTo(0, gridOffsetY);
  ctx.lineTo(canvasWidth, gridOffsetY);
  ctx.stroke();

  // Bottom horizontal guide
  ctx.beginPath();
  ctx.moveTo(0, gridOffsetY + gridHeight);
  ctx.lineTo(canvasWidth, gridOffsetY + gridHeight);
  ctx.stroke();

  // Reset dashboard configurations
  ctx.setLineDash([]);

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
