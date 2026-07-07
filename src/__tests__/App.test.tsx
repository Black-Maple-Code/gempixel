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
    const sizeTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'size');
    expect(sizeTab).toBeTruthy();
    sizeTab?.click();
    await new Promise(r => setTimeout(r, 10));

    // Verify input fields for sizing exist
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(2);

    // Verify file input exists (it's in the 'files' tab, let's switch back)
    const filesTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'files');
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
    const sizeTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'size');
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
    const sizeTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'size');
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
    const quoteTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'quote');
    expect(quoteTab).toBeTruthy();
    quoteTab?.click();
    await new Promise(r => setTimeout(r, 10));

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

    // Files tab is active by default. Let's find the drill type select dropdown.
    const selects = container.querySelectorAll('select');
    const drillTypeSelect = selects[1] as HTMLSelectElement;
    expect(drillTypeSelect).toBeTruthy();

    // Select 'ab' drill type
    drillTypeSelect.value = 'ab';
    drillTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));

    // Now switch to 'Quote' tab to check packet price
    const buttons = container.querySelectorAll('button');
    const quoteTab = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'quote');
    quoteTab?.click();
    await new Promise(r => setTimeout(r, 10));

    const inputs = container.querySelectorAll('input[type="number"]');
    const packetCostInput = inputs[1] as HTMLInputElement;
    expect(packetCostInput.value).toBe('0.35'); // AB price is 0.35
  });
});
