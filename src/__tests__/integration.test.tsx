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
const mockSetDrillType = vi.fn();
const mockFitToContainer = vi.fn();
const mockDestroy = vi.fn();
const mockSetViewMode = vi.fn();
const mockSetSymbolMap = vi.fn();

vi.mock('../engine/viewer', () => {
  return {
    CanvasViewer: vi.fn().mockImplementation(() => {
      return {
        setData: mockSetData,
        setDrillStyle: mockSetDrillStyle,
        setHighlightedColor: mockSetHighlightedColor,
        setDrillType: mockSetDrillType,
        fitToContainer: mockFitToContainer,
        destroy: mockDestroy,
        setViewMode: mockSetViewMode,
        setSymbolMap: mockSetSymbolMap,
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

  it('renders base checklist options correctly', async () => {
    render(<App />, container);

    // Expand the collapsible section first
    const excludeColorsBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Exclude Colors')
    );
    expect(excludeColorsBtn).not.toBeUndefined();
    excludeColorsBtn!.dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitFor(() => {
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
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

    // Expand the collapsible section first
    const excludeColorsBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Exclude Colors')
    );
    expect(excludeColorsBtn).not.toBeUndefined();
    excludeColorsBtn!.dispatchEvent(new Event('click', { bubbles: true }));

    // Wait for animation/render and find check box of first color and toggle it (uncheck it)
    let checkboxes: NodeListOf<Element> = [] as any;
    await vi.waitFor(() => {
      checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

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

  it('automatically adjusts height to stay in ratio with the loaded image when width changes', async () => {
    // 1. Stub FileReader and Image with naturalWidth = 100, naturalHeight = 50 (aspect ratio = 2)
    const mockReader = {
      readAsDataURL: vi.fn().mockImplementation(function(this: any) {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/png;base64,mock' } });
        }
      }),
    };
    vi.stubGlobal('FileReader', vi.fn().mockImplementation(() => mockReader));

    const mockImageInstance = {
      naturalWidth: 100,
      naturalHeight: 50,
      width: 100,
      height: 50,
      set src(_val: string) {
        if (this.onload) {
          setTimeout(() => this.onload(), 0);
        }
      },
      onload: null as any,
    };
    vi.stubGlobal('Image', vi.fn().mockImplementation(() => mockImageInstance));

    // Stub Canvas context for image loader pixels extraction
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(100 * 50 * 4),
        width: 100,
        height: 50
      })
    };
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type) => {
      if (type === '2d') return mockContext as any;
      return null;
    });

    render(<App />, container);

    // 2. Load the image
    const fileInput = container.querySelector('#file-upload') as HTMLInputElement;
    const file = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for image onload macro-task
    await vi.waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    const widthEl = container.querySelector('input[data-field="width"]') as HTMLInputElement;
    const heightEl = container.querySelector('input[data-field="height"]') as HTMLInputElement;

    // Change width to 20
    widthEl.value = '20';
    widthEl.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for the render cycle to complete and verify ratio
    await vi.waitFor(() => {
      expect(widthEl.value).toBe('20');
      expect(heightEl.value).toBe('10');
    });

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('updates dimensions and units when preset canvas size changes', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Load a mock image first to enable the wizard Next button
    const fileInput = container.querySelector('#file-upload') as HTMLInputElement;
    const file = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for image onload
    await vi.waitFor(() => {
      const nextBtn = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      expect(nextBtn).not.toBeNull();
      expect(nextBtn.disabled).toBe(false);
    });

    // Query standard size preset select element
    const presetSelect = container.querySelector('#preset-size-select') as HTMLSelectElement;
    expect(presetSelect).not.toBeNull();

    // Select standard size preset: '30x40-cm' (width: 30, height: 40, unit: cm)
    presetSelect.value = '30x40-cm';
    presetSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const widthEl = container.querySelector('input[data-field="width"]') as HTMLInputElement;
    const heightEl = container.querySelector('input[data-field="height"]') as HTMLInputElement;

    // Wait for async Preact state update and render
    await vi.waitFor(() => {
      expect(widthEl.value).toBe('30');
      expect(heightEl.value).toBe('40');
    });

    // Select standard grid preset: '80x53-grid'
    presetSelect.value = '80x53-grid';
    presetSelect.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(widthEl.value).toBe('80');
      expect(heightEl.value).toBe('53');
    });
  });

  it('collapses and expands the left sidebar correctly on trigger clicks', async () => {
    render(<App />, container);

    // Sidebar should start expanded
    const sidebar = container.querySelector('aside') as HTMLElement;
    expect(sidebar.className).toContain('w-80');

    // Click collapse button
    const collapseBtn = container.querySelector('button[title="Collapse Sidebar"]') as HTMLButtonElement;
    expect(collapseBtn).not.toBeNull();
    collapseBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Wait for sidebar to transition to collapsed state
    await vi.waitFor(() => {
      expect(sidebar.className).toContain('w-0');
    });

    // Pushed expand button should now be visible in DOM
    const expandBtn = container.querySelector('button[title="Expand Sidebar"]') as HTMLButtonElement;
    expect(expandBtn).not.toBeNull();
    expandBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Sidebar should expand back
    await vi.waitFor(() => {
      expect(sidebar.className).toContain('w-80');
    });
  });

  it('collapses and expands the DMC Supply List correctly on trigger clicks', async () => {
    render(<App />, container);

    // Should start open
    let table = container.querySelector('.no-print table');
    expect(table).not.toBeNull();

    // Click DMC Supply List header button to collapse
    const supplyListToggle = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('DMC Supply List')
    );
    expect(supplyListToggle).not.toBeUndefined();
    supplyListToggle!.dispatchEvent(new Event('click', { bubbles: true }));

    // Verify table is collapsed (not in DOM)
    await vi.waitFor(() => {
      table = container.querySelector('.no-print table');
      expect(table).toBeNull();
    });

    // Expand it again
    supplyListToggle!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => {
      table = container.querySelector('.no-print table');
      expect(table).not.toBeNull();
    });
  });

  it('supports toggling between Grid View and Original Photo modes', async () => {
    // 1. Stub FileReader and Image to allow loading
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
          drawImage: vi.fn(),
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
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for image load
    await vi.waitFor(() => {
      expect(container.querySelector('canvas')).not.toBeNull();
    });

    // Viewport Mode selector should be visible
    const gridViewBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Grid Colors')
    );
    const originalPhotoBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Original Photo')
    );
    expect(gridViewBtn).not.toBeUndefined();
    expect(originalPhotoBtn).not.toBeUndefined();

    // Toggle to Original Photo
    originalPhotoBtn!.dispatchEvent(new Event('click', { bubbles: true }));

    // Should hide canvas (add hidden class) and display reference image
    await vi.waitFor(() => {
      const canvasEl = container.querySelector('canvas');
      expect(canvasEl).not.toBeNull();
      expect(canvasEl!.className).toContain('hidden');
      expect(container.querySelector('img[alt="Original reference full size"]')).not.toBeNull();
    });

    // Toggle back to Grid Colors
    gridViewBtn!.dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitFor(() => {
      const canvasEl = container.querySelector('canvas');
      expect(canvasEl).not.toBeNull();
      expect(canvasEl!.className).not.toContain('hidden');
    });

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('collapses and expands the right workspace panel sidebar correctly', async () => {
    render(<App />, container);

    // Sidebar should start expanded
    const sidebars = container.querySelectorAll('aside');
    const rightSidebar = sidebars[1] as HTMLElement; // second aside
    expect(rightSidebar.className).toContain('w-96');

    // Click collapse button inside right sidebar
    const collapseBtn = rightSidebar.querySelector('button[title="Collapse Workspace"]') as HTMLButtonElement;
    expect(collapseBtn).not.toBeNull();
    collapseBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Wait for sidebar to transition to collapsed state
    await vi.waitFor(() => {
      expect(rightSidebar.className).toContain('w-0');
    });

    // Pushed expand button should now be visible in main area
    const expandBtn = container.querySelector('button[title="Expand Workspace"]') as HTMLButtonElement;
    expect(expandBtn).not.toBeNull();
    expandBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Sidebar should expand back
    await vi.waitFor(() => {
      expect(rightSidebar.className).toContain('w-96');
    });
  });

  it('tracks loaded images in recent uploads list and lets users load or delete them', async () => {
    // Stub FileReader & Image
    const mockReader = {
      readAsDataURL: vi.fn().mockImplementation(function(this: any) {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/png;base64,mockImageSource' } });
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
          drawImage: vi.fn(),
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

    // 1. Upload mock image
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'scenery.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for image onload and state updates
    await vi.waitFor(() => {
      const recentList = container.querySelector('div[title="scenery.png"]');
      expect(recentList).not.toBeNull();
    });

    // 2. Click thumbnail to load image
    const thumbnail = container.querySelector('div[title="scenery.png"]') as HTMLElement;
    thumbnail.click();
    await vi.waitFor(() => {
      expect(container.querySelector('canvas')).not.toBeNull();
    });

    // 3. Delete recent image
    const deleteBtn = thumbnail.querySelector('button[title="Delete Image"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();

    // Verify removed
    await vi.waitFor(() => {
      const recentList = container.querySelector('div[title="scenery.png"]');
      expect(recentList).toBeNull();
    });

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('triggers fitToContainer when Fit to Container button is clicked', async () => {
    // Stub FileReader & Image
    const mockReader = {
      readAsDataURL: vi.fn().mockImplementation(function(this: any) {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/png;base64,mockImageSource' } });
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
          drawImage: vi.fn(),
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

    // Upload mock image
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'scenery.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for image onload and state updates
    await vi.waitFor(() => {
      expect(container.querySelector('canvas')).not.toBeNull();
    });

    // Query and click Zoom button
    const fitBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Zoom')
    );
    expect(fitBtn).not.toBeUndefined();
    fitBtn!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(mockFitToContainer).toHaveBeenCalled();

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('supports sorting columns in the DMC Supply List on header clicks', async () => {
    render(<App />, container);

    // Click DMC header to sort by code
    const dmcHeader = Array.from(container.querySelectorAll('.no-print th')).find(
      (th) => th.textContent?.includes('DMC')
    ) as HTMLElement;
    expect(dmcHeader).not.toBeUndefined();

    // Click it to trigger sort
    dmcHeader.click();
    await vi.waitFor(() => {
      expect(dmcHeader.textContent).toContain('▲');
    });

    // Click it again to reverse sort direction
    dmcHeader.click();
    await vi.waitFor(() => {
      expect(dmcHeader.textContent).toContain('▼');
    });
  });
});
