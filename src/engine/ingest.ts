export interface GridDimensions {
  cols: number;
  rows: number;
}

export interface CropBounds {
  xOffset: number;
  yOffset: number;
  cropWidth: number;
  cropHeight: number;
}

/**
 * Converts physical dimensions (width, height) to grid dots based on the specified unit.
 * - Metric ('cm'): 2.5mm per drill -> 4 dots per cm (10 / 2.5 = 4)
 * - Imperial ('in' or 'inch'): 10 dots per inch
 * All dimensions are rounded to the nearest integer.
 */
export function physicalToGridDimensions(
  width: number,
  height: number,
  unit: 'cm' | 'in' | 'inch'
): GridDimensions {
  let cols: number;
  let rows: number;

  if (unit === 'cm') {
    cols = Math.round(width * 4);
    rows = Math.round(height * 4);
  } else {
    cols = Math.round(width * 10);
    rows = Math.round(height * 10);
  }

  return { cols, rows };
}

/**
 * Calculates the bounding box of the source image to crop,
 * keeping the aspect ratio of the target grid centered on the original image (Cover/Crop mode).
 */
export function calculateCropBounds(
  srcWidth: number,
  srcHeight: number,
  targetCols: number,
  targetRows: number
): CropBounds {
  const arSrc = srcWidth / srcHeight;
  const arTarget = targetCols / targetRows;

  if (arSrc > arTarget) {
    const cropWidth = srcHeight * arTarget;
    return {
      xOffset: Math.floor((srcWidth - cropWidth) / 2),
      yOffset: 0,
      cropWidth: Math.floor(cropWidth),
      cropHeight: srcHeight,
    };
  } else {
    const cropHeight = srcWidth / arTarget;
    return {
      xOffset: 0,
      yOffset: Math.floor((srcHeight - cropHeight) / 2),
      cropWidth: srcWidth,
      cropHeight: Math.floor(cropHeight),
    };
  }
}

/**
 * Downsamples the cropped region of a source image using Box Sampling (Area Averaging).
 * Divides the source cropped bounding box into a grid of targetCols x targetRows cells
 * and averages the RGBA channel values in each cell block.
 */
export function boxSampleImage(
  srcPixels: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  targetCols: number,
  targetRows: number
): Uint8ClampedArray {
  const bounds = calculateCropBounds(srcWidth, srcHeight, targetCols, targetRows);
  const dstPixels = new Uint8ClampedArray(targetCols * targetRows * 4);

  const blockWidth = bounds.cropWidth / targetCols;
  const blockHeight = bounds.cropHeight / targetRows;

  for (let row = 0; row < targetRows; row++) {
    for (let col = 0; col < targetCols; col++) {
      const xStart = Math.min(srcWidth - 1, Math.max(0, Math.floor(col * blockWidth + bounds.xOffset)));
      const xEnd = Math.min(srcWidth, Math.max(xStart + 1, Math.floor((col + 1) * blockWidth + bounds.xOffset)));
      const yStart = Math.min(srcHeight - 1, Math.max(0, Math.floor(row * blockHeight + bounds.yOffset)));
      const yEnd = Math.min(srcHeight, Math.max(yStart + 1, Math.floor((row + 1) * blockHeight + bounds.yOffset)));

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let count = 0;

      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const idx = (y * srcWidth + x) * 4;
          rSum += srcPixels[idx];
          gSum += srcPixels[idx + 1];
          bSum += srcPixels[idx + 2];
          aSum += srcPixels[idx + 3];
          count++;
        }
      }

      const dstIdx = (row * targetCols + col) * 4;
      dstPixels[dstIdx] = Math.round(rSum / count);
      dstPixels[dstIdx + 1] = Math.round(gSum / count);
      dstPixels[dstIdx + 2] = Math.round(bSum / count);
      dstPixels[dstIdx + 3] = Math.round(aSum / count);
    }
  }

  return dstPixels;
}
