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

    // Click 'Size' tab to render sizing inputs
    const buttons = container.querySelectorAll('button');
    const sizeTab = Array.from(buttons).find(b => b.title === 'Size' || b.textContent?.toLowerCase() === 'size');
    expect(sizeTab).toBeTruthy();
    sizeTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // Verify input fields for sizing exist
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(2);

    // Verify file input exists (it's in the 'files' tab, let's switch back)
    const filesTab = Array.from(buttons).find(b => b.title === 'Upload' || b.textContent?.toLowerCase() === 'files');
    filesTab?.click();
    await new Promise(r => setTimeout(r, 10));

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

    // Click 'Quote' tab
    const buttons = container.querySelectorAll('button');
    const quoteTab = Array.from(buttons).find(b => b.title === 'Quote' || b.textContent?.toLowerCase() === 'quote');
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
    expect(inputs.length).toBe(3); // Canvas base price, DMC packet cost, Labor fee
    const canvasCostInput = inputs[0] as HTMLInputElement;
    const packetCostInput = inputs[1] as HTMLInputElement;
    const laborFeeInput = inputs[2] as HTMLInputElement;

    expect(canvasCostInput.value).toBe('15');
    expect(packetCostInput.value).toBe('0.25');
    expect(laborFeeInput.value).toBe('25');

    // Canvas base cost: $15, drills cost: $0 (no matchResult), labor fee: $25 (fixed) -> Quote: $40
    const quoteSections = container.querySelectorAll('span');
    const exactQuoteSpan = Array.from(quoteSections).find(s => s.textContent?.includes('$40.00'));
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

    // Click 'Controls' bottom tab to expand left controls panel
    const controlsTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'controls');
    expect(controlsTab).toBeTruthy();
    controlsTab?.click();
    await new Promise(r => setTimeout(r, 10));

    expect(asides[0].className).not.toContain('w-0');
    expect(asides[1].className).toContain('w-0');
  });

  it('updates default drill packet cost when drill type changes', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Navigate to Palette (Step 3) to find the drill type select dropdown.
    const buttons = container.querySelectorAll('button');
    const paletteTab = Array.from(buttons).find(b => b.title === 'Palette');
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

    // Now switch to 'Quote' tab (Step 4) to check packet price
    const quoteTab = Array.from(buttons).find(b => b.title === 'Quote' || b.textContent?.toLowerCase() === 'quote');
    quoteTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // Uncheck optimize bags checkbox to use standard simple packet costing in test
    const optimizeBagsCheckbox = container.querySelector('#optimize-bags-checkbox') as HTMLInputElement;
    if (optimizeBagsCheckbox && optimizeBagsCheckbox.checked) {
      optimizeBagsCheckbox.click();
      await new Promise(r => setTimeout(r, 10));
    }

    const inputs = container.querySelectorAll('input[type="number"]');
    const packetCostInput = inputs[1] as HTMLInputElement;
    expect(packetCostInput.value).toBe('0.35'); // AB price is 0.35
  });

  it('renders all 4 bulk bag inputs when optimize bags checkbox is checked (default)', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    // Click 'Quote' tab
    const buttons = container.querySelectorAll('button');
    const quoteTab = Array.from(buttons).find(b => b.title === 'Quote' || b.textContent?.toLowerCase() === 'quote');
    quoteTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // By default, optimizeBagsCost is true, so we should see 6 number inputs:
    // Canvas price, 200 qty, 500 qty, 1000 qty, 2000 qty, and Labor fee
    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(6);
    expect((inputs[1] as HTMLInputElement).value).toBe('0.6'); // 200 qty default standard price
    expect((inputs[2] as HTMLInputElement).value).toBe('1.1'); // 500 qty default standard price
    expect((inputs[3] as HTMLInputElement).value).toBe('1.8'); // 1000 qty default standard price
    expect((inputs[4] as HTMLInputElement).value).toBe('3.2'); // 2000 qty default standard price
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

      // After newBtn click, grid dimensions should be reset to default 80x53
      expect(widthInput.value).toBe('80');
      expect(heightInput.value).toBe('53');
      // And canvas should unmount because matchResult is reset to null
      expect(container.querySelector('canvas')).toBeNull();

      // Verify removal of registry and project details on deletion
      // Re-render to see the project switcher row again
      render(null, container);
      render(<App />, container);
      await new Promise(r => setTimeout(r, 10));

      // Click delete button ('×') inside project row
      // Mock window.confirm to return true
      const originalConfirm = window.confirm;
      window.confirm = () => true;

      const deleteBtn = container.querySelector('button[title="Delete Commission"]') as HTMLButtonElement;
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

      // Click project row to load configuration
      const projectRow = container.querySelector('.group.relative') as HTMLDivElement;
      expect(projectRow).toBeTruthy();
      projectRow.click();
      await new Promise(r => setTimeout(r, 10));

      // Next button should now be enabled because project ID is loaded, even though image is null
      const nextBtn = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      expect(nextBtn).toBeTruthy();
      expect(nextBtn.disabled).toBe(false);

      // Verify display isolation: Step 1 options are shown, but Step 2 (sizing) is not
      const selectElementsInitial = Array.from(container.querySelectorAll('select'));
      const initialPresetSelect = selectElementsInitial.find(s => s.value === 'custom');
      expect(initialPresetSelect).toBeUndefined(); // Sizing preset in step 2 should not be rendered yet
      expect(container.querySelector('input[id="file-upload"]')).toBeTruthy(); // Step 1 element

      // Progress to Step 2
      nextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 2
      // Verify display isolation: Step 2 options should be rendered, but Step 1 and Step 3 are not
      expect(container.querySelector('input[id="file-upload"]')).toBeNull(); // Step 1 element should be isolated/hidden
      expect(container.querySelector('input[data-field="width"]')).toBeTruthy(); // Step 2 width input
      const selectElementsStep2 = Array.from(container.querySelectorAll('select'));
      const step3KitSelect = selectElementsStep2.find(s => s.value === '200');
      expect(step3KitSelect).toBeUndefined(); // Step 3 base kit selector not rendered yet

      // Back button should be visible on step 2
      const backBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Back') as HTMLButtonElement;
      expect(backBtn).toBeTruthy();

      // Progress to Step 3
      const nextBtnStep2 = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      nextBtnStep2.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 3
      // Verify display isolation: Step 3 options (base kit selector) rendered, Step 2 width input hidden
      expect(container.querySelector('input[data-field="width"]')).toBeNull(); // Step 2 width input isolated
      const kitSelect = Array.from(container.querySelectorAll('select')).find(s => s.value === '200');
      expect(kitSelect).toBeTruthy(); // Step 3 selector

      // Progress to Step 4
      const nextBtnStep3 = container.querySelector('#wizard-next-btn') as HTMLButtonElement;
      nextBtnStep3.click();
      await new Promise(r => setTimeout(r, 10));

      // Now on Step 4
      const selectElements = Array.from(container.querySelectorAll('select'));
      const activeKitSelect = selectElements.find(s => s.value === '200');
      expect(activeKitSelect).toBeUndefined(); // Step 3 selector isolated

      const numberInputs = Array.from(container.querySelectorAll('input[type="number"]'));
      const canvasCostInput = numberInputs.find(i => (i as HTMLInputElement).value === '15');
      expect(canvasCostInput).toBeTruthy(); // Step 4 Canvas cost input

      // Next button should be hidden on Step 4
      const nextBtnStep4 = container.querySelector('#wizard-next-btn');
      expect(nextBtnStep4).toBeNull();

      // Go back to Step 3
      const backBtnStep4 = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Back') as HTMLButtonElement;
      backBtnStep4.click();
      await new Promise(r => setTimeout(r, 10));

      // Should be back on Step 3
      expect(Array.from(container.querySelectorAll('select')).find(s => s.value === '200')).toBeTruthy();
    });
  });
});
