// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { App } from '../App';
import { MatcherClient } from '../engine/worker-client';
import { CanvasViewer } from '../engine/viewer';
import { DMC_PALETTE } from '../engine/palette';

// Mock canvas viewer spies
const mockSetData = vi.fn();
const mockSetDrillStyle = vi.fn();
const mockSetHighlightedColor = vi.fn();
const mockDestroy = vi.fn();

vi.mock('../engine/viewer', () => {
  return {
    CanvasViewer: vi.fn().mockImplementation(() => {
      return {
        setData: mockSetData,
        setDrillStyle: mockSetDrillStyle,
        setHighlightedColor: mockSetHighlightedColor,
        destroy: mockDestroy,
      };
    })
  };
});

// Mock worker client spies
const mockMatch = vi.fn();
const mockTerminate = vi.fn();

vi.mock('../engine/worker-client', () => {
  return {
    MatcherClient: vi.fn().mockImplementation(() => {
      return {
        match: mockMatch,
        terminate: mockTerminate,
      };
    })
  };
});

describe('Integration Match Triggering and Palette Toggles', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders base checklist options correctly', () => {
    render(<App />, container);

    // Verify sub-palette checklist inputs exist
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // Initially, there are a lot of checkboxes representing all palette colors
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('toggles sub-palette checkboxes, filters candidates list, and triggers worker matches', async () => {
    // 1. Stub FileReader and Image
    const mockReader = {
      readAsDataURL: vi.fn().mockImplementation(function(this: any) {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/png;base64,mock' } });
        }
      }),
    };
    vi.stubGlobal('FileReader', vi.fn().mockImplementation(() => mockReader));

    const mockImageInstance = {
      naturalWidth: 10,
      naturalHeight: 10,
      width: 10,
      height: 10,
      set src(_val: string) {
        if (this.onload) {
          setTimeout(() => this.onload(), 0);
        }
      },
      onload: null as any,
    };
    vi.stubGlobal('Image', vi.fn().mockImplementation(() => mockImageInstance));

    // Stub Canvas context
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type) => {
      if (type === '2d') {
        return {
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(400),
            width: 10,
            height: 10,
          }),
        } as any;
      }
      return null;
    });

    render(<App />, container);

    // 2. Load mock image
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: true
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for image onload and match useEffect to run completely
    await new Promise(r => setTimeout(r, 100));

    // MatcherClient constructor should have been instantiated
    expect(MatcherClient).toHaveBeenCalled();
    expect(mockMatch).toHaveBeenCalled();

    // The first call should have all colors active (none in excludedColors)
    const initialCandidates = mockMatch.mock.calls[mockMatch.mock.calls.length - 1][1];
    expect(initialCandidates.length).toBe(DMC_PALETTE.length);

    // Clear call history
    mockMatch.mockClear();

    // 3. Find check box of first color and toggle it (uncheck it)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const firstCheckbox = checkboxes[0] as HTMLInputElement;
    expect(firstCheckbox.checked).toBe(true);

    // Click checkbox once (natively toggles state and fires click/change in jsdom)
    firstCheckbox.click();

    // Wait for match recalculation
    await new Promise(r => setTimeout(r, 100));

    // Worker match should be triggered again
    expect(mockMatch).toHaveBeenCalled();

    // Candidate list passed should now be 1 less
    const updatedCandidates = mockMatch.mock.calls[mockMatch.mock.calls.length - 1][1];
    expect(updatedCandidates.length).toBe(DMC_PALETTE.length - 1);

    // Clean up globals
    vi.unstubAllGlobals();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('updates highlighted color codes in the viewer when legend rows are selected', async () => {
    // 1. Stub FileReader/Image/Canvas
    const mockReader = {
      readAsDataURL: vi.fn().mockImplementation(function(this: any) {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/png;base64,mock' } });
        }
      }),
    };
    vi.stubGlobal('FileReader', vi.fn().mockImplementation(() => mockReader));

    const mockImageInstance = {
      naturalWidth: 10,
      naturalHeight: 10,
      width: 10,
      height: 10,
      set src(_val: string) {
        if (this.onload) {
          setTimeout(() => this.onload(), 0);
        }
      },
      onload: null as any,
    };
    vi.stubGlobal('Image', vi.fn().mockImplementation(() => mockImageInstance));

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type) => {
      if (type === '2d') {
        return {
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(400),
            width: 10,
            height: 10,
          }),
        } as any;
      }
      return null;
    });

    // 2. Set up MatcherClient mock to return matches when called
    mockMatch.mockImplementationOnce((_pixels, _candidates, _onProgress, onSuccess) => {
      // Immediately succeed with mock results: 1 cell of color '310'
      onSuccess({
        matches: ['310'],
        counts: { '310': 1 }
      });
    });

    render(<App />, container);

    // 3. Trigger image load to populate legend
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: true
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(r => setTimeout(r, 100));

    expect(CanvasViewer).toHaveBeenCalled();

    // Find the legend table row for '310' (first row) and click it once
    const tableRow = container.querySelector('tbody tr') as HTMLTableRowElement;
    expect(tableRow).toBeTruthy();
    expect(tableRow.textContent).toContain('310');

    tableRow.click();
    await new Promise(r => setTimeout(r, 50));

    // It should invoke setHighlightedColor with '310' on the viewer
    expect(mockSetHighlightedColor).toHaveBeenCalledWith('310');

    // Click it again to deselect
    mockSetHighlightedColor.mockClear();
    tableRow.click();
    await new Promise(r => setTimeout(r, 50));

    // It should invoke setHighlightedColor with null on the viewer
    expect(mockSetHighlightedColor).toHaveBeenCalledWith(null);

    // Clean up globals
    vi.unstubAllGlobals();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('verifies that canvas viewer draw context receives the correct globalAlpha parameters for highlight blending passes', async () => {
    // Import the actual CanvasViewer
    const { CanvasViewer: RealCanvasViewer } = await vi.importActual<typeof import('../engine/viewer')>('../engine/viewer');

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    
    // We will keep track of changes to globalAlpha
    const alphaValues: number[] = [];
    const mockContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      imageSmoothingEnabled: false,
      _globalAlpha: 1.0,
      get globalAlpha() {
        return this._globalAlpha;
      },
      set globalAlpha(val: number) {
        this._globalAlpha = val;
        alphaValues.push(val);
      }
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type) => {
      if (type === '2d') {
        return mockContext as any;
      }
      return null;
    });

    const canvasElement = document.createElement('canvas');
    const viewer = new RealCanvasViewer(canvasElement);

    // Populate data
    const colorMap = new Map<string, string>();
    colorMap.set('310', '#000000');
    viewer.setData(2, 2, ['310', '310', '310', '310'], colorMap);

    // Test drawing without highlight
    alphaValues.length = 0;
    viewer.setHighlightedColor(null);
    // Draw should have reset globalAlpha to 1.0 at the end
    expect(alphaValues).toContain(1.0);

    // Test drawing with highlight
    alphaValues.length = 0;
    viewer.setHighlightedColor('310');
    
    // During highlight draw pass:
    // 1. globalAlpha is set to 0.2
    // 2. globalAlpha is set to 1.0
    expect(alphaValues).toContain(0.2);
    expect(alphaValues).toContain(1.0);
    // The sequence should set 0.2 for background dimming, then 1.0 for highlighted cells
    expect(alphaValues[0]).toBe(0.2);
    expect(alphaValues[1]).toBe(1.0);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });
});
