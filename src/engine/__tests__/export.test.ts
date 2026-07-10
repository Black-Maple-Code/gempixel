import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { drawCanvasOnly, drawCombinedCanvasSheet } from '../export';

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
    
    expect(canvas.width).toBe(200); // 10 * 20
    expect(canvas.height).toBe(300); // 15 * 20
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

    expect(canvas.width).toBe(340); // 10 * 20 + 140
    // Height: max(gridHeight = 300, legendHeight = 1 * 18 + 30 = 48) => 300
    expect(canvas.height).toBe(300);
  });

  it('overrides height when the required legend size exceeds grid size', () => {
    // 50 left items + 1 right item = 51 total colors.
    // 51 colors > 40 => 3 columns.
    // itemsPerCol = Math.ceil(51 / 3) = 17 items.
    // legendRequiredHeight = 17 * 18 + 30 = 336px.
    // gridHeight is 15 * 20 = 300px.
    // So canvas.height should be overridden to 336.
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

    expect(canvas.height).toBe(336);
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
