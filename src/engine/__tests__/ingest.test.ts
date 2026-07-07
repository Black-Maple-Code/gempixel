import { describe, it, expect } from 'vitest';
import { physicalToGridDimensions, calculateCropBounds, boxSampleImage } from '../ingest';

describe('Ingestion & Sizing Logic', () => {
  describe('physicalToGridDimensions', () => {
    it('converts metric (cm) dimensions based on 2.5mm per drill (4 dots/cm) and rounds to nearest integer', () => {
      // 10 cm * 4 = 40 dots
      // 20 cm * 4 = 80 dots
      expect(physicalToGridDimensions(10, 20, 'cm')).toEqual({ cols: 40, rows: 80 });

      // Decimal values:
      // 10.1 cm * 4 = 40.4 -> 40 dots
      // 10.2 cm * 4 = 40.8 -> 41 dots
      // 20.3 cm * 4 = 81.2 -> 81 dots
      // 20.4 cm * 4 = 81.6 -> 82 dots
      expect(physicalToGridDimensions(10.1, 20.3, 'cm')).toEqual({ cols: 40, rows: 81 });
      expect(physicalToGridDimensions(10.2, 20.4, 'cm')).toEqual({ cols: 41, rows: 82 });
    });

    it('converts imperial (inches) dimensions based on 10 dots per inch and rounds to nearest integer', () => {
      // 10 in * 10 = 100 dots
      // 20 in * 10 = 200 dots
      expect(physicalToGridDimensions(10, 20, 'in')).toEqual({ cols: 100, rows: 200 });
      expect(physicalToGridDimensions(10, 20, 'inch')).toEqual({ cols: 100, rows: 200 });

      // Decimal values:
      // 10.24 in * 10 = 102.4 -> 102 dots
      // 10.26 in * 10 = 102.6 -> 103 dots
      // 20.74 in * 10 = 207.4 -> 207 dots
      // 20.76 in * 10 = 207.6 -> 208 dots
      expect(physicalToGridDimensions(10.24, 20.74, 'in')).toEqual({ cols: 102, rows: 207 });
      expect(physicalToGridDimensions(10.26, 20.76, 'inch')).toEqual({ cols: 103, rows: 208 });
    });
  });

  describe('calculateCropBounds (Cover/Crop aspect ratio preservation)', () => {
    it('centers crop horizontally when source image is wider than target grid aspect ratio', () => {
      // Source AR = 200 / 100 = 2
      // Target AR = 10 / 10 = 1
      // Since Source AR > Target AR, we crop horizontally.
      // cropWidth = srcHeight * targetAR = 100 * 1 = 100
      // cropHeight = srcHeight = 100
      // xOffset = (srcWidth - cropWidth) / 2 = (200 - 100) / 2 = 50
      // yOffset = 0
      const bounds = calculateCropBounds(200, 100, 10, 10);
      expect(bounds).toEqual({
        xOffset: 50,
        yOffset: 0,
        cropWidth: 100,
        cropHeight: 100,
      });
    });

    it('centers crop vertically when source image is taller than target grid aspect ratio', () => {
      // Source AR = 100 / 200 = 0.5
      // Target AR = 10 / 10 = 1
      // Since Source AR < Target AR, we crop vertically.
      // cropWidth = srcWidth = 100
      // cropHeight = srcWidth / targetAR = 100 / 1 = 100
      // xOffset = 0
      // yOffset = (srcHeight - cropHeight) / 2 = (200 - 100) / 2 = 50
      const bounds = calculateCropBounds(100, 200, 10, 10);
      expect(bounds).toEqual({
        xOffset: 0,
        yOffset: 50,
        cropWidth: 100,
        cropHeight: 100,
      });
    });

    it('returns exact dimensions with zero offset when source and target aspect ratios match', () => {
      const bounds = calculateCropBounds(300, 200, 30, 20);
      expect(bounds).toEqual({
        xOffset: 0,
        yOffset: 0,
        cropWidth: 300,
        cropHeight: 200,
      });
    });
  });

  describe('boxSampleImage (Area Averaging)', () => {
    it('correctly aggregates blocks of pixel data and averages color channels without empty divisions', () => {
      // Create a 4x4 mock pixel array (4 channels per pixel: RGBA)
      // Block 1 (top-left 2x2): R=10, G=20, B=30, A=255
      // Block 2 (top-right 2x2): R=40, G=50, B=60, A=255
      // Block 3 (bottom-left 2x2): R=70, G=80, B=90, A=255
      // Block 4 (bottom-right 2x2): R=100, G=110, B=120, A=255
      const srcWidth = 4;
      const srcHeight = 4;
      const srcPixels = new Uint8ClampedArray(srcWidth * srcHeight * 4);

      for (let y = 0; y < srcHeight; y++) {
        for (let x = 0; x < srcWidth; x++) {
          const idx = (y * srcWidth + x) * 4;
          if (x < 2 && y < 2) {
            srcPixels[idx] = 10; srcPixels[idx + 1] = 20; srcPixels[idx + 2] = 30; srcPixels[idx + 3] = 255;
          } else if (x >= 2 && y < 2) {
            srcPixels[idx] = 40; srcPixels[idx + 1] = 50; srcPixels[idx + 2] = 60; srcPixels[idx + 3] = 255;
          } else if (x < 2 && y >= 2) {
            srcPixels[idx] = 70; srcPixels[idx + 1] = 80; srcPixels[idx + 2] = 90; srcPixels[idx + 3] = 255;
          } else {
            srcPixels[idx] = 100; srcPixels[idx + 1] = 110; srcPixels[idx + 2] = 120; srcPixels[idx + 3] = 255;
          }
        }
      }

      // Downsample 4x4 source to 2x2 target
      const result = boxSampleImage(srcPixels, srcWidth, srcHeight, 2, 2);

      // Expected output is a 2x2 image (16 values):
      // Cell (0,0): R=10, G=20, B=30, A=255
      // Cell (1,0): R=40, G=50, B=60, A=255
      // Cell (0,1): R=70, G=80, B=90, A=255
      // Cell (1,1): R=100, G=110, B=120, A=255
      expect(result).toEqual(new Uint8ClampedArray([
        10, 20, 30, 255,   // Cell 0,0
        40, 50, 60, 255,   // Cell 1,0
        70, 80, 90, 255,   // Cell 0,1
        100, 110, 120, 255 // Cell 1,1
      ]));
    });

    it('samples and averages pixel data correctly with a crop boundary', () => {
      // Source image: 6x4. Target grid: 2x2 (aspect ratio 1).
      // Since Source AR (1.5) > Target AR (1), it will crop horizontally.
      // cropWidth = 4 * 1 = 4.
      // cropHeight = 4.
      // xOffset = (6 - 4) / 2 = 1.
      // yOffset = 0.
      // So the cropped region in source coordinates is: x from [1 to 4] inclusive, y from [0 to 3] inclusive.
      // Let's set pixels in the cropped region to known values and verify they are averaged.
      const srcWidth = 6;
      const srcHeight = 4;
      const srcPixels = new Uint8ClampedArray(srcWidth * srcHeight * 4);

      // Fill everything with 0 first
      srcPixels.fill(0);

      // Inside the cropped region (x in [1, 4], y in [0, 3]):
      // Let's divide it into 2x2 target blocks:
      // Target Cell 0,0: x in [1, 2], y in [0, 1]. Set to R=100
      // Target Cell 1,0: x in [3, 4], y in [0, 1]. Set to R=150
      // Target Cell 0,1: x in [1, 2], y in [2, 3]. Set to R=200
      // Target Cell 1,1: x in [3, 4], y in [2, 3]. Set to R=250
      // Outside the crop region (x=0 or x=5), set to R=255 (to ensure it is NOT sampled)
      for (let y = 0; y < srcHeight; y++) {
        for (let x = 0; x < srcWidth; x++) {
          const idx = (y * srcWidth + x) * 4;
          if (x === 0 || x === 5) {
            srcPixels[idx] = 255; srcPixels[idx + 3] = 255;
          } else {
            srcPixels[idx + 3] = 255; // Alpha
            if (x < 3 && y < 2) {
              srcPixels[idx] = 100;
            } else if (x >= 3 && y < 2) {
              srcPixels[idx] = 150;
            } else if (x < 3 && y >= 2) {
              srcPixels[idx] = 200;
            } else {
              srcPixels[idx] = 250;
            }
          }
        }
      }

      const result = boxSampleImage(srcPixels, srcWidth, srcHeight, 2, 2);

      // Verify that the cropped pixels were sampled and outside pixels were ignored
      expect(result).toEqual(new Uint8ClampedArray([
        100, 0, 0, 255,
        150, 0, 0, 255,
        200, 0, 0, 255,
        250, 0, 0, 255
      ]));
    });

    it('handles non-integer block boundaries without crashing or division by zero', () => {
      // Source image 5x5, target 3x3.
      // This will result in block sizes like 5/3 = 1.6667 pixels.
      const srcWidth = 5;
      const srcHeight = 5;
      const srcPixels = new Uint8ClampedArray(srcWidth * srcHeight * 4);
      srcPixels.fill(128); // fill all channels with 128

      const result = boxSampleImage(srcPixels, srcWidth, srcHeight, 3, 3);
      expect(result.length).toBe(3 * 3 * 4);
      
      // All values should be 128 since the source was uniform
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(128);
      }
    });
  });
});
