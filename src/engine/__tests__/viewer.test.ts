import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { CanvasViewer } from '../viewer';

/**
 * Unit tests for CanvasViewer verifying viewport interaction, panning,
 * zoom centering, and offscreen double-buffering / drill style drawing logic.
 */

// Mock Canvas and Context for Node environment
class MockCanvas {
  public width = 800;
  public height = 600;
  public listeners: Record<string, Function[]> = {};
  public mockContext: any;
  // Real DOM canvases expose a `.style` object; the viewer constructor assigns
  // `canvas.style.touchAction` (D-06). The mock must provide it so that assignment
  // does not throw, and so tests can assert the touch-action guard was set.
  public style: Record<string, string> = {};

  constructor() {
    this.mockContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
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

  addEventListener(type: string, listener: Function, _options?: any) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: Function) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }
  }

  getBoundingClientRect() {
    return { left: 10, top: 20, width: 800, height: 600 };
  }

  setPointerCapture = vi.fn();
  releasePointerCapture = vi.fn();

  // Helper to dispatch event to registered listeners
  dispatchEvent(type: string, eventData: any) {
    const event = {
      preventDefault: vi.fn(),
      ...eventData
    };
    if (this.listeners[type]) {
      for (const listener of this.listeners[type]) {
        listener(event);
      }
    }
  }
}

let originalCreateElement: any;
let createdCanvases: MockCanvas[] = [];

beforeAll(() => {
  originalCreateElement = globalThis.document?.createElement;
  
  // Set up mock document
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
});

afterAll(() => {
  if (originalCreateElement) {
    (globalThis as any).document.createElement = originalCreateElement;
  } else {
    delete (globalThis as any).document;
  }
});

describe('CanvasViewer Viewport Interaction & Logic', () => {
  let canvas: MockCanvas;
  let viewer: CanvasViewer;

  beforeEach(() => {
    vi.clearAllMocks();
    createdCanvases = [];
    canvas = new MockCanvas();
    viewer = new CanvasViewer(canvas as any);
  });

  it('should initialize with default viewport state', () => {
    const state = viewer.getViewportState();
    expect(state.scale).toBe(1.0);
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  it('should update offsets on pointer drag (panning)', () => {
    // 1. Start drag with pointerdown
    canvas.dispatchEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);

    // 2. Drag pointer to (120, 130) -> delta (20, 30)
    canvas.dispatchEvent('pointermove', { clientX: 120, clientY: 130 });
    
    let state = viewer.getViewportState();
    expect(state.offsetX).toBe(20);
    expect(state.offsetY).toBe(30);

    // 3. Drag further to (110, 110) -> delta (-10, -20)
    canvas.dispatchEvent('pointermove', { clientX: 110, clientY: 110 });

    state = viewer.getViewportState();
    expect(state.offsetX).toBe(10);
    expect(state.offsetY).toBe(10);

    // 4. End drag with pointerup
    canvas.dispatchEvent('pointerup', { pointerId: 1 });
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);

    // 5. Subsequent pointermove should not update offsets
    canvas.dispatchEvent('pointermove', { clientX: 200, clientY: 200 });
    state = viewer.getViewportState();
    expect(state.offsetX).toBe(10);
    expect(state.offsetY).toBe(10);
  });

  it('should ignore right click or non-primary pointer button drags', () => {
    canvas.dispatchEvent('pointerdown', { clientX: 100, clientY: 100, button: 2, pointerType: 'mouse', pointerId: 1 });
    canvas.dispatchEvent('pointermove', { clientX: 120, clientY: 130 });
    const state = viewer.getViewportState();
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  it('should zoom centered at cursor coordinates on wheel events', () => {
    // Canvas left=10, top=20. Mouse clientX=210, clientY=220 translates to mouseX=200, mouseY=200 relative to canvas.
    // Initial scale=1.0, offsetX=0, offsetY=0.
    // Pre-zoom canvas coordinates: canvasX = 200, canvasY = 200.
    // deltaY < 0 triggers zoom in (factor = 1.1).
    // New scale = 1.1.
    // New offsetX = 200 - 200 * 1.1 = -20
    // New offsetY = 200 - 200 * 1.1 = -20
    canvas.dispatchEvent('wheel', { clientX: 210, clientY: 220, deltaY: -100 });

    let state = viewer.getViewportState();
    expect(state.scale).toBeCloseTo(1.1);
    expect(state.offsetX).toBeCloseTo(-20);
    expect(state.offsetY).toBeCloseTo(-20);

    // Zoom out (factor = 0.9) centered at the same client position.
    // Pre-zoom canvas coordinates: (200 - (-20)) / 1.1 = 200, (200 - (-20)) / 1.1 = 200.
    // New scale = 1.1 * 0.9 = 0.99.
    // New offsetX = 200 - 200 * 0.99 = 2
    canvas.dispatchEvent('wheel', { clientX: 210, clientY: 220, deltaY: 100 });
    state = viewer.getViewportState();
    expect(state.scale).toBeCloseTo(0.99);
    expect(state.offsetX).toBeCloseTo(2);
    expect(state.offsetY).toBeCloseTo(2);
  });

  it('should clamp zoom level between 0.5 and 50.0', () => {
    // Zoom out repeatedly (deltaY > 0)
    for (let i = 0; i < 20; i++) {
      canvas.dispatchEvent('wheel', { clientX: 100, clientY: 100, deltaY: 100 });
    }
    expect(viewer.getViewportState().scale).toBe(0.5);

    // Zoom in repeatedly (deltaY < 0)
    for (let i = 0; i < 100; i++) {
      canvas.dispatchEvent('wheel', { clientX: 100, clientY: 100, deltaY: -100 });
    }
    expect(viewer.getViewportState().scale).toBe(50.0);
  });

  it('should redraw offscreen and draw to main canvas when data changes', () => {
    const colorMap = new Map<string, string>();
    colorMap.set('310', '#000000');
    colorMap.set('BLANC', '#FFFFFF');

    // 2x2 grid
    viewer.setData(2, 2, ['310', 'BLANC', 'BLANC', '310'], colorMap);

    // Check that clearRect and drawImage were called on the main context
    expect(canvas.mockContext.clearRect).toHaveBeenCalled();
    expect(canvas.mockContext.drawImage).toHaveBeenCalled();

    // Verify setDrillStyle triggers redraw
    canvas.mockContext.clearRect.mockClear();
    canvas.mockContext.drawImage.mockClear();

    viewer.setDrillStyle('round');
    expect(canvas.mockContext.clearRect).toHaveBeenCalled();
    expect(canvas.mockContext.drawImage).toHaveBeenCalled();
  });

  it('should correctly allocate offscreen canvas size and draw square/round drills', () => {
    // Find the created offscreen canvas (the first canvas created inside the describe block, which happens during beforeEach instantiation of CanvasViewer)
    // Note: CanvasViewer constructor instantiates an offscreen canvas by calling document.createElement('canvas')
    const offscreenCanvas = createdCanvases[0];
    expect(offscreenCanvas).toBeDefined();

    const colorMap = new Map<string, string>();
    colorMap.set('310', '#000000');
    colorMap.set('BLANC', '#FFFFFF');

    // Set 2x3 grid
    viewer.setData(2, 3, ['310', 'BLANC', 'BLANC', '310', '310', 'BLANC'], colorMap);

    // Must-have: Offscreen canvas allocates size proportional to cell coordinates (cellSize = 16)
    expect(offscreenCanvas.width).toBe(2 * 16); // cols * 16
    expect(offscreenCanvas.height).toBe(3 * 16); // rows * 16

    // Must-have: Square drills draw as filled rectangles covering cells completely
    // 1 for background + 6 cells = 7 calls to fillRect
    expect(offscreenCanvas.mockContext.fillRect).toHaveBeenCalledTimes(7);
    // The first fillRect should be background slate
    expect(offscreenCanvas.mockContext.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 32, 48);
    // The second fillRect should be the first cell
    expect(offscreenCanvas.mockContext.fillRect).toHaveBeenNthCalledWith(2, 0, 0, 16, 16);

    // Switch to round drill style
    offscreenCanvas.mockContext.fillRect.mockClear();
    offscreenCanvas.mockContext.arc.mockClear();
    offscreenCanvas.mockContext.fill.mockClear();

    viewer.setDrillStyle('round');

    // Must-have: Round drill cells render as filled circles showing the backing slate color through corner gaps
    // 1 background fillRect
    expect(offscreenCanvas.mockContext.fillRect).toHaveBeenCalledTimes(1);
    // 6 circles drawn
    expect(offscreenCanvas.mockContext.arc).toHaveBeenCalledTimes(6);
    expect(offscreenCanvas.mockContext.fill).toHaveBeenCalledTimes(6);
    // Circle at col=0, row=0 should be centered at (8, 8) with radius 7.2 (0.45 * 16)
    expect(offscreenCanvas.mockContext.arc).toHaveBeenNthCalledWith(1, 8, 8, 7.2, 0, Math.PI * 2);

    // Must-have: Offscreen buffer redraws only when grid dimensions, style selections, or palette colors change (not on zoom/pan)
    offscreenCanvas.mockContext.fillRect.mockClear();
    offscreenCanvas.mockContext.arc.mockClear();

    // Trigger zoom
    canvas.dispatchEvent('wheel', { clientX: 210, clientY: 220, deltaY: -100 });
    // Trigger pan
    canvas.dispatchEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
    canvas.dispatchEvent('pointermove', { clientX: 120, clientY: 130 });

    // Verify no redraws happened on offscreen canvas
    expect(offscreenCanvas.mockContext.fillRect).not.toHaveBeenCalled();
    expect(offscreenCanvas.mockContext.arc).not.toHaveBeenCalled();
  });

  describe('Symbol Mode Rendering Support', () => {
    it('should update viewMode and trigger redraw on setViewMode', () => {
      const colorMap = new Map<string, string>();
      colorMap.set('310', '#000000');
      viewer.setData(1, 1, ['310'], colorMap);

      canvas.mockContext.clearRect.mockClear();
      canvas.mockContext.drawImage.mockClear();

      viewer.setViewMode('symbols');

      expect(canvas.mockContext.clearRect).toHaveBeenCalled();
      expect(canvas.mockContext.drawImage).toHaveBeenCalled();
    });

    it('should store symbol associations and trigger redraw on setSymbolMap', () => {
      const colorMap = new Map<string, string>();
      colorMap.set('310', '#000000');
      viewer.setData(1, 1, ['310'], colorMap);

      canvas.mockContext.clearRect.mockClear();
      canvas.mockContext.drawImage.mockClear();

      viewer.setSymbolMap({ '310': '▲' });

      expect(canvas.mockContext.clearRect).toHaveBeenCalled();
      expect(canvas.mockContext.drawImage).toHaveBeenCalled();
    });

    it('should render symbols using fillText when viewMode is symbols and scale is large enough', () => {
      const colorMap = new Map<string, string>();
      colorMap.set('310', '#000000');
      viewer.setData(1, 1, ['310'], colorMap);
      viewer.setSymbolMap({ '310': '▲' });
      
      canvas.mockContext.fillText.mockClear();
      viewer.setViewMode('symbols'); // viewMode is 'symbols', scale defaults to 1.0, cellSize is 16px >= 10px

      expect(canvas.mockContext.fillText).toHaveBeenCalledWith('▲', 8, 8); // center of cell is (8, 8)
    });

    it('should skip symbol rendering when cell size is below 10px threshold', () => {
      const colorMap = new Map<string, string>();
      colorMap.set('310', '#000000');
      viewer.setData(1, 1, ['310'], colorMap);
      viewer.setSymbolMap({ '310': '▲' });
      
      // Set viewport scale to 0.5. scaledCellSize = 16 * 0.5 = 8px < 10px
      viewer.setViewportState(0.5, 0, 0);
      
      canvas.mockContext.fillText.mockClear();
      viewer.setViewMode('symbols');

      expect(canvas.mockContext.fillText).not.toHaveBeenCalled();
    });
  });

  describe('Zoom and callback interface', () => {
    it('should support programmatic zoomIn, zoomOut, resetZoom and trigger onZoomChange', () => {
      const onZoomChangeMock = vi.fn();
      viewer.onZoomChange = onZoomChangeMock;

      const initialScale = viewer.getViewportState().scale;

      // zoomIn
      viewer.zoomIn();
      const afterZoomInScale = viewer.getViewportState().scale;
      expect(afterZoomInScale).toBeGreaterThan(initialScale);
      expect(onZoomChangeMock).toHaveBeenCalledWith(afterZoomInScale);

      // zoomOut
      onZoomChangeMock.mockClear();
      viewer.zoomOut();
      const afterZoomOutScale = viewer.getViewportState().scale;
      expect(afterZoomOutScale).toBeLessThan(afterZoomInScale);
      expect(onZoomChangeMock).toHaveBeenCalledWith(afterZoomOutScale);

      // resetZoom / fitToContainer (needs some data first to calculate scale)
      const colorMap = new Map<string, string>();
      colorMap.set('310', '#000000');
      viewer.setData(2, 2, ['310', '310', '310', '310'], colorMap);
      
      onZoomChangeMock.mockClear();
      viewer.resetZoom();
      expect(onZoomChangeMock).toHaveBeenCalled();
    });
  });

  describe('Fit-mode tracking (D-04 isFitMode)', () => {
    it('should report fit mode by default before any zoom', () => {
      // A freshly constructed viewer rests in fit-to-container mode.
      expect(viewer.isInFitMode()).toBe(true);
    });

    it('should stay in fit mode after fitToContainer', () => {
      const colorMap = new Map<string, string>();
      colorMap.set('310', '#000000');
      viewer.setData(2, 2, ['310', '310', '310', '310'], colorMap);

      viewer.fitToContainer();
      expect(viewer.isInFitMode()).toBe(true);
    });

    it('should leave fit mode on an explicit zoomIn', () => {
      expect(viewer.isInFitMode()).toBe(true);
      viewer.zoomIn();
      expect(viewer.isInFitMode()).toBe(false);
    });

    it('should leave fit mode on an explicit zoomOut', () => {
      expect(viewer.isInFitMode()).toBe(true);
      viewer.zoomOut();
      expect(viewer.isInFitMode()).toBe(false);
    });

    it('should leave fit mode on a wheel zoom', () => {
      expect(viewer.isInFitMode()).toBe(true);
      canvas.dispatchEvent('wheel', { clientX: 210, clientY: 220, deltaY: -100 });
      expect(viewer.isInFitMode()).toBe(false);
    });

    it('should re-enter fit mode when fitToContainer runs after a user zoom', () => {
      const colorMap = new Map<string, string>();
      colorMap.set('310', '#000000');
      viewer.setData(2, 2, ['310', '310', '310', '310'], colorMap);

      viewer.zoomIn();
      expect(viewer.isInFitMode()).toBe(false);

      viewer.fitToContainer();
      expect(viewer.isInFitMode()).toBe(true);
    });

    it('should re-enter fit mode via resetZoom (delegates to fitToContainer)', () => {
      const colorMap = new Map<string, string>();
      colorMap.set('310', '#000000');
      viewer.setData(2, 2, ['310', '310', '310', '310'], colorMap);

      viewer.zoomIn();
      expect(viewer.isInFitMode()).toBe(false);

      viewer.resetZoom();
      expect(viewer.isInFitMode()).toBe(true);
    });

    it('should keep the fit flag orthogonal to the resulting scale/offset math', () => {
      // The wheel-zoom math asserted elsewhere must be unchanged by the flag.
      canvas.dispatchEvent('wheel', { clientX: 210, clientY: 220, deltaY: -100 });
      const state = viewer.getViewportState();
      expect(state.scale).toBeCloseTo(1.1);
      expect(state.offsetX).toBeCloseTo(-20);
      expect(state.offsetY).toBeCloseTo(-20);
      expect(viewer.isInFitMode()).toBe(false);
    });
  });

  describe('Multi-touch pinch + touch-action', () => {
    it('should set touch-action:none on the canvas element (D-06)', () => {
      // Constructed in beforeEach. The viewer must declare the canvas as gesture-owned
      // so the page never scrolls/zooms under a touch gesture.
      expect(canvas.style.touchAction).toBe('none');
    });

    it('should zoom in when two pointers spread apart (pinch-out)', () => {
      const onZoomChangeMock = vi.fn();
      viewer.onZoomChange = onZoomChangeMock;

      const initialScale = viewer.getViewportState().scale;

      // Two fingers land close together (distance 100 along x).
      canvas.dispatchEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, pointerType: 'touch', pointerId: 1 });
      canvas.dispatchEvent('pointerdown', { clientX: 200, clientY: 100, button: 0, pointerType: 'touch', pointerId: 2 });

      // Spread them apart -> distance grows -> zoom in.
      canvas.dispatchEvent('pointermove', { clientX: 50, clientY: 100, pointerId: 1 });
      canvas.dispatchEvent('pointermove', { clientX: 250, clientY: 100, pointerId: 2 });

      const afterScale = viewer.getViewportState().scale;
      expect(afterScale).toBeGreaterThan(initialScale);
      expect(onZoomChangeMock).toHaveBeenCalled();
    });

    it('should zoom out when two pointers move together (pinch-in)', () => {
      // Start with a known non-clamped scale so a zoom-out is observable.
      viewer.setViewportState(5.0, 0, 0);
      const initialScale = viewer.getViewportState().scale;

      // Two fingers land far apart (distance 1000 along x).
      canvas.dispatchEvent('pointerdown', { clientX: 0, clientY: 100, button: 0, pointerType: 'touch', pointerId: 1 });
      canvas.dispatchEvent('pointerdown', { clientX: 1000, clientY: 100, button: 0, pointerType: 'touch', pointerId: 2 });

      // Move them together -> distance shrinks -> zoom out.
      canvas.dispatchEvent('pointermove', { clientX: 400, clientY: 100, pointerId: 1 });
      canvas.dispatchEvent('pointermove', { clientX: 600, clientY: 100, pointerId: 2 });

      const afterScale = viewer.getViewportState().scale;
      expect(afterScale).toBeLessThan(initialScale);
    });

    it('should clamp pinch zoom to the existing 0.5–50 scale bounds', () => {
      // Drive many spread frames -> should saturate at maxScale 50, never exceed it.
      canvas.dispatchEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, pointerType: 'touch', pointerId: 1 });
      canvas.dispatchEvent('pointerdown', { clientX: 110, clientY: 100, button: 0, pointerType: 'touch', pointerId: 2 });
      for (let i = 1; i <= 120; i++) {
        canvas.dispatchEvent('pointermove', { clientX: 100 + i * 20, clientY: 100, pointerId: 2 });
      }
      expect(viewer.getViewportState().scale).toBeLessThanOrEqual(50.0);
      expect(viewer.getViewportState().scale).toBeGreaterThan(1.0);
      canvas.dispatchEvent('pointerup', { pointerId: 1 });
      canvas.dispatchEvent('pointerup', { pointerId: 2 });

      // Drive many together frames -> should saturate at minScale 0.5, never below it.
      canvas.dispatchEvent('pointerdown', { clientX: 0, clientY: 100, button: 0, pointerType: 'touch', pointerId: 3 });
      canvas.dispatchEvent('pointerdown', { clientX: 3000, clientY: 100, button: 0, pointerType: 'touch', pointerId: 4 });
      for (let i = 1; i <= 120; i++) {
        const x = Math.max(1, 3000 - i * 25);
        canvas.dispatchEvent('pointermove', { clientX: x, clientY: 100, pointerId: 4 });
      }
      expect(viewer.getViewportState().scale).toBeGreaterThanOrEqual(0.5);
    });

    it('should not pinch-zoom while only a single finger is down (pan, not zoom)', () => {
      const initialScale = viewer.getViewportState().scale;
      canvas.dispatchEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, pointerType: 'touch', pointerId: 1 });
      canvas.dispatchEvent('pointermove', { clientX: 140, clientY: 160, pointerId: 1 });

      const state = viewer.getViewportState();
      // Single finger pans (offsets change) but never changes scale.
      expect(state.scale).toBe(initialScale);
      expect(state.offsetX).toBe(40);
      expect(state.offsetY).toBe(60);
    });
  });
});
