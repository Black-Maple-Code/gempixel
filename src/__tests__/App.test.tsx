// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { App } from '../App';

// Mock worker client and canvas viewer
vi.mock('../engine/worker-client', () => {
  return {
    MatcherClient: class MockMatcherClient {
      match = vi.fn();
      terminate = vi.fn();
    }
  };
});

vi.mock('../engine/viewer', () => {
  return {
    CanvasViewer: class MockCanvasViewer {
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
  });

  it('renders dashboard shell elements', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Verify application header exists
    const heading = container.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('GemPixel');

    // Verify input fields for sizing exist in Step 1
    const numberInputs = container.querySelectorAll('input[type="number"]');
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

    // Click 'Cost & Order' tab
    const buttons = container.querySelectorAll('button');
    const quoteTab = Array.from(buttons).find(b => b.title === 'Cost & Order' || b.textContent?.toLowerCase() === 'cost & order');
    expect(quoteTab).toBeTruthy();
    quoteTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // Uncheck optimize bags checkbox to use standard simple packet costing in test
    const optimizeBagsCheckbox = container.querySelector('#optimize-bags-checkbox') as HTMLInputElement;
    if (optimizeBagsCheckbox && optimizeBagsCheckbox.checked) {
      optimizeBagsCheckbox.click();
      await new Promise(r => setTimeout(r, 10));
    }

    // Verify calculator input fields exist
    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(3); // Canvas base price, Est. Shipping, Bag Price
    const canvasCostInput = inputs[0] as HTMLInputElement;
    const shippingEstimateInput = inputs[1] as HTMLInputElement;
    const packetCostInput = inputs[2] as HTMLInputElement;

    expect(canvasCostInput.value).toBe('15');
    expect(shippingEstimateInput.value).toBe('8');
    expect(packetCostInput.value).toBe('0.25');

    // Canvas base cost: $15, shipping: $8, drills cost: $0 (no matchResult) -> Total Cost: $23.00
    const quoteSections = container.querySelectorAll('span');
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

  it('updates default drill packet cost when drill type changes', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Navigate to Palette & Optimize (Step 2) to find the drill type select dropdown.
    const buttons = container.querySelectorAll('button');
    const paletteTab = Array.from(buttons).find(b => b.title === 'Palette & Optimize' || b.textContent?.toLowerCase() === 'palette & optimize');
    expect(paletteTab).toBeTruthy();
    paletteTab?.click();
    await new Promise(r => setTimeout(r, 10));

    const selects = container.querySelectorAll('select');
    const drillTypeSelect = selects[1] as HTMLSelectElement;
    expect(drillTypeSelect).toBeTruthy();

    // Select 'ab' drill type
    drillTypeSelect.value = 'ab';
    drillTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));

    // Now switch to 'Cost & Order' tab (Step 3) to check packet price
    const quoteTab = Array.from(buttons).find(b => b.title === 'Cost & Order' || b.textContent?.toLowerCase() === 'cost & order');
    quoteTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // Uncheck optimize bags checkbox to use standard simple packet costing in test
    const optimizeBagsCheckbox = container.querySelector('#optimize-bags-checkbox') as HTMLInputElement;
    if (optimizeBagsCheckbox && optimizeBagsCheckbox.checked) {
      optimizeBagsCheckbox.click();
      await new Promise(r => setTimeout(r, 10));
    }

    const inputs = container.querySelectorAll('input[type="number"]');
    const packetCostInput = inputs[2] as HTMLInputElement;
    expect(packetCostInput.value).toBe('0.35'); // AB price is 0.35
  });

  it('renders all 4 bulk bag inputs when optimize bags checkbox is checked (default)', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Click 'Cost & Order' tab
    const buttons = container.querySelectorAll('button');
    const quoteTab = Array.from(buttons).find(b => b.title === 'Cost & Order' || b.textContent?.toLowerCase() === 'cost & order');
    expect(quoteTab).toBeTruthy();
    quoteTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // By default, optimizeBagsCost is true, so we should see 6 number inputs:
    // Canvas price, Est. Shipping, 200 qty, 500 qty, 1000 qty, and 2000 qty
    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(6);
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

      // Verify display isolation: Step 1 options are shown, but Step 2 (Palette & kit) is not
      const selectElementsInitial = Array.from(container.querySelectorAll('select'));
      const initialPresetSelect = selectElementsInitial.find(s => s.value === 'custom');
      expect(initialPresetSelect).toBeTruthy(); // Sizing preset is in Step 1 now
      expect(container.querySelector('input[id="file-upload"]')).toBeTruthy(); // Step 1 element
      const initialKitSelect = selectElementsInitial.find(s => s.value === '200');
      expect(initialKitSelect).toBeUndefined(); // Step 2 kit select not rendered yet

      // Progress to Step 2
      nextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 2 (Palette & Optimize)
      // Verify display isolation: Step 2 options should be rendered, but Step 1 (upload/sizing) is not
      expect(container.querySelector('input[id="file-upload"]')).toBeNull(); // isolated
      expect(container.querySelector('input[data-field="width"]')).toBeNull(); // isolated
      const selectElementsStep2 = Array.from(container.querySelectorAll('select'));
      const step2KitSelect = selectElementsStep2.find(s => s.value === '200'); // Loaded project selectedBaseKit is '200'
      expect(step2KitSelect).toBeTruthy();

      // Back button should be visible on step 2
      const backBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '< Back') as HTMLButtonElement;
      expect(backBtn).toBeTruthy();

      // Progress to Step 3
      const nextBtnStep2 = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      nextBtnStep2.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 3 (Cost & Order)
      // Verify display isolation: Step 3 options rendered, Step 2 (DMC kit select) hidden
      expect(Array.from(container.querySelectorAll('select')).find(s => s.value === '200')).toBeUndefined(); // isolated
      expect(container.querySelector('#optimize-bags-checkbox')).toBeTruthy(); // Step 3 checkbox

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
      expect(Array.from(container.querySelectorAll('select')).find(s => s.value === '200')).toBeTruthy();
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
        optimizeBagsCost: true,
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
        optimizeBagsCost: true,
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

      // Open the Settings expander
      const summaryEl = container.querySelector('summary') as HTMLElement;
      expect(summaryEl.textContent).toContain('Affiliate & Partner Settings');

      // Assert logged colors are visible
      expect(container.textContent).toContain('939');
      expect(container.textContent).toContain('3843');

      // Click Clear Log
      const clearBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Clear Log') as HTMLButtonElement;
      expect(clearBtn).toBeTruthy();
      clearBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Logged colors list should be cleared
      expect(container.textContent).toContain('No unmapped colors logged.');
      expect(localStorage.getItem('gempixel_unmapped_colors_log')).toBeNull();
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
        optimizeBagsCost: true,
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
        optimizeBagsCost: true,
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
});
