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
    marginWidth = 140
  } = options;

  const gridWidth = cols * cellScale;
  const gridHeight = rows * cellScale;

  // Determine required vertical legend spacing
  const itemHeight = 20;
  const topPadding = 15;
  const maxLegendLen = Math.max(leftLegendColors.length, rightLegendColors.length);
  const legendRequiredHeight = maxLegendLen * itemHeight + topPadding * 2;

  // Apply maximum buffer to avoid legend cropping
  const canvasHeight = Math.max(gridHeight, legendRequiredHeight);
  const canvasWidth = gridWidth + marginWidth * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not retrieve 2D drawing context');

  // Paint sheet backing (White background is required for print designs)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Center canvas grid vertically
  const gridOffsetY = Math.floor((canvasHeight - gridHeight) / 2);

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

  // Helper routine to render margin listing
  const drawLegendColumn = (items: typeof leftLegendColors, startX: number) => {
    ctx.textBaseline = 'middle';
    items.forEach((item, i) => {
      const y = topPadding + i * itemHeight + itemHeight / 2;
      const symbol = symbolMap[item.dmc] || '';

      // Draw Swatch Border & Color Backing
      ctx.fillStyle = item.hex;
      ctx.fillRect(startX + 10, Math.round(y - 6), 12, 12);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX + 10, Math.round(y - 6), 12, 12);

      // Center Symbol inside swatch
      ctx.fillStyle = getContrastColor(item.hex);
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(symbol, startX + 16, y);

      // Render DMC color label next to swatch
      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(item.dmc, startX + 28, y);
    });
  };

  // 2. Draw Margins
  drawLegendColumn(leftLegendColors, 0);
  drawLegendColumn(rightLegendColors, marginWidth + gridWidth);

  // 3. Draw Vertical Folding dashed guidelines
  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  // Left Guide
  ctx.beginPath();
  ctx.moveTo(marginWidth, 0);
  ctx.lineTo(marginWidth, canvasHeight);
  ctx.stroke();

  // Right Guide
  ctx.beginPath();
  ctx.moveTo(marginWidth + gridWidth, 0);
  ctx.lineTo(marginWidth + gridWidth, canvasHeight);
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
