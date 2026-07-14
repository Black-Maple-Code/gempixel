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

    const heading = container.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('GemPixel');
  });

  it('renders dashboard shell elements', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Verify application header exists
    const heading = container.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('GemPixel');

    // Verify input fields for sizing exist in Step 1.
    // D-14: the four step panels are now always-mounted CSS-toggled siblings, so
    // scope the count to the VISIBLE panel (the one not display:none-d) — the
    // hidden panels' inputs are still in the DOM.
    const numberInputs = container.querySelectorAll('[data-step-panel]:not(.hidden) input[type="number"]');
    expect(numberInputs.length).toBe(2);

    // Verify file input exists in Step 1
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
  });

  it('allows changing width and height input values in grid mode', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Switch to Size tab first
    const buttons = container.querySelectorAll('button');
    const sizeTab = Array.from(buttons).find(b => b.title === 'Size' || b.textContent?.toLowerCase() === 'size');
    sizeTab?.click();
    await new Promise(r => setTimeout(r, 10));

    const inputs = container.querySelectorAll('input[type="number"]');
    const widthInput = inputs[0] as HTMLInputElement;
    const heightInput = inputs[1] as HTMLInputElement;

    expect(widthInput.value).toBe('80');
    expect(heightInput.value).toBe('53');

    // Change width using prototype setter
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    valueSetter?.call(widthInput, '60');
    widthInput.dispatchEvent(new Event('input', { bubbles: true }));
    widthInput.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10)); // wait a bit for render and effect
    expect(widthInput.value).toBe('60');

    // Change height
    valueSetter?.call(heightInput, '45');
    heightInput.dispatchEvent(new Event('input', { bubbles: true }));
    heightInput.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10)); // wait a bit for render and effect
    expect(heightInput.value).toBe('45');
  });

  it('allows changing physical sizing units', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Switch to Size tab first
    const buttons = container.querySelectorAll('button');
    const sizeTab = Array.from(buttons).find(b => b.title === 'Size' || b.textContent?.toLowerCase() === 'size');
    sizeTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // Click 'cm' mode button
    const sizingButtons = container.querySelectorAll('button');
    const cmButton = Array.from(sizingButtons).find(b => b.textContent?.toLowerCase() === 'cm');
    expect(cmButton).toBeTruthy();

    cmButton?.click();
    await new Promise(r => setTimeout(r, 10));

    const inputs = container.querySelectorAll('input[type="number"]');
    const widthInput = inputs[0] as HTMLInputElement;
    const heightInput = inputs[1] as HTMLInputElement;

    // Default 80x53 in cm should be 80/4 = 20cm and 53/4 = 13.25cm
    expect(widthInput.value).toBe('20');
    expect(heightInput.value).toBe('13.25');
  });

  it('calculates supply costing commission quotes correctly in quote tab', async () => {
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

  it('updates the per-bag-size price presets when drill type changes', async () => {
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
    await new Promise(r => setTimeout(r, 10));

    // Single-plan UI (D-11): the per-bag-size price grid is the sole cost control.
    // Switching to 'ab' loads the AB preset, so the 200-qty price input becomes 0.70.
    const step3 = container.querySelector('[data-step-panel="3"]') as HTMLElement;
    const inputs = step3.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(6);
    const price200Input = inputs[2] as HTMLInputElement;
    expect(price200Input.value).toBe('0.7'); // AB 200-qty preset
  });

  it('renders the 4 per-bag-size price inputs unconditionally (single-plan UI, D-11)', async () => {
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

      // Verify sizing inputs are restored
      const sizeTab = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Size' || b.textContent?.toLowerCase() === 'size');
      sizeTab?.click();
      await new Promise(r => setTimeout(r, 10));

      const inputs = container.querySelectorAll('input[type="number"]');
      const widthInput = inputs[0] as HTMLInputElement;
      const heightInput = inputs[1] as HTMLInputElement;
      expect(widthInput.value).toBe('40'); // cols
      expect(heightInput.value).toBe('30'); // rows

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
      const initialPresetSelect = selectElementsInitial.find(s => s.value === 'custom');
      expect(initialPresetSelect).toBeTruthy(); // Sizing preset is in Step 1 now
      expect(visiblePanel().querySelector('input[id="file-upload"]')).toBeTruthy(); // Step 1 element
      const initialKitSelect = selectElementsInitial.find(s => s.value === '200');
      expect(initialKitSelect).toBeUndefined(); // Step 2 kit select not in the visible panel

      // Progress to Step 2
      nextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 2 (Refine)
      // Verify display isolation: the visible panel shows Step 2 options, not Step 1 (upload/sizing)
      expect(visiblePanel().querySelector('input[id="file-upload"]')).toBeNull(); // isolated
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
      expect(visiblePanel().querySelector('#canvas-print-partner')).toBeTruthy(); // Step 3 marker (canvas vendor select)

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

    it('supports auto-substitution UI toggles and threshold settings in Step 4', async () => {
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

    it('renders logged unmapped colors lists and handles clear action in settings', async () => {
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
      expect(container.querySelector('input[id="file-upload"]')).toBeTruthy();

      // Next button should be disabled because image and project ID are reset
      const nextBtnAfterReset = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      expect(nextBtnAfterReset).toBeTruthy();
      expect(nextBtnAfterReset.disabled).toBe(true);
    });

    it('displays Recommended PrintKK Sizes in Step 2 and allows selecting them', async () => {
      // Stub FileReader and Image
      const mockReader = {
        readAsDataURL: vi.fn().mockImplementation(function(this: any) {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/png;base64,mock' } });
          }
        }),
      };
      vi.stubGlobal('FileReader', vi.fn().mockImplementation(() => mockReader));

      const mockImageInstance = {
        naturalWidth: 300,
        naturalHeight: 400,
        width: 300,
        height: 400,
        set src(_val: string) {
          if (this.onload) {
            setTimeout(() => this.onload(), 0);
          }
        },
        onload: null as any,
      };
      vi.stubGlobal('Image', vi.fn().mockImplementation(() => mockImageInstance));

      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Upload mock image to unlock wizard progression
      const file = new File([''], 'scenery.jpg', { type: 'image/jpeg' });
      const uploadInput = container.querySelector('#file-upload') as HTMLInputElement;
      Object.defineProperty(uploadInput, 'files', { value: [file] });
      uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 15));

      // Check that Recommended Canvas Sizes heading exists
      expect(container.textContent).toContain('Recommended Canvas Sizes');

      // Top recommendation should be "30 x 40 cm" with "100% Match"
      expect(container.textContent).toContain('30 x 40 cm');
      expect(container.textContent).toContain('100% Match');

      // Click the "30 x 40 cm" recommendation button
      const recBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('30 x 40 cm')) as HTMLButtonElement;
      expect(recBtn).toBeTruthy();
      recBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Verify dimensions are applied
      const numberInputs = container.querySelectorAll('input[type="number"]');
      const widthInput = numberInputs[0] as HTMLInputElement;
      const heightInput = numberInputs[1] as HTMLInputElement;
      expect(widthInput.value).toBe('30');
      expect(heightInput.value).toBe('40');

      // Cleanup globals
      vi.unstubAllGlobals();
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

    it('shows the actionError banner when a canvas download fails (W5)', async () => {
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

    it('guards a corrupt unmapped-colors log during checkout and still proceeds (W4)', async () => {
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

    it('guards a valid-JSON-but-wrong-type unmapped-colors log during checkout (WR-02)', async () => {
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
