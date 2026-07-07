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

    // Verify input fields for sizing exist
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(2);

    // Verify file input exists
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
  });

  it('allows changing width and height input values in grid mode', async () => {
    render(<App />, container);
    await new Promise(r => setTimeout(r, 0));

    const inputs = container.querySelectorAll('input[type="number"]');
    const widthInput = inputs[0] as HTMLInputElement;
    const heightInput = inputs[1] as HTMLInputElement;

    expect(widthInput.value).toBe('40');
    expect(heightInput.value).toBe('30');

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

    // Click 'cm' mode button
    const buttons = container.querySelectorAll('button');
    const cmButton = Array.from(buttons).find(b => b.textContent?.toLowerCase() === 'cm');
    expect(cmButton).toBeTruthy();

    cmButton?.click();
    await new Promise(r => setTimeout(r, 10));

    const inputs = container.querySelectorAll('input[type="number"]');
    const widthInput = inputs[0] as HTMLInputElement;
    const heightInput = inputs[1] as HTMLInputElement;

    // Default 40x30 in cm should be 40/4 = 10cm and 30/4 = 7.5cm
    expect(widthInput.value).toBe('10');
    expect(heightInput.value).toBe('7.5');
  });
});
