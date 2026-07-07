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

  constructor() {
    this.mockContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      imageSmoothingEnabled: true,
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

beforeAll(() => {
  originalCreateElement = globalThis.document?.createElement;
  
  // Set up mock document
  (globalThis as any).document = {
    createElement: vi.fn().mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return new MockCanvas();
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
});
