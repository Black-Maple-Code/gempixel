// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { App } from '../App';
import { MatcherClient } from '../engine/worker-client';
import { DMC_PALETTE } from '../engine/palette';
import { __setOffscreenSupportForTest } from '../features/match/useDiamondArtMatch';

// Mock canvas viewer spies
const mockSetData = vi.fn();
const mockSetDrillStyle = vi.fn();
const mockSetHighlightedColor = vi.fn();
const mockSetDrillType = vi.fn();
const mockFitToContainer = vi.fn();
const mockDestroy = vi.fn();
const mockSetViewMode = vi.fn();
const mockSetSymbolMap = vi.fn();
const mockSetRoundBacking = vi.fn();
const mockSetGridGap = vi.fn();

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
        setRoundBacking: mockSetRoundBacking,
        setGridGap: mockSetGridGap,
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
    // The hook now decodes off-thread via createImageBitmap + a worker OffscreenCanvas
    // path; jsdom has neither, so force the capability probe true (D-08) and stub the
    // cheap main-thread createImageBitmap so matching still triggers.
    __setOffscreenSupportForTest(true);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 10, height: 10, close: vi.fn() }))
    );
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    __setOffscreenSupportForTest(null);
    // NOTE: intentionally NOT calling vi.unstubAllGlobals() here — several tests below
    // rely on Image/FileReader global stubs leaking from an earlier test to load an image.
    // The per-test beforeEach re-stubs createImageBitmap regardless.
  });

  it('renders base checklist options correctly', async () => {
    render(<App />, container);

    // Re-pointed (23-07): color-exclusion now lives in the RefineScreen "Advanced"
    // disclosure (step-2 panel), not the legacy right aside deleted in Plan 08. Open the
    // native <details> — RefineScreen mounts the exclusion list only while Advanced is open
    // (it gates the list on the toggle event) — then assert the exclude checkboxes appear.
    // Match by the surviving structure/copy, not the legacy right-aside capital-C string.
    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    const advanced = step2.querySelector('details') as HTMLDetailsElement;
    expect(advanced).not.toBeNull();
    advanced.open = true;
    advanced.dispatchEvent(new Event('toggle', { bubbles: false }));

    await vi.waitFor(() => {
      const checkboxes = step2.querySelectorAll('input[type="checkbox"]');
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

    // The first call should have all colors active (none in excludedColors).
    // New match() signature: (bitmap, cols, rows, candidates, ...) → candidates at index 3.
    const initialCandidates = mockMatch.mock.calls[mockMatch.mock.calls.length - 1][3];
    expect(initialCandidates.length).toBe(DMC_PALETTE.length);

    // Clear call history
    mockMatch.mockClear();

    // Re-pointed (23-07): the color-exclusion checklist now lives in the RefineScreen
    // "Advanced" disclosure (step-2 panel), not the legacy right aside deleted in Plan 08.
    // Open the native <details> (RefineScreen mounts the exclusion list only while Advanced
    // is open) and toggle the first color there. NOTE the inverted checkbox semantics vs.
    // the legacy aside: RefineScreen checkboxes are `checked === excluded`, so they start
    // UNCHECKED (nothing excluded) and clicking one EXCLUDES that color — which is what
    // shrinks the candidate list by 1.
    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    const advanced = step2.querySelector('details') as HTMLDetailsElement;
    expect(advanced).not.toBeNull();
    advanced.open = true;
    advanced.dispatchEvent(new Event('toggle', { bubbles: false }));

    // Wait for the exclusion list to mount, then toggle the first color's checkbox.
    let checkboxes: NodeListOf<Element> = [] as any;
    await vi.waitFor(() => {
      checkboxes = step2.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    const firstCheckbox = checkboxes[0] as HTMLInputElement;
    expect(firstCheckbox.checked).toBe(false);

    // Click checkbox once (natively toggles state and fires click/change in jsdom) → excludes it
    firstCheckbox.click();

    // Wait for match recalculation
    await new Promise(r => setTimeout(r, 100));

    // Worker match should be triggered again
    expect(mockMatch).toHaveBeenCalled();

    // Candidate list passed should now be 1 less (candidates at index 3 in the new signature)
    const updatedCandidates = mockMatch.mock.calls[mockMatch.mock.calls.length - 1][3];
    expect(updatedCandidates.length).toBe(DMC_PALETTE.length - 1);

    // Clean up globals
    vi.unstubAllGlobals();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  // RETIRED (23-07, gap closure for Phase 23 UAT Test 26): "updates highlighted color codes
  // in the viewer when legend rows are selected" covered the interactive, click-to-highlight
  // sortable legend that lived ONLY in the legacy right <aside>. That aside is deleted in
  // Plan 08; the new SuppliesScreen table is display-only by design (SUPPLIES-01), so there
  // is no highlight-on-row-click behavior to cover. Strangler retirement pulled forward from
  // Phase 25 — intentional coverage removal of deleted chrome, not a regression.

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

  // Re-homed to the RefineScreen custom-size entry (23-03): width/ratio editing moved OFF
  // Upload (D-10/SC1). App's handleWidthChange still owns the aspect-ratio auto-adjust; the
  // Refine custom cols/rows inputs forward the strings to it.
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

    // 2. Load the image (the new Upload screen owns #upload-file-input).
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for image onload macro-task
    await vi.waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    // D-08 / SC5: a successful ingest auto-advances Upload → Refine (step 2). The
    // panel-2 wrapper becomes the visible (display:contents) step and panel-1 hides.
    await vi.waitFor(() => {
      const panel2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
      expect(panel2.className).toContain('contents');
      const panel1 = container.querySelector('[data-step-panel="1"]') as HTMLElement;
      expect(panel1.className).toContain('hidden');
    });

    // Reveal the Refine custom-size entry (always-mounted panel-2).
    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    const customBtn = Array.from(step2.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Custom size'
    ) as HTMLButtonElement;
    customBtn.click();
    await new Promise(r => setTimeout(r, 10));

    const widthEl = step2.querySelector('#refine-width') as HTMLInputElement;
    const heightEl = step2.querySelector('#refine-height') as HTMLInputElement;

    // Change width to 20 → ratio 2:1 (image 100×50) auto-adjusts height to 10.
    widthEl.value = '20';
    widthEl.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for the render cycle to complete and verify ratio
    await vi.waitFor(() => {
      expect(widthEl.value).toBe('20');
      expect(heightEl.value).toBe('10');
    });

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  // On-load-default reconciliation (260717-02w / size-selection-crops-image note #2):
  // loadImageFile now derives its default dims via aspectAwareGrid on the Medium (BEST) tier,
  // so the default grid equals the Medium RefineScreen card exactly — its selected-highlight
  // lands immediately on upload (exactly one card highlighted), still crop-free.
  it('a 2:3 portrait upload defaults to the Medium tier (73×110) and highlights the Medium card on load', async () => {
    const mockReader = {
      readAsDataURL: vi.fn().mockImplementation(function(this: any) {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/png;base64,mock' } });
        }
      }),
    };
    vi.stubGlobal('FileReader', vi.fn().mockImplementation(() => mockReader));

    const mockImageInstance = {
      naturalWidth: 1000,
      naturalHeight: 1500,
      width: 1000,
      height: 1500,
      set src(_val: string) {
        if (this.onload) {
          setTimeout(() => this.onload(), 0);
        }
      },
      onload: null as any,
    };
    vi.stubGlobal('Image', vi.fn().mockImplementation(() => mockImageInstance));

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(1000 * 1500 * 4),
        width: 1000,
        height: 1500,
      }),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type) => {
      if (type === '2d') return mockContext as any;
      return null;
    });

    render(<App />, container);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'portrait.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;

    // Live cols/rows === aspectAwareGrid(80, 53, 1000, 1500): long-axis budget 80 on the
    // vertical axis, short axis round(80 * (1000/1500)) = 53.
    const customBtn = Array.from(step2.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Custom size'
    ) as HTMLButtonElement;
    customBtn.click();
    await new Promise(r => setTimeout(r, 10));

    const widthEl = step2.querySelector('#refine-width') as HTMLInputElement;
    const heightEl = step2.querySelector('#refine-height') as HTMLInputElement;
    expect(widthEl.value).toBe('73');
    expect(heightEl.value).toBe('110');

    // Exactly one card highlighted: Medium aria-pressed true, Small/Large false.
    const cards = Array.from(step2.querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];
    const mediumCard = cards.find(c => c.textContent?.includes('Medium'))!;
    const smallCard = cards.find(c => c.textContent?.includes('Small'))!;
    const largeCard = cards.find(c => c.textContent?.includes('Large'))!;
    expect(mediumCard.getAttribute('aria-pressed')).toBe('true');
    expect(smallCard.getAttribute('aria-pressed')).toBe('false');
    expect(largeCard.getAttribute('aria-pressed')).toBe('false');

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('an exact-3:2 upload keeps the 110×73 default (byte-identical) and highlights Medium', async () => {
    const mockReader = {
      readAsDataURL: vi.fn().mockImplementation(function(this: any) {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/png;base64,mock' } });
        }
      }),
    };
    vi.stubGlobal('FileReader', vi.fn().mockImplementation(() => mockReader));

    const mockImageInstance = {
      naturalWidth: 3000,
      naturalHeight: 2000,
      width: 3000,
      height: 2000,
      set src(_val: string) {
        if (this.onload) {
          setTimeout(() => this.onload(), 0);
        }
      },
      onload: null as any,
    };
    vi.stubGlobal('Image', vi.fn().mockImplementation(() => mockImageInstance));

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(3000 * 2000 * 4),
        width: 3000,
        height: 2000,
      }),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type) => {
      if (type === '2d') return mockContext as any;
      return null;
    });

    render(<App />, container);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'landscape.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;

    // aspectAwareGrid(80, 53, 3000, 2000) at ar=1.5 reproduces the preset dims byte-for-byte:
    // cols 80, rows round(80/1.5) = 53 — unchanged from prior behavior.
    const customBtn = Array.from(step2.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Custom size'
    ) as HTMLButtonElement;
    customBtn.click();
    await new Promise(r => setTimeout(r, 10));

    const widthEl = step2.querySelector('#refine-width') as HTMLInputElement;
    const heightEl = step2.querySelector('#refine-height') as HTMLInputElement;
    expect(widthEl.value).toBe('110');
    expect(heightEl.value).toBe('73');

    const cards = Array.from(step2.querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];
    const mediumCard = cards.find(c => c.textContent?.includes('Medium'))!;
    expect(mediumCard.getAttribute('aria-pressed')).toBe('true');

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  // Re-homed to the RefineScreen SizeCards (23-03): the legacy preset-size <select> moved
  // OFF Upload (D-10/SC1) and is replaced by curated grid SizeCards (REFINE-01/D-05).
  // Selecting a card applies its grid dims to the live cols/rows (worker tier). The "units"
  // half of the old case is dropped — the canvas-first custom entry is grid-native (D-05).
  it('updates grid dimensions when a Refine size card is selected', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    const step2 = () => container.querySelector('[data-step-panel="2"]') as HTMLElement;

    // Reveal the custom entry to read back the applied dims.
    const customBtn = Array.from(step2().querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Custom size'
    ) as HTMLButtonElement;
    customBtn.click();
    await new Promise(r => setTimeout(r, 10));

    const cards = () => Array.from(step2().querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];
    const widthEl = () => step2().querySelector('#refine-width') as HTMLInputElement;
    const heightEl = () => step2().querySelector('#refine-height') as HTMLInputElement;

    // Select "Small" (80×53).
    cards().find(c => c.textContent?.includes('80×53 grid'))!.click();
    await vi.waitFor(() => {
      expect(widthEl().value).toBe('80');
      expect(heightEl().value).toBe('53');
    });

    // Select "Extra large" (190×127).
    cards().find(c => c.textContent?.includes('190×127 grid'))!.click();
    await vi.waitFor(() => {
      expect(widthEl().value).toBe('190');
      expect(heightEl().value).toBe('127');
    });
  });

  // RETIRED (23-07, gap closure for Phase 23 UAT Test 26): the left "Setup" fixed-width
  // sidebar and its collapse/expand affordance are deleted in Plan 08 — the user asked to
  // retire the left-hand menu and move those options into the viewport. The collapse chrome
  // ceases to exist, so its test goes with it (Phase 25 strangler retirement pulled forward
  // — intentional removal of deleted chrome, not a regression).

  // RETIRED (23-07): "collapses and expands the DMC Supply List" covered the collapsible
  // DMC Supply List that lived ONLY in the legacy right <aside> (deleted in Plan 08). The
  // canvas-first SuppliesScreen replaces it with a display-only table (covered by
  // SuppliesScreen unit tests), so the collapse toggle no longer exists. Intentional
  // strangler retirement of deleted chrome.

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

  // RETIRED (23-07, gap closure for Phase 23 UAT Test 26): the right "Color Legend"
  // fixed-width workspace <aside> and its collapse/expand affordance are deleted in Plan 08.
  // The legend/supply content is re-homed to the canvas-first SuppliesScreen; the collapse
  // chrome ceases to exist, so its test is retired (intentional strangler retirement of
  // deleted chrome, pulled forward from Phase 25).

  // DELETED (23-03): "tracks loaded images in recent uploads list…" — the legacy
  // recent-UPLOADS strip (raw images via #source-image-toggle inside Step1Ingest) is not
  // surfaced by the canvas-first UploadScreen, which shows recent PROJECTS from
  // projectStore.list() instead (D-10/UI-SPEC A1). Recent raw-image chips are not part of
  // the v4.0 customer flow, so this exercise has no home. The projectStore recents store
  // itself remains covered by its own engine unit tests; recent-PROJECT load is covered by
  // UploadScreen.test.tsx ("calls loadProject(id) on click").

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

  // RETIRED (23-07, gap closure for Phase 23 UAT Test 26): "supports sorting columns in the
  // DMC Supply List" covered the sortable column headers that lived ONLY on the legacy right
  // <aside> supply list (deleted in Plan 08). The canvas-first SuppliesScreen table is
  // display-only by design (SUPPLIES-01) with no sort affordance, so this behavior no longer
  // exists — intentional strangler retirement of deleted chrome, pulled forward from Phase 25.
});
