// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { App, aspectAwareGrid } from '../App';
import { planOrderSupply } from '../engine/bagPlanner';
import { DMC_PALETTE } from '../engine/palette';
import { calculateCropBounds } from '../engine/ingest';
import { triggerCanvasDownload } from '../engine/export';
import { compileShopifyCartLink } from '../engine/checkout';

// ERR-01: force the canvas download to fail so the action-error banner path is
// exercised deterministically (jsdom has no 2D context, but this guarantees the
// catch fires regardless). All other export helpers stay real.
vi.mock('../engine/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/export')>();
  return {
    ...actual,
    triggerCanvasDownload: vi.fn(() => {
      throw new Error('mock download failure');
    }),
  };
});

// ERR-01: make checkout report an unmapped item so handleShopifyCheckout reliably
// enters the (guarded) unmapped-colors-log read/write branch. calculateCanvasCost
// and VENDOR_REGISTRY (used by the cost tests) stay real.
vi.mock('../engine/checkout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/checkout')>();
  return {
    ...actual,
    compileShopifyCartLink: vi.fn(() => ({
      url: 'https://example.com/cart',
      isUrlTooLong: false,
      unmappedItems: [{ dmcCode: '939', handle: '' }],
    })),
  };
});

// Mock worker client and canvas viewer
vi.mock('../engine/worker-client', () => {
  return {
    MatcherClient: class MockMatcherClient {
      match = vi.fn();
      terminate = vi.fn();
    }
  };
});

// SC4/D-14 single-mount identity: count CanvasViewer constructions so a test can
// assert the viewer is instantiated once and never re-instantiated on a step change.
const viewerConstructions = vi.hoisted(() => ({ count: 0 }));

vi.mock('../engine/viewer', () => {
  return {
    CanvasViewer: class MockCanvasViewer {
      constructor() { viewerConstructions.count++; }
      setData = vi.fn();
      setDrillStyle = vi.fn();
      setHighlightedColor = vi.fn();
      setDrillType = vi.fn();
      fitToContainer = vi.fn();
      destroy = vi.fn();
      setViewMode = vi.fn();
      setSymbolMap = vi.fn();
      setRoundBacking = vi.fn();
      setGridGap = vi.fn();
      zoomIn = vi.fn();
      zoomOut = vi.fn();
      resetZoom = vi.fn();
    }
  };
});

describe('App Component Mounting and Basic UI Inputs', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    // Restore Storage.prototype spies so blocked-storage simulation cannot leak
    // into other cases (RESEARCH Wave 0 gap).
    vi.restoreAllMocks();
  });

  it('mounts under blocked storage without throwing', () => {
    // Simulate private-mode / disabled storage: every access throws (STORE-01).
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(() => render(<App />, container)).not.toThrow();

    const wordmark = container.querySelector('header span.font-display');
    expect(wordmark).toBeTruthy();
    expect(wordmark?.textContent).toBe('GemPixel');

    // Regression guard: no <h1> in the DOM is the exact wordmark (the sidebar
    // brand cluster was removed; the surviving print-only <h1> is the report title).
    const wordmarkHeadings = Array.from(container.querySelectorAll('h1')).filter(
      (h) => h.textContent === 'GemPixel',
    );
    expect(wordmarkHeadings.length).toBe(0);
  });

  it('renders dashboard shell elements', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Verify application header wordmark exists (top-bar Newsreader span)
    const wordmark = container.querySelector('header span.font-display');
    expect(wordmark).toBeTruthy();
    expect(wordmark?.textContent).toBe('GemPixel');

    // Regression guard: no <h1> in the DOM is the exact wordmark.
    const wordmarkHeadings = Array.from(container.querySelectorAll('h1')).filter(
      (h) => h.textContent === 'GemPixel',
    );
    expect(wordmarkHeadings.length).toBe(0);

    // 23-02 (D-10/SC1): canvas-size selection moved OFF Upload to Refine (23-03),
    // so the VISIBLE Upload panel now hosts NO sizing number inputs. (Size-input
    // coverage returns in 23-03 against the RefineScreen.)
    const numberInputs = container.querySelectorAll('[data-step-panel]:not(.hidden) input[type="number"]');
    expect(numberInputs.length).toBe(0);

    // The Upload screen still owns the ingest file input.
    const fileInput = container.querySelector('#upload-file-input');
    expect(fileInput).toBeTruthy();
  });

  // Re-homed from the legacy Upload "Size" tab (23-03): canvas-size editing now lives
  // in the RefineScreen custom-size entry (D-10/SC1). Panel-2 is always-mounted, so the
  // custom cols/rows inputs are driven directly without wizard navigation.
  it('allows changing width and height in the Refine custom-size entry (grid mode)', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    // Reveal the custom cols/rows entry (accent "Custom size" toggle).
    const customBtn = Array.from(step2.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Custom size'
    ) as HTMLButtonElement;
    expect(customBtn).toBeTruthy();
    customBtn.click();

    // Poll for the revealed custom entry rather than a fixed delay — under heavy
    // parallel test load the App render/effect settle can exceed a fixed 10ms wait,
    // which made the initial-value read intermittently flaky (the panel-3 SuppliesScreen
    // table added to every always-mounted render). vi.waitFor is deterministic.
    let widthInput!: HTMLInputElement;
    let heightInput!: HTMLInputElement;
    await vi.waitFor(() => {
      widthInput = step2.querySelector('#refine-width') as HTMLInputElement;
      heightInput = step2.querySelector('#refine-height') as HTMLInputElement;
      expect(widthInput).toBeTruthy();
      expect(heightInput).toBeTruthy();
      expect(widthInput.value).toBe('80');
      expect(heightInput.value).toBe('53');
    });

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    valueSetter?.call(widthInput, '60');
    widthInput.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(widthInput.value).toBe('60'));

    valueSetter?.call(heightInput, '45');
    heightInput.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(heightInput.value).toBe('45'));
  });

  // DELETED (23-03): "allows changing physical sizing units" — the cm/inch/grid unit
  // switcher was a legacy Upload/Step control. The canvas-first RefineScreen custom-size
  // entry is grid-native (D-05: cols/rows), so the unit switcher has no home in the new
  // UI and the case no longer applies. Grid ↔ inch derivation is covered by density.ts
  // unit tests (gridToInches/formatInches) and the SizeCard inch-string assertions.

  // RETIRED(26-03): "calculates supply costing commission quotes correctly in quote tab"
  // asserted the editable pricing-config grid (canvas cost, est. shipping, per-bag
  // 200/500/1k/2k inputs) in the deleted Step3Canvas body. That price-EDITING UI has no
  // canvas-first home (SuppliesScreen is a read-only supply table + single-source order
  // summary, D-07). The priceDb still feeds planOrderSupply/buildOrderQuote (covered by
  // the BAG-02 totalPackets test + quote engine unit tests); only its input grid is gone.
  // Strangler-close retirement (D-02), mirroring the Phase 23 aside-retargeting precedent.

  // RETIRED (23-07, gap closure for Phase 23 UAT Test 26): "supports bottom bar navigation
  // for responsive mobile drawer toggles" asserted the collapse state (`w-0`) of the two
  // legacy asides (left "Setup" + right "Color Legend") driven by the mobile bottom-tab bar.
  // Both asides are deleted in Plan 08 (the user asked to retire the left-hand menu and move
  // those options into the viewport), so the collapse chrome ceases to exist — intentional
  // strangler retirement of deleted chrome, pulled forward from Phase 25. Canvas-first
  // navigation is covered by the StepBar/#wizard-*-btn tests, which survive the flip.

  // RETIRED(25-01): the legacy drill-TYPE select (standard/ab/glow/crystal) lived in the
  // deleted Step2Palette panel-2 body. The priceDb drill-type preset effect still runs;
  // drill type has no canvas-first UI home this milestone.

  // RETIRED(26-03): "renders the 4 per-bag-size price inputs unconditionally" asserted the
  // same deleted Step3Canvas price-config grid (canvas/shipping + 200/500/1k/2k inputs).
  // SuppliesScreen is read-only, so the grid has no canvas-first home; the underlying
  // priceDb presets are covered by the drill-type preset effect + quote engine unit tests.
  // Strangler-close retirement (D-02).

  describe('Commissions Workspace LocalStorage and Project Switching', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('handles project saving, summary registry addition, state recovery, deletion, and reset', async () => {
      render(<App />, container);
      await new Promise(r => setTimeout(r, 0));

      // 1. Initially, no commissions should be saved
      expect(localStorage.getItem('gempixel_workspace_registry')).toBeNull();

      const mockProjectSummary = {
        id: 'test-uuid-123',
        name: 'Client A Commission',
        thumbnail: 'data:image/jpeg;base64,thumb',
        dateModified: new Date().toISOString(),
        dateCreated: new Date().toISOString()
      };

      const mockProjectData = {
        id: 'test-uuid-123',
        name: 'Client A Commission',
        dateCreated: mockProjectSummary.dateCreated,
        dateModified: mockProjectSummary.dateModified,
        imageName: 'test.jpg',
        dimensions: { cols: 40, rows: 30 },
        drillStyle: 'round',
        selectedBaseKit: '100',
        safetyMargin: 10,
        laborMarkup: 50,
        kitBaseCost: 20,
        drillPacketCost: 0.5,
        excludedDmcCodes: ['310'],
        pricesPerBagSize: { 200: 0.8, 500: 1.5, 1000: 2.5, 2000: 4.5 },
        drillType: 'ab',
        canvasTemplate: 'https://custom.com/{size}',
        affiliateTag: 'my-tag',
        affiliateApp: 'ref',
        gridData: [0, 1, 2] // pointers to palette
      };

      // Save mock project to localStorage directly
      localStorage.setItem('gempixel_workspace_registry', JSON.stringify([mockProjectSummary]));
      localStorage.setItem('gempixel_project_test-uuid-123', JSON.stringify(mockProjectData));

      // Re-render App so it loads the registry from localStorage
      render(null, container);
      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Load via the always-mounted UploadScreen recent-project chip (D-10) — the
      // legacy "My Images" left drawer is retired in Plan 08. The chip's load button
      // calls the same App loadProject(id) the drawer row called.
      const loadChip = Array.from(
        container.querySelectorAll('[data-screen="upload"] button'),
      ).find(b => b.textContent?.includes('Client A Commission')) as HTMLButtonElement;
      expect(loadChip).toBeTruthy();
      expect(loadChip.textContent).toContain('Client A Commission');

      // Verify canvas is NOT rendered initially (since matchResult and image are null on fresh mount before load)
      const initialCanvas = container.querySelector('canvas');
      expect(initialCanvas).toBeNull();

      // Click the chip to load configuration
      loadChip.click();
      await new Promise(r => setTimeout(r, 10));

      // Verify canvas mounts successfully (because matchResult is restored even without raw image!)
      const canvasAfterLoad = container.querySelector('canvas');
      expect(canvasAfterLoad).toBeTruthy();

      // (Size-input restoration verification moved to 23-03: canvas-size controls
      //  now live on Refine, not Upload — D-10/SC1. Project load still rehydrates
      //  cols/rows state; that is asserted through Refine's tests in 23-03.)

      // Verify workspace reset to default config on reset/new action
      const newBtn = container.querySelector('#new-project-btn') as HTMLButtonElement;
      expect(newBtn).toBeTruthy();
      newBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // After reset, we should be on Step 1, and the Next button should be disabled because image & project ID are reset
      const nextBtnAfterReset = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      expect(nextBtnAfterReset).toBeTruthy();
      expect(nextBtnAfterReset.disabled).toBe(true);

      // And canvas should unmount because matchResult is reset to null
      expect(container.querySelector('canvas')).toBeNull();

      // Verify removal of registry and project details on deletion via the
      // UploadScreen recent-chip Remove affordance (inline "Remove? Yes / Cancel",
      // D-10) — the legacy left "My Images" drawer + its ×/"Delete Image" button are
      // retired in Plan 08. Wires to the same App onDeleteProject → projectStore.remove.
      render(null, container);
      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Click the chip's ghost "Remove" → inline confirm appears.
      const removeBtn = Array.from(
        container.querySelectorAll('[data-screen="upload"] button'),
      ).find(b => b.textContent?.trim() === 'Remove') as HTMLButtonElement;
      expect(removeBtn).toBeTruthy();
      removeBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Confirm the removal ("Yes").
      const confirmYes = Array.from(
        container.querySelectorAll('[data-screen="upload"] button'),
      ).find(b => b.textContent?.trim() === 'Yes') as HTMLButtonElement;
      expect(confirmYes).toBeTruthy();
      confirmYes.click();
      await new Promise(r => setTimeout(r, 10));

      // Registry should be empty now
      const registryAfterDelete = JSON.parse(localStorage.getItem('gempixel_workspace_registry') || '[]');
      expect(registryAfterDelete.length).toBe(0);
      expect(localStorage.getItem('gempixel_project_test-uuid-123')).toBeNull();
    });

    it('asserts step progression using Back/Next footer buttons and validation lock when both image and project ID are missing', async () => {
      render(<App />, container);
      await new Promise(r => setTimeout(r, 0));

      // Initially on step 1 (Upload)
      // Check that Next button is disabled because both image and project ID are missing
      const nextBtn = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      expect(nextBtn).toBeTruthy();
      expect(nextBtn.disabled).toBe(true);

      // Back button should not be rendered on step 1
      const backButtons = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === 'Back');
      expect(backButtons.length).toBe(0);
    });

    it('allows progression for loaded projects even with null image, verifies back/next navigation and display isolation of active step options', async () => {
      const mockProjectSummary = {
        id: 'test-project-999',
        name: 'Null Image Project',
        thumbnail: '',
        dateModified: new Date().toISOString(),
        dateCreated: new Date().toISOString()
      };

      const mockProjectData = {
        id: 'test-project-999',
        name: 'Null Image Project',
        dateCreated: mockProjectSummary.dateCreated,
        dateModified: mockProjectSummary.dateModified,
        imageName: 'project.json',
        dimensions: { cols: 60, rows: 40 },
        drillStyle: 'square',
        selectedBaseKit: '200',
        safetyMargin: 10,
        laborMarkup: 20,
        kitBaseCost: 15,
        drillPacketCost: 0.25,
        excludedDmcCodes: [],
        pricesPerBagSize: { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 },
        drillType: 'standard',
        canvasTemplate: 'https://custom.com/{size}',
        affiliateTag: 'tag',
        affiliateApp: 'ref',
        gridData: [1, 2, 3]
      };

      localStorage.setItem('gempixel_workspace_registry', JSON.stringify([mockProjectSummary]));
      localStorage.setItem('gempixel_project_test-project-999', JSON.stringify(mockProjectData));

      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Load via the always-mounted UploadScreen recent-project chip (D-10); the
      // legacy "My Images" left drawer is retired in Plan 08. Same App loadProject(id).
      const loadChip = Array.from(
        container.querySelectorAll('[data-screen="upload"] button'),
      ).find(b => b.textContent?.includes('Null Image Project')) as HTMLButtonElement;
      expect(loadChip).toBeTruthy();
      loadChip.click();
      await new Promise(r => setTimeout(r, 10));

      // Next button should now be enabled because project ID is loaded, even though image is null
      const nextBtn = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      expect(nextBtn).toBeTruthy();
      expect(nextBtn.disabled).toBe(false);

      // D-14: the step panels are now always-mounted CSS-toggled siblings, so
      // "display isolation" means only the VISIBLE panel (not display:none-d)
      // shows its content — the others are hidden in the tree, not unmounted.
      // Scope every isolation assertion to the visible panel.
      const visiblePanel = () => container.querySelector('[data-step-panel]:not(.hidden)') as HTMLElement;

      // Verify display isolation: Step 1 options are shown, but Step 2 (Palette & kit) is not
      const selectElementsInitial = Array.from(visiblePanel().querySelectorAll('select'));
      // 23-02: the sizing preset select moved OFF Upload (D-10 → Refine, 23-03).
      // Upload's own marker is now its ingest file input.
      expect(visiblePanel().querySelector('#upload-file-input')).toBeTruthy(); // Step 1 (Upload) element
      const initialKitSelect = selectElementsInitial.find(s => s.value === '200');
      expect(initialKitSelect).toBeUndefined(); // Step 2 kit select not in the visible panel

      // Progress to Step 2
      nextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 2 (Refine)
      // Verify display isolation: the visible panel shows Step 2 options, not Step 1 (upload/sizing)
      expect(visiblePanel().querySelector('#upload-file-input')).toBeNull(); // isolated
      expect(visiblePanel().querySelector('input[data-field="width"]')).toBeNull(); // isolated
      const selectElementsStep2 = Array.from(visiblePanel().querySelectorAll('select'));
      const step2KitSelect = selectElementsStep2.find(s => s.value === '200'); // Loaded project selectedBaseKit is '200'
      expect(step2KitSelect).toBeTruthy();

      // Back button should be visible on step 2
      const backBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Back') as HTMLButtonElement;
      expect(backBtn).toBeTruthy();

      // Progress to Step 3
      const nextBtnStep2 = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      nextBtnStep2.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 3 (Supplies)
      // Verify display isolation: the visible panel shows Step 3 options, not Step 2 (DMC kit select)
      expect(Array.from(visiblePanel().querySelectorAll('select')).find(s => s.value === '200')).toBeUndefined(); // isolated
      // 23-04: panel-3 is now the canvas-first SuppliesScreen (USE_NEW_SUPPLIES), so
      // the Step-3 marker is its data-screen root, not the legacy vendor select.
      expect(visiblePanel().querySelector('[data-screen="supplies"]')).toBeTruthy(); // Step 3 marker

      // Progress to Step 4
      const nextBtnStep3 = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      nextBtnStep3.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 4 (Order)
      // Verify next button is null (final step)
      const nextBtnStep4 = container.querySelector('#wizard-next-btn');
      expect(nextBtnStep4).toBeNull();
      // 23-05: panel-4 is now the canvas-first OrderScreen (USE_NEW_ORDER), so the
      // Step-4 marker is its data-screen root, not the legacy Step4Export save form.
      expect(visiblePanel().querySelector('[data-screen="order"]')).toBeTruthy(); // Step 4 marker

      // Go back to Step 3
      const backBtnStep4 = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Back') as HTMLButtonElement;
      backBtnStep4.click();
      await new Promise(r => setTimeout(r, 10));

      // Now back on Step 3. Go back to Step 2
      const backBtnStep3 = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Back') as HTMLButtonElement;
      backBtnStep3.click();
      await new Promise(r => setTimeout(r, 10));

      // Should be back on Step 2
      expect(Array.from(visiblePanel().querySelectorAll('select')).find(s => s.value === '200')).toBeTruthy();
    });

    it('renders exactly one step navigator — the StepBar (SC3/D-03)', async () => {
      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // The StepBar's <nav aria-label="Progress"> is the ONE and only step navigator.
      const navs = container.querySelectorAll('nav[aria-label="Progress"]');
      expect(navs.length).toBe(1);

      // Its buttons carry the single-source STEP_META labels (D-02).
      const stepLabels = Array.from(navs[0].querySelectorAll('button')).map(b => b.textContent || '');
      expect(stepLabels.some(t => t.includes('Upload'))).toBe(true);
      expect(stepLabels.some(t => t.includes('Refine'))).toBe(true);
      expect(stepLabels.some(t => t.includes('Supplies'))).toBe(true);
      expect(stepLabels.some(t => t.includes('Order'))).toBe(true);

      // The legacy desktop dot-nav is gone (D-03): it rendered step buttons whose
      // entire text was just a bare step number (1/2/3/4). No such button remains —
      // the StepBar tabs pair each number with a label, so only the single StepBar
      // navigator is present.
      const bareDotButtons = Array.from(container.querySelectorAll('button')).filter(
        b => ['1', '2', '3', '4'].includes((b.textContent || '').trim())
      );
      expect(bareDotButtons.length).toBe(0);
    });

    it('keeps a single CanvasViewer mounted across step changes (SC4/D-14)', async () => {
      const nowStr = new Date().toISOString();
      const summary = { id: 'test-project-singlemount', name: 'Single Mount', thumbnail: '', dateModified: nowStr, dateCreated: nowStr };
      const data = {
        id: 'test-project-singlemount',
        name: 'Single Mount',
        dateCreated: nowStr,
        dateModified: nowStr,
        imageName: 'project.json',
        dimensions: { cols: 60, rows: 40 },
        drillStyle: 'square',
        selectedBaseKit: '200',
        drillType: 'standard',
        excludedDmcCodes: [],
        pricesPerBagSize: { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 },
        gridData: [1, 2, 3]
      };
      localStorage.setItem('gempixel_workspace_registry', JSON.stringify([summary]));
      localStorage.setItem('gempixel_project_test-project-singlemount', JSON.stringify(data));

      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Load the project so a match restores and the canvas host mounts. Load via the
      // always-mounted UploadScreen recent-project chip (D-10) — the legacy "My Images"
      // left drawer is retired in Plan 08; the chip calls the same App loadProject(id).
      const loadChip = Array.from(
        container.querySelectorAll('[data-screen="upload"] button'),
      ).find(b => b.textContent?.includes('Single Mount')) as HTMLButtonElement;
      expect(loadChip).toBeTruthy();
      loadChip.click();
      await new Promise(r => setTimeout(r, 10));

      // Let the async restore/match fully settle so any load-time viewer
      // construction is done before we measure.
      await new Promise(r => setTimeout(r, 50));

      const canvasBefore = container.querySelector('canvas');
      expect(canvasBefore).toBeTruthy();
      expect(viewerConstructions.count).toBeGreaterThanOrEqual(1);
      const constructionsAtMount = viewerConstructions.count;

      // Advance a step — the four step panels are CSS-toggled siblings, so nothing
      // around the single viewer unmounts.
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
      await new Promise(r => setTimeout(r, 50));

      // Same canvas DOM node (never remounted) and no new CanvasViewer construction
      // attributable to the step change (SC4/D-14).
      const canvasAfter = container.querySelector('canvas');
      expect(canvasAfter).toBe(canvasBefore);
      expect(viewerConstructions.count).toBe(constructionsAtMount);
    });

    // RETIRED(25-01): the auto-substitution checkbox + threshold slider lived in the
    // deleted Step2Palette panel-2 body. RefineScreen's color-count slider (REFINE-04) is
    // the canvas-first color-merge control; enableSubstitution still defaults ON in the pipeline.

    // RETIRED(26-03): "renders logged unmapped colors lists and handles clear action in
    // settings" drove the "Affiliate & Partner Settings" expander + unmapped-colors log +
    // "Clear Log" control in the deleted Step3Canvas body — a diagnostics surface with no
    // canvas-first home. The unmappedLog persistence itself still runs on checkout and is
    // covered by the retargeted W4/WR-02 corrupt-log guard tests below (which assert the
    // log is written/repaired). Strangler-close retirement (D-02).

    // RETIRED(25-01): the inline project save / Update / Save-as-Copy controls lived in
    // the deleted Step4Export panel-4 body. handleSaveProject + the workspace registry
    // logic are unchanged; project-save is not part of the four-screen customer flow.

    // RETIRED(25-01): the "Start New Image / Reset" button lived in the deleted
    // Step4Export panel-4 body. resetWorkspace is unchanged; it has no panel-4 trigger
    // in the four-screen flow this milestone (no canvas-first home).

    // Re-homed from the legacy aspect-ratio "Recommended Canvas Sizes" recs (23-03):
    // canvas-size preset selection is now the RefineScreen SizeCards (curated grid dims,
    // REFINE-01/D-05), not aspect-ratio recommendations. Panel-2 is always-mounted, so the
    // cards + selection are asserted directly. Selecting a card sets live cols/rows (worker
    // tier); the applied dims are read back through the custom-size inputs.
    it('renders Refine SizeCards and applies grid dims on select (REFINE-01)', async () => {
      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      const step2 = () => container.querySelector('[data-step-panel="2"]') as HTMLElement;

      // Four curated presets render as selectable SizeCards (aria-pressed buttons).
      const cards = () => Array.from(step2().querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];
      expect(cards().length).toBe(4);

      // Cards show true derived inches + a live drill count (never a mock label).
      const mediumCard = cards().find(c => c.textContent?.includes('80×53 grid'))!;
      expect(mediumCard).toBeTruthy();
      expect(mediumCard.textContent).toContain('8 × 5.3 in'); // gridToInches(80,53) → /10
      expect(mediumCard.textContent).toContain('4240'); // 80 × 53 drills
      // Medium (80×53) is the default selection.
      expect(mediumCard.getAttribute('aria-pressed')).toBe('true');

      // Reveal the custom entry to read back the applied dims.
      const customBtn = Array.from(step2().querySelectorAll('button')).find(
        b => b.textContent?.trim() === 'Custom size'
      ) as HTMLButtonElement;
      customBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Select the "Large" (110×73) card → live cols/rows update; Medium deselects.
      const largeCard = cards().find(c => c.textContent?.includes('110×73 grid'))!;
      expect(largeCard).toBeTruthy();
      largeCard.click();
      await new Promise(r => setTimeout(r, 10));

      expect(largeCard.getAttribute('aria-pressed')).toBe('true');
      expect(cards().find(c => c.textContent?.includes('80×53 grid'))!.getAttribute('aria-pressed')).toBe('false');
      expect((step2().querySelector('#refine-width') as HTMLInputElement).value).toBe('110');
      expect((step2().querySelector('#refine-height') as HTMLInputElement).value).toBe('73');
    });
  });

  describe('ERR-01 unified action-error banner', () => {
    const projectId = 'test-project-err01';

    // Seeds a loadable project whose gridData restores matchResult, which enables
    // the download/checkout controls in Step 3 (mirrors the unmapped-log test seed).
    const seedProject = () => {
      const nowStr = new Date().toISOString();
      const summary = {
        id: projectId,
        name: 'ERR01 Project',
        thumbnail: '',
        dateModified: nowStr,
        dateCreated: nowStr,
      };
      const data = {
        id: projectId,
        name: 'ERR01 Project',
        dateCreated: nowStr,
        dateModified: nowStr,
        dimensions: { cols: 80, rows: 53 },
        unit: 'grid',
        excludedColors: [],
        drillStyle: 'square',
        selectedBaseKit: 'all',
        drillType: 'standard',
        canvasBaseCost: 15,
        drillPacketCost: 0.25,
        drillBagSize: 200,
        laborFee: 25,
        markupType: 'fixed',
        pricesPerBagSize: { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 },
        gridData: [0, 1],
      };
      localStorage.setItem('gempixel_workspace_registry', JSON.stringify([summary]));
      localStorage.setItem(`gempixel_project_${projectId}`, JSON.stringify(data));
    };

    // Renders <App/>, loads the seeded project, and advances the wizard to targetStep.
    const loadProjectToStep = async (targetStep: number) => {
      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));
      // Load via the always-mounted UploadScreen recent-project chip (D-10) — the
      // legacy "My Images" left drawer is retired in Plan 08; same App loadProject(id).
      const loadChip = Array.from(
        container.querySelectorAll('[data-screen="upload"] button'),
      ).find(b => b.textContent?.includes('ERR01 Project')) as HTMLButtonElement;
      expect(loadChip).toBeTruthy();
      loadChip.click();
      await new Promise(r => setTimeout(r, 10));
      for (let s = 1; s < targetStep; s++) {
        (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
        await new Promise(r => setTimeout(r, 10));
      }
    };

    beforeEach(() => {
      localStorage.clear();
    });

    // RETARGETED(26-03): the canvas-download-error → actionError affordance was the legacy
    // "Download Canvas Grid (PNG)" trigger in the deleted Step3Canvas. handleDownloadCanvasOnly
    // is now reachable via the OrderScreen section-① "Download canvas grid" CTA
    // (order-download-canvas-cta), so drive it there — coverage of the handler's catch is
    // preserved on the live path (mirrors the Phase 23 aside-retargeting precedent).
    it('shows the actionError banner when a canvas download fails (W5)', async () => {
      seedProject();
      await loadProjectToStep(4);

      // triggerCanvasDownload is mocked to throw → the handler's catch must surface the
      // unified banner instead of a silent console.error-only no-op.
      const downloadBtn = container.querySelector(
        '[data-testid="order-download-canvas-cta"]',
      ) as HTMLButtonElement;
      expect(downloadBtn).toBeTruthy();
      downloadBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(container.textContent).toMatch(/could not generate the download/i);
    });

    // RETARGETED(26-03): the corrupt-unmapped-log checkout guard was the legacy "Order Drills"
    // trigger in the deleted Step3Canvas. handleShopifyCheckout is now reachable via the
    // OrderScreen section-② "Open drill cart at Diamond Drills USA" CTA (order-cart-cta), so
    // drive the guard there — the corrupt-log read/repair coverage is preserved on the live
    // path. The file-level compileShopifyCartLink mock returns an unmapped item ['939'], so the
    // guard branch runs; D-08 now surfaces the caveat on the actionError banner (no modal) while
    // the cart still opens (window.open stubbed for jsdom).
    it('guards a corrupt unmapped-colors log during checkout and still proceeds (W4)', async () => {
      seedProject();
      await loadProjectToStep(4);

      // Seed the corrupt value AFTER mount: usePersistentState's write-effect rewrites
      // this key to '[]' on mount, so it must be corrupted just before checkout reads it.
      localStorage.setItem('gempixel_unmapped_colors_log', '{not json');

      const cartBtn = container.querySelector(
        '[data-testid="order-cart-cta"]',
      ) as HTMLButtonElement;
      expect(cartBtn).toBeTruthy();

      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      try {
        // The unguarded JSON.parse would have thrown here (W4) — must not now.
        expect(() => cartBtn.click()).not.toThrow();
        await new Promise(r => setTimeout(r, 10));
      } finally {
        openSpy.mockRestore();
      }

      // Banner surfaced the corrupt-log note (D-08 folds it into the actionError banner) …
      expect(container.textContent).toMatch(/could not read the saved unmapped-colors log/i);
      // … and checkout proceeded: the corrupt value was replaced with a valid log
      // built from the [] fallback + the new unmapped code (no silent abort).
      expect(JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') ?? '[]')).toEqual(['939']);
    });

    // RETARGETED(26-03): same guard as W4 for a valid-JSON-but-wrong-type log ('5' -> number 5),
    // driven on the live OrderScreen cart CTA (order-cart-cta). The old guard only caught parse
    // THROWS, so [...5] on the next line threw a TypeError outside the try, killing checkout; the
    // shape check must fall back to [].
    it('guards a valid-JSON-but-wrong-type unmapped-colors log during checkout (WR-02)', async () => {
      seedProject();
      await loadProjectToStep(4);

      localStorage.setItem('gempixel_unmapped_colors_log', '5');

      const cartBtn = container.querySelector(
        '[data-testid="order-cart-cta"]',
      ) as HTMLButtonElement;
      expect(cartBtn).toBeTruthy();

      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      try {
        // Must not throw (the non-iterable spread would have) …
        expect(() => cartBtn.click()).not.toThrow();
        await new Promise(r => setTimeout(r, 10));
      } finally {
        openSpy.mockRestore();
      }

      // … banner surfaced and checkout proceeded with the [] fallback + new code.
      expect(container.textContent).toMatch(/could not read the saved unmapped-colors log/i);
      expect(JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') ?? '[]')).toEqual(['939']);
    });

    // RETIRED(25-01): the save-quota-via-Update test drove the deleted Step4Export
    // panel-4 save form. handleSaveProject + its quota→actionError catch are unchanged;
    // the OrderScreen packet-download-error banner (below) covers the surviving surface.

    // Re-homed from the W5 canvas-PNG download-error skip (23-04): the download-error
    // affordance now lives on the OrderScreen (the honest packet download, D-08). The
    // handler wraps buildOrderPacket + the Blob download in a try/catch and surfaces
    // the shared actionError banner. Force URL.createObjectURL to throw and assert the
    // banner — the handler must never fail silently. Also proves the terminal state
    // does NOT appear on a failed download.
    it('surfaces the banner when the order-packet download fails (re-homed W5)', async () => {
      seedProject();
      await loadProjectToStep(4);

      // Panel-4 is the canvas-first OrderScreen with the "Download order packet" CTA.
      const cta = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent === 'Download Order Packet'
      ) as HTMLButtonElement;
      expect(cta).toBeTruthy();

      // Break the Blob download at URL.createObjectURL → the handler's catch fires.
      // jsdom does not implement createObjectURL, so assign a throwing impl directly
      // (nothing to vi.spyOn) and restore the original afterwards.
      const origCreate = (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => {
        throw new Error('boom');
      };
      try {
        cta.click();
        await new Promise(r => setTimeout(r, 10));
      } finally {
        (URL as unknown as { createObjectURL: unknown }).createObjectURL = origCreate;
      }

      expect(container.textContent).toMatch(/build the order packet/i);
      // Honest: the section-① "Downloaded ✓" terminal must NOT appear on a failed download.
      expect(container.querySelector('[data-testid="order-canvas-terminal"]')).toBeNull();
    });
  });
});

describe('WR-01 — Order state (finish · ship-to PII · canvasDownloaded · cartOpened) does not leak across load/reset', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  const projectId = 'wr01-project';

  const seedProject = () => {
    const nowStr = new Date().toISOString();
    const summary = { id: projectId, name: 'WR01 Project', thumbnail: '', dateModified: nowStr, dateCreated: nowStr };
    const data = {
      id: projectId,
      name: 'WR01 Project',
      dateCreated: nowStr,
      dateModified: nowStr,
      dimensions: { cols: 80, rows: 53 },
      drillStyle: 'square',
      selectedBaseKit: 'all',
      drillType: 'standard',
      pricesPerBagSize: { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 },
      gridData: [0, 1, 2], // restores a matchResult so Step 4 (Order) is reachable
    };
    localStorage.setItem('gempixel_workspace_registry', JSON.stringify([summary]));
    localStorage.setItem(`gempixel_project_${projectId}`, JSON.stringify(data));
  };

  // Load via the always-mounted UploadScreen recent-project chip (D-10) — the legacy
  // "My Images" left drawer is retired in Plan 08; the chip calls the same App
  // loadProject(id). The chip stays mounted regardless of step, so re-loading (to
  // prove Order state resets) just clicks it again.
  const loadRow = async () => {
    const loadChip = Array.from(
      container.querySelectorAll('[data-screen="upload"] button'),
    ).find(b => b.textContent?.includes('WR01 Project')) as HTMLButtonElement;
    expect(loadChip).toBeTruthy();
    loadChip.click();
    await new Promise(r => setTimeout(r, 10));
  };

  // Fill ship-to PII on Step 4 and download the packet so canvasDownloaded=true.
  const fillShipToAndDownload = async () => {
    for (let s = 1; s < 4; s++) {
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
      await new Promise(r => setTimeout(r, 10));
    }
    const nameInput = container.querySelector('[data-shipto="name"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    nameInput.value = 'Alice Private';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    expect((container.querySelector('[data-shipto="name"]') as HTMLInputElement).value).toBe('Alice Private');

    // jsdom lacks a real object-URL impl; stub it so the download SUCCEEDS and the
    // honest section-① terminal state (canvasDownloaded=true) is set.
    const origCreate = (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    const origRevoke = (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:wr01';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    try {
      (container.querySelector('[data-testid="order-download-cta"]') as HTMLButtonElement).click();
      // Wait past the handler's deferred revokeObjectURL(…, 100) so it fires against
      // the stub, not the restored (jsdom-absent) impl — otherwise it throws later.
      await new Promise(r => setTimeout(r, 130));
    } finally {
      (URL as unknown as { createObjectURL: unknown }).createObjectURL = origCreate;
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = origRevoke;
    }
    expect(container.querySelector('[data-testid="order-canvas-terminal"]')).toBeTruthy();
  };

  it('re-loading a project clears the previous ship-to PII and the downloaded terminal state', async () => {
    seedProject();
    render(<App />, container);
    await new Promise(r => setTimeout(r, 10));

    await loadRow();
    await fillShipToAndDownload();

    // Re-load the same project (chip stays mounted) — loadProject must reset Order state.
    await loadRow();

    // Panel-4 (OrderScreen) is always-mounted: its ship-to input is cleared and BOTH
    // per-task sub-terminals are gone (the download CTAs are always present).
    expect((container.querySelector('[data-shipto="name"]') as HTMLInputElement).value).toBe('');
    expect(container.querySelector('[data-testid="order-canvas-terminal"]')).toBeNull();
    expect(container.querySelector('[data-testid="order-cart-terminal"]')).toBeNull();
    expect(container.querySelector('[data-testid="order-download-cta"]')).toBeTruthy();
  });

  it('resetWorkspace (New) clears ship-to PII and the downloaded terminal state', async () => {
    seedProject();
    render(<App />, container);
    await new Promise(r => setTimeout(r, 10));

    await loadRow();
    await fillShipToAndDownload();

    // "New" triggers resetWorkspace, which must clear per-workspace Order state.
    (container.querySelector('#new-project-btn') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 10));

    // The always-mounted OrderScreen panel reflects the cleared state even though the
    // wizard is back on Step 1.
    expect((container.querySelector('[data-shipto="name"]') as HTMLInputElement).value).toBe('');
    expect(container.querySelector('[data-testid="order-canvas-terminal"]')).toBeNull();
    expect(container.querySelector('[data-testid="order-cart-terminal"]')).toBeNull();
  });

  // D-07 honest trigger + independence: the section-① done-state is set by ANY canvas
  // download (not packet-only), and the canvas vs. cart done-states are independent.
  // The file-level export mock makes triggerCanvasDownload THROW by default; override it
  // to RESOLVE once so the grid-PNG handler reaches its success set. jsdom has no real 2D
  // context, so stub getContext for drawCanvasOnly (it runs before triggerCanvasDownload).
  it('sets canvasDownloaded from a PNG download (not just the packet) — cart stays independent', async () => {
    seedProject();
    render(<App />, container);
    await new Promise(r => setTimeout(r, 10));

    await loadRow();
    for (let s = 1; s < 4; s++) {
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
      await new Promise(r => setTimeout(r, 10));
    }

    // Neither task is done yet.
    expect(container.querySelector('[data-testid="order-canvas-terminal"]')).toBeNull();
    expect(container.querySelector('[data-testid="order-cart-terminal"]')).toBeNull();

    const ctxStub = new Proxy(
      {},
      {
        get: (_t, prop) => (prop === 'measureText' ? () => ({ width: 0 }) : () => {}),
        set: () => true,
      },
    );
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
    const origGetContext = proto.getContext;
    proto.getContext = () => ctxStub;
    vi.mocked(triggerCanvasDownload).mockResolvedValueOnce(undefined);
    try {
      // Click the grid-PNG CTA (NOT the packet).
      (container.querySelector('[data-testid="order-download-canvas-cta"]') as HTMLButtonElement).click();
      // Flush the handler's await triggerCanvasDownload(...) → setCanvasDownloaded(true).
      await new Promise(r => setTimeout(r, 20));
    } finally {
      proto.getContext = origGetContext;
    }

    // A PNG download alone surfaces the canvas terminal — proving the trigger is ANY
    // section-① download, not packet-only — while the cart terminal stays absent.
    expect(container.querySelector('[data-testid="order-canvas-terminal"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="order-cart-terminal"]')).toBeNull();
  });

  it('opening the drill cart surfaces order-cart-terminal independently (canvas terminal absent)', async () => {
    seedProject();
    render(<App />, container);
    await new Promise(r => setTimeout(r, 10));

    await loadRow();
    for (let s = 1; s < 4; s++) {
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
      await new Promise(r => setTimeout(r, 10));
    }

    // The file-level checkout mock returns an UNMAPPED item by default (→ warning branch,
    // no open). Override it once to a clean, in-length cart link so handleShopifyCheckout
    // reaches window.open and flips cartOpened. Stub window.open (jsdom can't navigate).
    vi.mocked(compileShopifyCartLink).mockReturnValueOnce({
      url: 'https://diamonddrillsusa.com/cart/clean',
      isUrlTooLong: false,
      unmappedItems: [],
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      (container.querySelector('[data-testid="order-cart-cta"]') as HTMLButtonElement).click();
      await new Promise(r => setTimeout(r, 10));
      // Assert the reverse-tabnabbing-safe open BEFORE restoring the spy (T-26-04):
      // mockRestore() clears the recorded calls, so assert inside the guarded block.
      expect(openSpy).toHaveBeenCalledWith(expect.any(String), '_blank', 'noopener,noreferrer');
    } finally {
      openSpy.mockRestore();
    }

    // The cart opens (no unmapped/too-long warning) and cartOpened flips — independently
    // of the canvas terminal, which stays absent because no canvas file was downloaded.
    expect(container.querySelector('[data-testid="order-cart-terminal"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="order-canvas-terminal"]')).toBeNull();
  });
});

describe('BAG-02 / SC2 — the total bag count is user-visibly rendered from planOrderSupply.totalPackets', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  const projectId = 'test-project-bag02';
  // Two DMC codes with real square drill variants; gridData carries palette
  // indices, so on load App rebuilds counts = { '150': 250, '151': 250 }.
  const idx150 = DMC_PALETTE.findIndex(c => c.dmc === '150');
  const idx151 = DMC_PALETTE.findIndex(c => c.dmc === '151');
  const priceDb = { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 } as Record<200 | 500 | 1000 | 2000, number>;

  const seedProject = () => {
    const nowStr = new Date().toISOString();
    const summary = { id: projectId, name: 'BAG02 Project', thumbnail: '', dateModified: nowStr, dateCreated: nowStr };
    const gridData = [...Array(250).fill(idx150), ...Array(250).fill(idx151)];
    const data = {
      id: projectId,
      name: 'BAG02 Project',
      dateCreated: nowStr,
      dateModified: nowStr,
      dimensions: { cols: 25, rows: 20 },
      drillStyle: 'square',
      selectedBaseKit: 'all',
      drillType: 'standard',
      kitBaseCost: 15,
      drillPacketCost: 0.25,
      pricesPerBagSize: priceDb,
      gridData,
    };
    localStorage.setItem('gempixel_workspace_registry', JSON.stringify([summary]));
    localStorage.setItem(`gempixel_project_${projectId}`, JSON.stringify(data));
  };

  const loadProjectToStep = async (targetStep: number) => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 10));
    // Load via the always-mounted UploadScreen recent-project chip (D-10) — the
    // legacy "My Images" left drawer is retired in Plan 08; same App loadProject(id).
    const loadChip = Array.from(
      container.querySelectorAll('[data-screen="upload"] button'),
    ).find(b => b.textContent?.includes('BAG02 Project')) as HTMLButtonElement;
    expect(loadChip).toBeTruthy();
    loadChip.click();
    await new Promise(r => setTimeout(r, 10));
    for (let s = 1; s < targetStep; s++) {
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
      await new Promise(r => setTimeout(r, 10));
    }
  };

  it('renders "Drills ({n} bag(s))" where {n} equals planOrderSupply.totalPackets for a known fixture', async () => {
    expect(idx150).toBeGreaterThanOrEqual(0);
    expect(idx151).toBeGreaterThanOrEqual(0);

    // The single source of truth for the total bag count.
    const expected = planOrderSupply({ '150': 250, '151': 250 }, 'square', priceDb).totalPackets;
    expect(expected).toBeGreaterThan(0); // meaningful fixture, not a trivial 0

    seedProject();
    await loadProjectToStep(3);

    // SC2/BAG-02: the aggregator's totalPackets must be user-VISIBLE in the panel,
    // not merely derived — the "Drills ({n} bag(s))" line proves it.
    const re = new RegExp(`Drills \\(${expected} bag\\(s\\)\\)`);
    expect(container.textContent).toMatch(re);
  });
});

describe('SC4 / D-02 — auto-recompute (editing an upstream step after a match)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  const projectId = 'test-project-d13';

  // A project with gridData so App rebuilds a matchResult on load (no worker run,
  // MatcherClient.match is a no-op) — the "computed match" starting state for D-02.
  const seedProject = () => {
    const nowStr = new Date().toISOString();
    const summary = { id: projectId, name: 'D13 Project', thumbnail: '', dateModified: nowStr, dateCreated: nowStr };
    const data = {
      id: projectId,
      name: 'D13 Project',
      dateCreated: nowStr,
      dateModified: nowStr,
      dimensions: { cols: 80, rows: 53 },
      drillStyle: 'square',
      selectedBaseKit: 'all',
      drillType: 'standard',
      kitBaseCost: 15,
      drillPacketCost: 0.25,
      pricesPerBagSize: { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 },
      gridData: [0, 1, 2, 3],
    };
    localStorage.setItem('gempixel_workspace_registry', JSON.stringify([summary]));
    localStorage.setItem(`gempixel_project_${projectId}`, JSON.stringify(data));
  };

  const loadProject = async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 10));
    // Load via the always-mounted UploadScreen recent-project chip (D-10) — the
    // legacy "My Images" left drawer is retired in Plan 08; same App loadProject(id).
    const loadChip = Array.from(
      container.querySelectorAll('[data-screen="upload"] button'),
    ).find(b => b.textContent?.includes('D13 Project')) as HTMLButtonElement;
    expect(loadChip).toBeTruthy();
    loadChip.click();
    await new Promise(r => setTimeout(r, 10));
  };

  // Poll-for-value helper (deflake): re-check a predicate across short ticks rather
  // than assuming a fixed settle time for async re-render.
  const pollFor = async (predicate: () => boolean, tries = 50) => {
    for (let i = 0; i < tries && !predicate(); i++) {
      await new Promise(r => setTimeout(r, 10));
    }
  };

  const nextBtn = () => container.querySelector('#wizard-next-btn') as HTMLButtonElement;

  // Changes the canvas size via a RefineScreen SizeCard (the worker-tier control that
  // now owns size, D-02/D-10). Selecting a card sets live cols/rows in App AND auto-fires
  // the recompute. The seed is 80×53, so the "Large" (110×73) card is a genuine size change.
  const changeSize = async () => {
    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    const cards = Array.from(step2.querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];
    const large = cards.find(c => c.textContent?.includes('110×73 grid')) as HTMLButtonElement;
    expect(large).toBeTruthy();
    large.click();
    await new Promise(r => setTimeout(r, 10));
  };

  // Retargeted for D-02 (25-04): size selection on a RefineScreen SizeCard now AUTO-fires
  // the recompute — there is no manual "Recompute match" CTA, no page-level stale banner,
  // no StepBar amber marker, and no forward-nav block. This project loads WITHOUT its
  // source image (GemPixel never persists the upload), so the auto-recompute hits the
  // ME-01 imageless guard: it prompts a re-upload and retains the last-good grid rather
  // than stranding a size-mismatched one. The prompt appearing WITHOUT any button click is
  // the positive proof that the recompute auto-fired on the size change itself.
  it('auto-recomputes on a size change (no manual CTA); imageless auto-recompute prompts re-upload and keeps the last-good grid (ME-01)', async () => {
    seedProject();
    await loadProject();

    // Starting state: a match exists, no stale surfaces, forward navigation allowed.
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(container.textContent).not.toContain('This step is out of date');
    expect(nextBtn()).toBeTruthy();
    expect(nextBtn().disabled).toBe(false);

    // Change the canvas size via a Refine SizeCard — this AUTO-fires the recompute.
    await changeSize();

    // (1) The auto-recompute fired: with no source image it surfaces the ME-01 re-upload
    //     prompt. No button was clicked, so the prompt proves the recompute auto-fired.
    await pollFor(() => container.textContent!.includes('Re-upload the source image'));
    expect(container.textContent).toContain('Re-upload the source image to recompute the match.');

    // (2) No manual stale surfaces exist: no page-level banner and no Recompute CTA.
    expect(container.textContent).not.toContain('This step is out of date');
    expect(
      Array.from(container.querySelectorAll('button')).find(
        b => b.textContent?.trim() === 'Recompute match',
      ),
    ).toBeUndefined();

    // (3) The last-good match is retained on screen (no data loss): the canvas stays mounted.
    expect(container.querySelector('canvas')).toBeTruthy();

    // (4) Forward navigation is NEVER blocked by staleness (the block is retired).
    expect(nextBtn().disabled).toBe(false);
  });

  it('shows no stale surfaces on a fresh linear load, and linear forward nav works', async () => {
    seedProject();
    await loadProject();

    // A freshly loaded project is coherent: no stale banner, Next works.
    expect(container.textContent).not.toContain('This step is out of date');
    expect(nextBtn().disabled).toBe(false);

    // Linear forward navigation is unaffected.
    nextBtn().click();
    await new Promise(r => setTimeout(r, 10));
    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    expect(step2.className).toContain('contents');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap-closure missing-item #4 (UAT Test 26): an integrated full-App layout
// regression guard for "the four canvas-first screens host the centered viewport
// frame; the legacy dark 3-column shell + left 'My Images' menu + right
// 'Color Legend' aside are retired." Renders <App /> (not a per-component unit
// render) and asserts by CONTENT + data-* attributes, jsdom-safe (no geometry).
// ─────────────────────────────────────────────────────────────────────────────
describe('Layout regression — the four screens host the viewport; legacy shell retired (UAT Test 26)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  const projectId = 'test-project-layout26';
  const idx150 = DMC_PALETTE.findIndex(c => c.dmc === '150');
  const idx151 = DMC_PALETTE.findIndex(c => c.dmc === '151');

  // A project that restores a match on load (so the single-mount canvas mounts and
  // all four screens render real content), mirroring the BAG-02 fixture pattern.
  const seedProject = () => {
    const nowStr = new Date().toISOString();
    const summary = { id: projectId, name: 'Layout26 Project', thumbnail: '', dateModified: nowStr, dateCreated: nowStr };
    const gridData = [...Array(250).fill(idx150), ...Array(250).fill(idx151)];
    const data = {
      id: projectId,
      name: 'Layout26 Project',
      dateCreated: nowStr,
      dateModified: nowStr,
      dimensions: { cols: 25, rows: 20 },
      drillStyle: 'square',
      selectedBaseKit: 'all',
      drillType: 'standard',
      kitBaseCost: 15,
      drillPacketCost: 0.25,
      pricesPerBagSize: { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 },
      gridData,
    };
    localStorage.setItem('gempixel_workspace_registry', JSON.stringify([summary]));
    localStorage.setItem(`gempixel_project_${projectId}`, JSON.stringify(data));
  };

  const loadFromChip = async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 10));
    const chip = Array.from(
      container.querySelectorAll('[data-screen="upload"] button'),
    ).find(b => b.textContent?.includes('Layout26 Project')) as HTMLButtonElement;
    expect(chip).toBeTruthy();
    chip.click();
    await new Promise(r => setTimeout(r, 10));
  };

  const next = async () => {
    (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 10));
  };
  const back = async () => {
    (container.querySelector('#wizard-back-btn') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 10));
  };

  const panel = (n: number) => container.querySelector(`[data-step-panel="${n}"]`) as HTMLElement;
  const isVisible = (el: HTMLElement) => !el.classList.contains('hidden');

  it('hosts UploadScreen as the visible step-1 primary content', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 10));

    expect(panel(1).querySelector('[data-screen="upload"]')).toBeTruthy();
    expect(isVisible(panel(1))).toBe(true);
    // The other panels are display-toggled hidden at initial render.
    expect(isVisible(panel(2))).toBe(false);
    expect(isVisible(panel(3))).toBe(false);
    expect(isVisible(panel(4))).toBe(false);
  });

  it('hosts each screen as the visible panel across Upload → Refine → Supplies → Order, with the canvas as a Refine sibling', async () => {
    seedProject();
    await loadFromChip();

    // Step 2 — Refine hosts the rail AND the single-mount canvas preview sibling.
    await next();
    expect(isVisible(panel(2))).toBe(true);
    expect(panel(2).querySelector('[data-screen="refine"]')).toBeTruthy();
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(container.querySelectorAll('canvas').length).toBe(1);

    // Step 3 — Supplies.
    await next();
    expect(isVisible(panel(3))).toBe(true);
    expect(panel(3).querySelector('[data-screen="supplies"]')).toBeTruthy();

    // Step 4 — Order.
    await next();
    expect(isVisible(panel(4))).toBe(true);
    expect(panel(4).querySelector('[data-screen="order"]')).toBeTruthy();
  });

  it('retires the legacy left menu, right aside, and dark shell — asserted by content, not element type', async () => {
    seedProject();
    await loadFromChip();
    await next(); // to Refine (a step that used to show both legacy asides)

    // No legacy left "My Images" menu button anywhere.
    const myImagesBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('My Images'),
    );
    expect(myImagesBtn).toBeUndefined();

    // No legacy right-aside "Color Legend" heading (SuppliesScreen uses
    // "Order summary" / "Drill supply plan", never "Color Legend").
    const colorLegend = Array.from(container.querySelectorAll('*')).find(
      el => el.childElementCount === 0 && el.textContent?.trim() === 'Color Legend',
    );
    expect(colorLegend).toBeUndefined();

    // Post D-08 re-token: NO live rendered element may carry the dark-slate
    // 900/950 background family. The two coupled fulfillment modals are deleted
    // (26-03) and the Save Project Modal now renders Atelier-light (26-04), so
    // there are no "retained dark backdrops" left to exempt — this render-level
    // guard now complements the source-level hard grep-gate one-to-one.
    const darkSlateBg = Array.from(
      container.querySelectorAll('[class*="bg-slate-950"], [class*="bg-slate-900"]'),
    );
    expect(darkSlateBg.length).toBe(0);
  });

  it('keeps exactly one persistent canvas node across a step change (D-14 single mount)', async () => {
    seedProject();
    await loadFromChip();
    await next(); // Refine

    expect(container.querySelectorAll('canvas').length).toBe(1);
    const canvasBefore = container.querySelector('canvas');
    expect(canvasBefore).toBeTruthy();

    // Advance to Supplies and back to Refine — the canvas must be the SAME node,
    // never remounted (the CanvasWorkspace is an always-mounted frame sibling).
    await next(); // Supplies
    await back(); // Refine
    const canvasAfter = container.querySelector('canvas');
    expect(container.querySelectorAll('canvas').length).toBe(1);
    expect(canvasAfter).toBe(canvasBefore);
  });
});

// ── size-selection-crops-image (debug fix): AR-aware presets never crop ──────────
// The REFINE size presets used to force a fixed ~3:2 grid; selecting one center-cropped
// any non-3:2 photo (calculateCropBounds is a Cover/Crop to the grid AR). aspectAwareGrid
// now maps the preset's LONG-axis drill budget onto the image's OWN long axis and derives
// the short axis from the image AR — so the downscale crop becomes a no-op for ANY image
// aspect ratio, while a 3:2 image still lands on the preset's original dims byte-for-byte.
describe('aspectAwareGrid — AR-aware presets eliminate the size-selection crop', () => {
  // The four curated REFINE_SIZE_PRESETS long-axis budgets.
  const budgets = [
    { label: 'Small', cols: 60, rows: 40 },
    { label: 'Medium', cols: 80, rows: 53 },
    { label: 'Large', cols: 110, rows: 73 },
    { label: 'Extra large', cols: 140, rows: 93 },
  ];

  // A crop is "effectively none" when calculateCropBounds keeps (almost) the whole source:
  // integer grid quantization can shave a sub-pixel sliver (identical to the custom-size
  // path), so allow < 2% loss on either axis — versus the ~56% loss the bug caused.
  const assertNoMeaningfulCrop = (
    dims: { cols: number; rows: number },
    srcW: number,
    srcH: number,
  ) => {
    const b = calculateCropBounds(srcW, srcH, dims.cols, dims.rows);
    expect(b.cropWidth / srcW).toBeGreaterThan(0.98);
    expect(b.cropHeight / srcH).toBeGreaterThan(0.98);
  };

  it('reproduces the preset dims byte-for-byte for an exact 3:2 landscape image (no regression)', () => {
    // ar = 1.5 → cols carries the long-axis budget, rows = round(budget / 1.5).
    for (const p of budgets) {
      expect(aspectAwareGrid(p.cols, p.rows, 3000, 2000)).toEqual({ cols: p.cols, rows: p.rows });
    }
  });

  it('maps the long-axis budget onto a PORTRAIT image and yields a tall, uncropped canvas', () => {
    // 2:3 portrait (1000×1500, ar ≈ 0.667): Medium's budget (80) lands on the HEIGHT.
    const dims = aspectAwareGrid(80, 53, 1000, 1500);
    expect(dims.rows).toBe(80); // long-axis budget on the image's long (vertical) axis
    expect(dims.cols).toBe(Math.round(80 * (1000 / 1500))); // 53 — short axis from image AR
    expect(dims.rows).toBeGreaterThan(dims.cols); // genuinely a TALL canvas
    // The grid AR now tracks the image AR, so the Cover/Crop is a no-op (whole image kept).
    assertNoMeaningfulCrop(dims, 1000, 1500);
  });

  it('BUG REPRODUCTION: the raw fixed preset would have cropped >50% of the same portrait', () => {
    // Proves the defect the fix removes: forcing 80×53 onto a 2:3 portrait discards most of it.
    const cropped = calculateCropBounds(1000, 1500, 80, 53);
    expect(cropped.cropHeight / 1500).toBeLessThan(0.5); // majority of the image lost
  });

  it('keeps the whole image for assorted non-3:2 ratios across every preset budget', () => {
    const images = [
      { w: 1080, h: 1080 }, // 1:1 square
      { w: 1600, h: 900 }, // 16:9 wide
      { w: 1200, h: 1600 }, // 3:4 portrait
      { w: 900, h: 1600 }, // 9:16 tall portrait
    ];
    for (const p of budgets) {
      for (const img of images) {
        const dims = aspectAwareGrid(p.cols, p.rows, img.w, img.h);
        // The long-axis budget is always preserved on the image's long axis.
        expect(Math.max(dims.cols, dims.rows)).toBe(Math.max(p.cols, p.rows));
        assertNoMeaningfulCrop(dims, img.w, img.h);
      }
    }
  });

  it('falls back to the raw preset for a degenerate/zero-height image (defensive)', () => {
    expect(aspectAwareGrid(80, 53, 100, 0)).toEqual({ cols: 80, rows: 53 });
    expect(aspectAwareGrid(80, 53, 0, 0)).toEqual({ cols: 80, rows: 53 });
  });
});
