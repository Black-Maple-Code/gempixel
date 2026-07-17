import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { drawCanvasOnly, drawCombinedCanvasSheet, drawLegendOnly } from '../export';

class MockCanvas {
  public width = 0;
  public height = 0;
  public mockContext: any;

  constructor() {
    this.mockContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      setLineDash: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      imageSmoothingEnabled: true,
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1.0,
    };
  }

  getContext(_type: string) {
    return this.mockContext;
  }
}

let originalCreateElement: any;
let createdCanvases: MockCanvas[] = [];

beforeAll(() => {
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const c = new MockCanvas();
          createdCanvases.push(c);
          return c;
        }
        return {};
      })
    };
  } else {
    originalCreateElement = globalThis.document.createElement;
    globalThis.document.createElement = vi.fn().mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const c = new MockCanvas();
        createdCanvases.push(c);
        return c;
      }
      return originalCreateElement(tag);
    }) as any;
  }
});

afterAll(() => {
  if (originalCreateElement) {
    globalThis.document.createElement = originalCreateElement;
  } else {
    delete (globalThis as any).document;
  }
});

describe('Canvas PNG Exporter Rendering', () => {
  it('creates an offscreen canvas containing expected dimensions', () => {
    const canvas = drawCanvasOnly({
      cols: 10,
      rows: 15,
      gridData: new Array(150).fill('310'),
      colorMap: new Map([['310', '#000000']]),
      symbolMap: { '310': '▲' },
      cellScale: 20
    });
    
    expect(canvas.width).toBe(1000); // 10 * 20 + 2 * (20 * 20) framer margin
    expect(canvas.height).toBe(1100); // 15 * 20 + 2 * (20 * 20) framer margin
  });

  it('allocates margin widths for combined sheets correctly', () => {
    const canvas = drawCombinedCanvasSheet({
      cols: 10,
      rows: 15,
      gridData: new Array(150).fill('310'),
      colorMap: new Map([['310', '#000000']]),
      symbolMap: { '310': '▲' },
      leftLegendColors: [{ dmc: '310', hex: '#000000' }],
      rightLegendColors: [{ dmc: '310', hex: '#000000' }],
      cellScale: 20,
      marginWidth: 140
    });

    // Width: gridWidth 200 + 2*140 margins + 2*(3*20) outer + legendGap.
    // legendGap = round(3 / 0.254 * 20) = 236 (3cm border room before the key).
    expect(canvas.width).toBe(836);
    // Height: max(gridHeight = 300, legendHeight = 1 * 18 + 30 = 48) + 2 * 140 + 2 * 60 => 300 + 280 + 120 = 700
    expect(canvas.height).toBe(700);
  });

  it('overrides height when the required legend size exceeds grid size', () => {
    // 50 left items + 1 right item = 51 total colors.
    // 51 colors > 40 => 3 columns.
    // itemsPerCol = Math.ceil(51 / 3) = 17 items.
    // legendRequiredHeight = 17 * 18 + 30 = 336px.
    // gridHeight is 15 * 20 = 300px.
    // CanvasHeight = max(300, 336) + 2 * 140 + 2 * 60 = 336 + 280 + 120 = 736.
    const longLegend = Array.from({ length: 50 }, (_, i) => ({ dmc: `${i}`, hex: '#000000' }));
    
    const canvas = drawCombinedCanvasSheet({
      cols: 10,
      rows: 15,
      gridData: new Array(150).fill('310'),
      colorMap: new Map([['310', '#000000']]),
      symbolMap: { '310': '▲' },
      leftLegendColors: longLegend,
      rightLegendColors: [{ dmc: '310', hex: '#000000' }],
      cellScale: 20,
      marginWidth: 140
    });

    expect(canvas.height).toBe(736);
  });

  it('draw methods handle mock canvas rendering contexts properly without throwing errors', () => {
    expect(() => {
      drawCanvasOnly({
        cols: 2,
        rows: 2,
        gridData: ['310', '310', '310', '310'],
        colorMap: new Map([['310', '#000000']]),
        symbolMap: { '310': '▲' },
        cellScale: 20
      });
    }).not.toThrow();

    expect(() => {
      drawCombinedCanvasSheet({
        cols: 2,
        rows: 2,
        gridData: ['310', '310', '310', '310'],
        colorMap: new Map([['310', '#000000']]),
        symbolMap: { '310': '▲' },
        leftLegendColors: [{ dmc: '310', hex: '#000000' }],
        rightLegendColors: [{ dmc: '310', hex: '#000000' }],
        cellScale: 20,
        marginWidth: 140
      });
    }).not.toThrow();
  });
});

describe('drawLegendOnly', () => {
  it('returns a canvas with positive, finite width and height', () => {
    const canvas = drawLegendOnly({
      leftLegendColors: [{ dmc: '310', hex: '#000000' }],
      rightLegendColors: [{ dmc: '817', hex: '#BB2528' }],
      symbolMap: { '310': '▲', '817': '●' }
    });

    expect(typeof canvas.width).toBe('number');
    expect(typeof canvas.height).toBe('number');
    expect(Number.isFinite(canvas.width)).toBe(true);
    expect(Number.isFinite(canvas.height)).toBe(true);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    // Exposes the same download surface as the other renderers.
    expect(typeof canvas.getContext).toBe('function');
  });

  it('sizes to the legend band only — strictly narrower than the combined sheet', () => {
    // 30 + 25 = 55 colors (> 40 => 3-column branch) shared by both renderers.
    const leftLegendColors = Array.from({ length: 30 }, (_, i) => ({ dmc: `${i}`, hex: '#123456' }));
    const rightLegendColors = Array.from({ length: 25 }, (_, i) => ({ dmc: `${100 + i}`, hex: '#654321' }));
    const symbolMap: Record<string, string> = {};

    const legendCanvas = drawLegendOnly({ leftLegendColors, rightLegendColors, symbolMap });

    const combinedCanvas = drawCombinedCanvasSheet({
      cols: 20,
      rows: 20,
      gridData: new Array(400).fill('310'),
      colorMap: new Map([['310', '#000000']]),
      symbolMap: { '310': '▲' },
      leftLegendColors,
      rightLegendColors,
      cellScale: 20,
      marginWidth: 140
    });

    // Band-only canvas is not the grid-inclusive sheet.
    expect(legendCanvas.width).toBeLessThan(combinedCanvas.width);
  });

  it('does not throw across the 3-column (> 40) and 2-column (< 40) legend branches', () => {
    // > 40 colors => 3-column branch.
    const bigLegend = Array.from({ length: 51 }, (_, i) => ({ dmc: `${i}`, hex: '#000000' }));
    expect(() => {
      drawLegendOnly({
        leftLegendColors: bigLegend,
        rightLegendColors: [{ dmc: '999', hex: '#FFFFFF' }],
        symbolMap: { '0': '▲' }
      });
    }).not.toThrow();

    // < 40 colors => 2-column branch.
    expect(() => {
      drawLegendOnly({
        leftLegendColors: [{ dmc: '310', hex: '#000000' }],
        rightLegendColors: [{ dmc: '817', hex: '#BB2528' }],
        symbolMap: { '310': '▲', '817': '●' }
      });
    }).not.toThrow();
  });

  it('does not throw when symbolMap is missing an entry for a color', () => {
    expect(() => {
      drawLegendOnly({
        leftLegendColors: [{ dmc: '310', hex: '#000000' }],
        rightLegendColors: [{ dmc: '817', hex: '#BB2528' }],
        // No symbolMap entries at all — symbol falls back to '' like the combined sheet.
        symbolMap: {}
      });
    }).not.toThrow();
  });
});
