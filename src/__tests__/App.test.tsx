// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { App } from '../App';
import { projectStore } from '../engine/projectStore';
import { planOrderSupply } from '../engine/bagPlanner';
import { DMC_PALETTE } from '../engine/palette';

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

  // TODO(25): the editable pricing config grid (canvas cost, est. shipping, per-bag
  // 200/500/1k/2k prices) lived in the legacy Step3Canvas body. Flipping
  // USE_NEW_SUPPLIES (23-04) swaps in the canvas-first SuppliesScreen, which is a
  // read-only supply table + single-source order summary (D-07) — price EDITING has
  // no canvas-first home yet (an Order/vendor concern). The underlying priceDb still
  // feeds planOrderSupply/buildOrderQuote; only its input UI left panel-3. Un-skip
  // when a price-config surface is re-homed, or retire in the Phase 25 cleanup.
  it.skip('calculates supply costing commission quotes correctly in quote tab', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // D-14: the Supplies (step 3) panel is always mounted (CSS-toggled sibling),
    // so its cost controls can be asserted directly by scoping to its panel —
    // no navigation required (and the strict StepBar/Next stay locked with no image).
    const step3 = container.querySelector('[data-step-panel="3"]') as HTMLElement;
    expect(step3).toBeTruthy();

    // Single-plan UI (D-11): the per-bag-size price grid always renders, so there are
    // 6 number inputs — Canvas price, Est. Shipping, then the 200/500/1k/2k prices.
    const inputs = step3.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(6);
    const canvasCostInput = inputs[0] as HTMLInputElement;
    const shippingEstimateInput = inputs[1] as HTMLInputElement;
    const price200Input = inputs[2] as HTMLInputElement;

    expect(canvasCostInput.value).toBe('15');
    expect(shippingEstimateInput.value).toBe('8');
    expect(price200Input.value).toBe('0.6'); // 200-qty default standard price

    // Canvas base cost: $15, shipping: $8, drills cost: $0 (no matchResult) -> Total Cost: $23.00
    const quoteSections = step3.querySelectorAll('span');
    const exactQuoteSpan = Array.from(quoteSections).find(s => s.textContent?.includes('$23.00'));
    expect(exactQuoteSpan).toBeTruthy();
  });

  it('supports bottom bar navigation for responsive mobile drawer toggles', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Initially both sidebars are visible / active (not collapsed)
    const asides = container.querySelectorAll('aside');
    expect(asides[0].className).not.toContain('w-0');
    expect(asides[1].className).not.toContain('w-0');

    // Click 'Canvas' bottom tab to collapse all panels on mobile
    const buttons = container.querySelectorAll('button');
    const canvasTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'canvas');
    expect(canvasTab).toBeTruthy();

    canvasTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // Both sidebars should now be collapsed (w-0 / display hidden class)
    expect(asides[0].className).toContain('w-0');
    expect(asides[1].className).toContain('w-0');

    // Click 'Setup' bottom tab to expand left controls panel
    const controlsTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'setup');
    expect(controlsTab).toBeTruthy();
    controlsTab?.click();
    await new Promise(r => setTimeout(r, 10));

    expect(asides[0].className).not.toContain('w-0');
    expect(asides[1].className).toContain('w-0');
  });

  // TODO(25): the legacy drill-TYPE select (standard/ab/glow/crystal) lived in
  // Step2Palette; flipping USE_NEW_REFINE (23-03) swaps in RefineScreen, whose Advanced
  // disclosure holds kit / color-exclude / drill-SHAPE (REFINE-05) — not drill type.
  // drill type has no canvas-first home yet (a Supplies/Order pricing concern deferred to
  // the Phase 25 strangler cleanup). The underlying priceDb-preset effect still runs; only
  // its UI driver moved out of panel-2. Un-skip when drill type gets a new home / is retired.
  it.skip('updates the per-bag-size price presets when drill type changes', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // D-14: both the Refine (step 2) and Supplies (step 3) panels are always
    // mounted, so the drill-type select and the price grid are asserted directly
    // by scoping to their panels — no navigation required.
    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    expect(step2).toBeTruthy();
    const drillTypeSelect = step2.querySelectorAll('select')[1] as HTMLSelectElement; // [0]=DMC kit, [1]=drill type
    expect(drillTypeSelect).toBeTruthy();

    // Select 'ab' drill type
    drillTypeSelect.value = 'ab';
    drillTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // Single-plan UI (D-11): the per-bag-size price grid is the sole cost control.
    // Switching to 'ab' loads the AB preset via the drillType effect (App.tsx ~L618),
    // which is a two-phase async update: setDrillType -> re-render -> effect ->
    // setPriceDb -> re-render. Poll for the 200-qty input to reflect the AB preset
    // rather than assuming a fixed settle time — a fixed 10ms wait was intermittently
    // too short under load and read the pre-effect standard default ('0.6').
    const step3 = container.querySelector('[data-step-panel="3"]') as HTMLElement;
    let price200Input = step3.querySelectorAll('input[type="number"]')[2] as HTMLInputElement;
    for (let i = 0; i < 50 && price200Input?.value !== '0.7'; i++) {
      await new Promise(r => setTimeout(r, 10));
      price200Input = step3.querySelectorAll('input[type="number"]')[2] as HTMLInputElement;
    }

    const inputs = step3.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(6);
    expect(price200Input.value).toBe('0.7'); // AB 200-qty preset
  });

  // TODO(25): as above — the per-bag-size price grid was the legacy Step3Canvas
  // price-config UI, which has no canvas-first home after the USE_NEW_SUPPLIES flip
  // (SuppliesScreen is a read-only supply table + order summary). Un-skip on re-home
  // or retire in the Phase 25 strangler cleanup.
  it.skip('renders the 4 per-bag-size price inputs unconditionally (single-plan UI, D-11)', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // D-14: query the always-mounted Supplies (step 3) panel directly.
    const step3 = container.querySelector('[data-step-panel="3"]') as HTMLElement;
    expect(step3).toBeTruthy();

    // The optimized plan is the SOLE plan now (no toggle to flip): the per-bag-size
    // price grid always renders, so there are 6 number inputs unconditionally —
    // Canvas price, Est. Shipping, 200 qty, 500 qty, 1000 qty, and 2000 qty.
    const inputs = step3.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(6);
    // D-11: the "Optimize bag sizes" toggle no longer exists.
    expect(container.querySelector('#optimize-bags-checkbox')).toBeNull();
    expect(container.textContent).not.toMatch(/optimize bag sizes/i);
    expect((inputs[2] as HTMLInputElement).value).toBe('0.6'); // 200 qty default standard price
    expect((inputs[3] as HTMLInputElement).value).toBe('1.1'); // 500 qty default standard price
    expect((inputs[4] as HTMLInputElement).value).toBe('1.8'); // 1000 qty default standard price
    expect((inputs[5] as HTMLInputElement).value).toBe('3.2'); // 2000 qty default standard price
  });

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

      // Toggle Commissions drawer open
      const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
      toggleBtn?.click();
      await new Promise(r => setTimeout(r, 10));

      // Verify project row exists in Left Sidebar switcher
      const projectRow = container.querySelector('.group.relative') as HTMLDivElement;
      expect(projectRow).toBeTruthy();
      expect(projectRow.textContent).toContain('Client A Commission');

      // Verify canvas is NOT rendered initially (since matchResult and image are null on fresh mount before load)
      const initialCanvas = container.querySelector('canvas');
      expect(initialCanvas).toBeNull();

      // Click project row to load configuration
      projectRow.click();
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

      // Verify removal of registry and project details on deletion
      // Re-render to see the project switcher row again
      render(null, container);
      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Toggle Commissions drawer open again
      (Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images')) as HTMLButtonElement).click();
      await new Promise(r => setTimeout(r, 10));

      // Click delete button ('×') inside project row
      // Mock window.confirm to return true
      const originalConfirm = window.confirm;
      window.confirm = () => true;

      const deleteBtn = container.querySelector('button[title="Delete Image"]') as HTMLButtonElement;
      expect(deleteBtn).toBeTruthy();
      deleteBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Restore confirm
      window.confirm = originalConfirm;

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
      const backButtons = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === '< Back');
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

      // Toggle Commissions drawer open
      const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
      toggleBtn?.click();
      await new Promise(r => setTimeout(r, 10));

      // Click project row to load configuration
      const projectRow = container.querySelector('.group.relative') as HTMLDivElement;
      expect(projectRow).toBeTruthy();
      projectRow.click();
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
      const backBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '< Back') as HTMLButtonElement;
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

      // Now on Step 4 (Save)
      // Verify next button is null (final step)
      const nextBtnStep4 = container.querySelector('#wizard-next-btn');
      expect(nextBtnStep4).toBeNull();
      expect(container.querySelector('#step4-save-name-input')).toBeTruthy(); // save form

      // Go back to Step 3
      const backBtnStep4 = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '< Back') as HTMLButtonElement;
      backBtnStep4.click();
      await new Promise(r => setTimeout(r, 10));

      // Now back on Step 3. Go back to Step 2
      const backBtnStep3 = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '< Back') as HTMLButtonElement;
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

      // Load the project so a match restores and the canvas host mounts.
      const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
      toggleBtn?.click();
      await new Promise(r => setTimeout(r, 10));
      (container.querySelector('.group.relative') as HTMLDivElement).click();
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

    // TODO(25): the auto-substitution checkbox + threshold slider lived in Step2Palette;
    // flipping USE_NEW_REFINE (23-03) swaps in RefineScreen, whose color-count slider
    // (REFINE-04) is the canvas-first color-merge control. The legacy substitution UI has
    // no panel-2 home (its enableSubstitution/substitutionThreshold state still defaults ON
    // and runs in the pipeline). Un-skip when/if a substitution control is re-homed, or
    // retire with the legacy Step bodies in the Phase 25 strangler cleanup.
    it.skip('supports auto-substitution UI toggles and threshold settings in Step 4', async () => {
      const mockProjectSummary = {
        id: 'test-project-sub',
        name: 'Substitution Project',
        thumbnail: '',
        dateModified: new Date().toISOString(),
        dateCreated: new Date().toISOString()
      };
      const mockProjectData = {
        id: 'test-project-sub',
        name: 'Substitution Project',
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
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
        gridData: [0, 1]
      };

      localStorage.setItem('gempixel_workspace_registry', JSON.stringify([mockProjectSummary]));
      localStorage.setItem('gempixel_project_test-project-sub', JSON.stringify(mockProjectData));

      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Toggle Commissions drawer open
      const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
      toggleBtn?.click();
      await new Promise(r => setTimeout(r, 10));

      // Click to load project
      const rowBtn = container.querySelector('.group.relative') as HTMLDivElement;
      expect(rowBtn).toBeTruthy();
      rowBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Progress to Step 4
      const nextBtn = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      expect(nextBtn).toBeTruthy();
      expect(nextBtn.disabled).toBe(false);

      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 2
      await new Promise(r => setTimeout(r, 10));

      // Auto-substitute is ON by default; its threshold controls render immediately.
      const subCheckbox = container.querySelector('#substitute-colors-checkbox') as HTMLInputElement;
      expect(subCheckbox).toBeTruthy();
      expect(subCheckbox.checked).toBe(true); // Default ON (count of 15 and below)

      // Threshold input should render with the default of 15
      const thresholdInput = Array.from(container.querySelectorAll('input[type="range"]')).find(i => (i as HTMLInputElement).value === '15') as HTMLInputElement;
      expect(thresholdInput).toBeTruthy();

      // Change threshold
      thresholdInput.value = '50';
      thresholdInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 10));

      expect(thresholdInput.value).toBe('50');

      // Toggling the checkbox off hides the threshold controls. Scope to the
      // substitution slider (max=500); the smoothing slider (max=3) is separate.
      subCheckbox.click();
      await new Promise(r => setTimeout(r, 10));
      expect(subCheckbox.checked).toBe(false);
      expect(container.querySelector('input[type="range"][max="500"]')).toBeNull();
    });

    // TODO(25): the "Affiliate & Partner Settings" expander + unmapped-colors log +
    // "Clear Log" control lived in the legacy Step3Canvas body. Flipping
    // USE_NEW_SUPPLIES (23-04) swaps in the canvas-first SuppliesScreen, which has no
    // affiliate/unmapped-log surface (an Order/vendor + diagnostics concern). The
    // underlying unmappedLog state + persistence still run; only their panel-3 UI
    // driver left. Un-skip on re-home, or retire in the Phase 25 strangler cleanup.
    it.skip('renders logged unmapped colors lists and handles clear action in settings', async () => {
      // Pre-seed local storage log & project
      localStorage.setItem('gempixel_unmapped_colors_log', JSON.stringify(['939', '3843']));
      const mockProjectSummary = {
        id: 'test-project-unmapped',
        name: 'Unmapped Project',
        thumbnail: '',
        dateModified: new Date().toISOString(),
        dateCreated: new Date().toISOString()
      };
      const mockProjectData = {
        id: 'test-project-unmapped',
        name: 'Unmapped Project',
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
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
        gridData: [0, 1]
      };

      localStorage.setItem('gempixel_workspace_registry', JSON.stringify([mockProjectSummary]));
      localStorage.setItem('gempixel_project_test-project-unmapped', JSON.stringify(mockProjectData));

      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Toggle Commissions drawer open
      const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
      toggleBtn?.click();
      await new Promise(r => setTimeout(r, 10));

      // Click to load project
      const rowBtn = container.querySelector('.group.relative') as HTMLDivElement;
      expect(rowBtn).toBeTruthy();
      rowBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Go to Step 3
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 2
      await new Promise(r => setTimeout(r, 10));
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 3
      await new Promise(r => setTimeout(r, 10));

      // Open the Settings expander. D-14: all panels are always mounted, so scope
      // to the Supplies (step 3) panel — the first <summary> in the whole container
      // is now Step 1's "Ingestion Settings".
      const step3 = container.querySelector('[data-step-panel="3"]') as HTMLElement;
      const summaryEl = step3.querySelector('summary') as HTMLElement;
      expect(summaryEl.textContent).toContain('Affiliate & Partner Settings');

      // Assert logged colors are visible
      expect(step3.textContent).toContain('939');
      expect(step3.textContent).toContain('3843');

      // Click Clear Log
      const clearBtn = Array.from(step3.querySelectorAll('button')).find(b => b.textContent === 'Clear Log') as HTMLButtonElement;
      expect(clearBtn).toBeTruthy();
      clearBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Logged colors list should be cleared. unmappedLog now persists through
      // usePersistentState, so clearing to [] re-serializes as '[]' rather than
      // removing the key; both null and '[]' parse to an empty array (format-safe).
      expect(container.textContent).toContain('No unmapped colors logged.');
      expect(JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') ?? '[]')).toEqual([]);
    });

    it('supports inline project save, update, and copy actions on Step 5', async () => {
      const mockProjectSummary = {
        id: 'test-project-save',
        name: 'Initial Project Name',
        thumbnail: '',
        dateModified: new Date().toISOString(),
        dateCreated: new Date().toISOString()
      };
      const mockProjectData = {
        id: 'test-project-save',
        name: 'Initial Project Name',
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
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
        gridData: [0, 1]
      };

      localStorage.setItem('gempixel_workspace_registry', JSON.stringify([mockProjectSummary]));
      localStorage.setItem('gempixel_project_test-project-save', JSON.stringify(mockProjectData));

      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Toggle Commissions drawer open
      const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
      toggleBtn?.click();
      await new Promise(r => setTimeout(r, 10));

      // Click to load project
      const rowBtn = container.querySelector('.group.relative') as HTMLDivElement;
      expect(rowBtn).toBeTruthy();
      rowBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Advance to Step 4
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 2
      await new Promise(r => setTimeout(r, 10));
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 3
      await new Promise(r => setTimeout(r, 10));
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 4
      await new Promise(r => setTimeout(r, 10));

      // Locate inline name input in Step 4
      const nameInput = container.querySelector('#step4-save-name-input') as HTMLInputElement;
      expect(nameInput).toBeTruthy();
      expect(nameInput.value).toBe('Initial Project Name');

      // Edit name
      nameInput.value = 'Updated Project Name';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 10));

      // Click Update button
      const updateBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Update') as HTMLButtonElement;
      expect(updateBtn).toBeTruthy();
      updateBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Check updated name in local storage
      const registry = JSON.parse(localStorage.getItem('gempixel_workspace_registry') || '[]');
      expect(registry[0].name).toBe('Updated Project Name');

      // Click Save as Copy button
      const copyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Save as Copy') as HTMLButtonElement;
      expect(copyBtn).toBeTruthy();
      copyBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Check registry now has 2 projects
      const registryAfterCopy = JSON.parse(localStorage.getItem('gempixel_workspace_registry') || '[]');
      expect(registryAfterCopy.length).toBe(2);
    });

    it('returns to Step 1 and resets workspace configuration when Start New Commission button is clicked on Step 5', async () => {
      const mockProjectSummary = {
        id: 'test-project-reset',
        name: 'Reset Test Project',
        thumbnail: '',
        dateModified: new Date().toISOString(),
        dateCreated: new Date().toISOString()
      };
      const mockProjectData = {
        id: 'test-project-reset',
        name: 'Reset Test Project',
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        dimensions: { cols: 40, rows: 30 },
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
        gridData: [0, 1]
      };

      localStorage.setItem('gempixel_workspace_registry', JSON.stringify([mockProjectSummary]));
      localStorage.setItem('gempixel_project_test-project-reset', JSON.stringify(mockProjectData));

      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Toggle Commissions drawer open
      const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
      toggleBtn?.click();
      await new Promise(r => setTimeout(r, 10));

      // Click to load project
      const rowBtn = container.querySelector('.group.relative') as HTMLDivElement;
      expect(rowBtn).toBeTruthy();
      rowBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Advance to Step 4
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 2
      await new Promise(r => setTimeout(r, 10));
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 3
      await new Promise(r => setTimeout(r, 10));
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click(); // to Step 4
      await new Promise(r => setTimeout(r, 10));

      // Click Start New Commission / Reset button
      const resetBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Start New Image / Reset') as HTMLButtonElement;
      expect(resetBtn).toBeTruthy();
      resetBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Verify we are back on Step 1 (Upload element exists)
      expect(container.querySelector('#upload-file-input')).toBeTruthy();

      // Next button should be disabled because image and project ID are reset
      const nextBtnAfterReset = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      expect(nextBtnAfterReset).toBeTruthy();
      expect(nextBtnAfterReset.disabled).toBe(true);
    });

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
      const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
      toggleBtn?.click();
      await new Promise(r => setTimeout(r, 10));
      const rowBtn = container.querySelector('.group.relative') as HTMLDivElement;
      expect(rowBtn).toBeTruthy();
      rowBtn.click();
      await new Promise(r => setTimeout(r, 10));
      for (let s = 1; s < targetStep; s++) {
        (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
        await new Promise(r => setTimeout(r, 10));
      }
    };

    beforeEach(() => {
      localStorage.clear();
    });

    // TODO(23-05/25): the "Download Canvas Grid (PNG)" trigger lived in the legacy
    // Step3Canvas body. Flipping USE_NEW_SUPPLIES (23-04) swaps in the read-only
    // SuppliesScreen; the canvas/packet download affordances belong to the Order
    // screen (wave 5, A4) and land there. The handler + its actionError catch are
    // unchanged — only the panel-3 button moved. Un-skip when the Order-screen
    // download lands, or retire the legacy trigger in the Phase 25 cleanup.
    it.skip('shows the actionError banner when a canvas download fails (W5)', async () => {
      seedProject();
      await loadProjectToStep(3);

      // triggerCanvasDownload is mocked to throw → the handler's catch must surface
      // the unified banner instead of a silent console.error-only no-op.
      const downloadBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent?.includes('Download Canvas Grid (PNG)')
      ) as HTMLButtonElement;
      expect(downloadBtn).toBeTruthy();
      expect(downloadBtn.disabled).toBe(false);
      downloadBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(container.textContent).toMatch(/could not generate the download/i);
    });

    // TODO(23-05/25): the "Order Drills" Shopify-checkout trigger lived in the legacy
    // Step3Canvas body. Flipping USE_NEW_SUPPLIES (23-04) swaps in the read-only
    // SuppliesScreen; checkout/order-packet flows belong to the Order screen (wave 5,
    // A4). handleShopifyCheckout + its corrupt-log guard are unchanged — only the
    // panel-3 button moved. Un-skip when the Order-screen checkout lands, or retire
    // the legacy trigger in the Phase 25 cleanup.
    it.skip('guards a corrupt unmapped-colors log during checkout and still proceeds (W4)', async () => {
      seedProject();
      await loadProjectToStep(3);

      // Seed the corrupt value AFTER mount: usePersistentState's write-effect rewrites
      // this key to '[]' on mount, so it must be corrupted just before checkout reads it.
      localStorage.setItem('gempixel_unmapped_colors_log', '{not json');

      const checkoutBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent?.includes('Order Drills')
      ) as HTMLButtonElement;
      expect(checkoutBtn).toBeTruthy();

      // The unguarded JSON.parse would have thrown here (W4) — must not now.
      expect(() => checkoutBtn.click()).not.toThrow();
      await new Promise(r => setTimeout(r, 10));

      // Banner surfaced …
      expect(container.textContent).toMatch(/could not read the saved unmapped-colors log/i);
      // … and checkout proceeded: the corrupt value was replaced with a valid log
      // built from the [] fallback + the new unmapped code (no silent abort).
      expect(JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') ?? '[]')).toEqual(['939']);
    });

    // TODO(23-05/25): same as the W4 case above — the "Order Drills" checkout trigger
    // moved out of panel-3 with the USE_NEW_SUPPLIES flip; the wrong-type-log guard in
    // handleShopifyCheckout is unchanged. Un-skip when the Order-screen checkout lands.
    it.skip('guards a valid-JSON-but-wrong-type unmapped-colors log during checkout (WR-02)', async () => {
      seedProject();
      await loadProjectToStep(3);

      // A value that is valid JSON but the wrong shape ('5' -> number 5): the old
      // guard only caught parse THROWS, so [...5] on the next line threw a TypeError
      // outside the try, killing checkout. The shape check must now fall back to [].
      localStorage.setItem('gempixel_unmapped_colors_log', '5');

      const checkoutBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent?.includes('Order Drills')
      ) as HTMLButtonElement;
      expect(checkoutBtn).toBeTruthy();

      // Must not throw (the non-iterable spread would have) …
      expect(() => checkoutBtn.click()).not.toThrow();
      await new Promise(r => setTimeout(r, 10));

      // … banner surfaced and checkout proceeded with the [] fallback + new code.
      expect(container.textContent).toMatch(/could not read the saved unmapped-colors log/i);
      expect(JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') ?? '[]')).toEqual(['939']);
    });

    it('surfaces the banner when a save hits the storage quota (B3 regression, folded into actionError)', async () => {
      seedProject();
      await loadProjectToStep(4);

      // Force a quota failure through the unified banner (formerly saveErrorMsg).
      vi.spyOn(projectStore, 'save').mockReturnValue({ ok: false, reason: 'quota' } as ReturnType<typeof projectStore.save>);

      const updateBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent === 'Update'
      ) as HTMLButtonElement;
      expect(updateBtn).toBeTruthy();
      updateBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(container.textContent).toMatch(/storage is full/i);
    });
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
    const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
    toggleBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    const rowBtn = container.querySelector('.group.relative') as HTMLDivElement;
    expect(rowBtn).toBeTruthy();
    rowBtn.click();
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

describe('SC4 / D-13 — soft-invalidate + recompute (editing an upstream step after a match)', () => {
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
  // MatcherClient.match is a no-op) — the "computed match" starting state for D-13.
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
    const toggleBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('My Images'));
    toggleBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    const rowBtn = container.querySelector('.group.relative') as HTMLDivElement;
    expect(rowBtn).toBeTruthy();
    rowBtn.click();
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
  // now owns size, D-03/D-10). Selecting a card sets live cols/rows in App; divergence
  // from the committed matchInputs drives the soft-invalidate. The seed is 80×53, so the
  // "Large" (110×73) card is a genuine size change.
  const changeSize = async () => {
    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    const cards = Array.from(step2.querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];
    const large = cards.find(c => c.textContent?.includes('110×73 grid')) as HTMLButtonElement;
    expect(large).toBeTruthy();
    large.click();
    await new Promise(r => setTimeout(r, 10));
  };

  // Re-homed from the legacy Upload width edit (23-03): size selection now lives on the
  // RefineScreen SizeCards (D-10/SC1). The soft-invalidate/Recompute machinery (Phase 20
  // D-13) is unchanged — a size change diverges live cols/rows from the committed
  // matchInputs → stale banner + Recompute CTA, no per-click worker re-fire (D-04).
  it('marks downstream stale, keeps last-good match, blocks advancing; imageless Recompute prompts re-upload (ME-01)', async () => {
    seedProject();
    await loadProject();

    // Starting state: a match exists, nothing is stale — the banner is absent and
    // forward navigation is allowed.
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(container.textContent).not.toContain('This step is out of date');
    expect(container.querySelector('nav[aria-label="Progress"] [data-stale="true"]')).toBeNull();
    expect(nextBtn()).toBeTruthy();
    expect(nextBtn().disabled).toBe(false);

    // Edit a completed upstream step (change the canvas size via a Refine SizeCard).
    await changeSize();

    // (1) The soft-invalidate banner + CTA appear.
    await pollFor(() => container.textContent!.includes('This step is out of date'));
    expect(container.textContent).toContain('This step is out of date');
    const recomputeBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Recompute match'
    ) as HTMLButtonElement;
    expect(recomputeBtn).toBeTruthy();

    // (1b) The StepBar shows the out-of-date marker on downstream steps.
    expect(container.querySelector('nav[aria-label="Progress"] [data-stale="true"]')).toBeTruthy();

    // (2) The last-good match is retained on screen (no data loss / no silent
    //     worker re-fire): the canvas is still mounted.
    expect(container.querySelector('canvas')).toBeTruthy();

    // (3) Advancing past the stale step is blocked.
    expect(nextBtn().disabled).toBe(true);

    // (4) This project was loaded from storage WITHOUT its source image (GemPixel never
    //     persists the uploaded image), so the match cannot actually be recomputed.
    //     Recompute must NOT silently clear the stale state — doing so would strand a
    //     grid whose size no longer matches its data (ME-01). It keeps the banner,
    //     prompts a re-upload, and leaves the last-good match on screen.
    recomputeBtn.click();
    await pollFor(() => container.textContent!.includes('Re-upload the source image'));
    expect(container.textContent).toContain('Re-upload the source image to recompute the match.');
    expect(container.textContent).toContain('This step is out of date');
    expect(container.querySelector('nav[aria-label="Progress"] [data-stale="true"]')).toBeTruthy();
    expect(nextBtn().disabled).toBe(true);
    // The last-good match is retained (no data loss).
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('does not enter the stale state on a fresh linear load (no false positives)', async () => {
    seedProject();
    await loadProject();

    // A freshly loaded project is coherent: no stale banner, no marker, Next works.
    expect(container.textContent).not.toContain('This step is out of date');
    expect(container.querySelector('nav[aria-label="Progress"] [data-stale="true"]')).toBeNull();
    expect(nextBtn().disabled).toBe(false);

    // Linear forward navigation is unaffected by the D-13 gating.
    nextBtn().click();
    await new Promise(r => setTimeout(r, 10));
    const step2 = container.querySelector('[data-step-panel="2"]') as HTMLElement;
    expect(step2.className).toContain('contents');
  });
});
