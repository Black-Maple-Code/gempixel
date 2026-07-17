// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { CanvasControlBar, type CanvasControlBarProps } from '../CanvasControlBar';

/**
 * CanvasControlBar render contract (25-07, GAP-1 / SC8, D-05/D-07). Props-driven
 * jsdom render proving the relocated Refine chrome: the view-mode switcher + zoom
 * controls now live in a NORMAL-FLOW strip (AtelierShell Zone 3), never absolutely
 * positioned over the canvas raster. Locks the labels, aria-pressed active segment,
 * the three zoom callbacks, reference-mode zoom suppression, the low-zoom threshold,
 * and the not-absolute structural guarantee.
 */
describe('CanvasControlBar — relocated switcher + zoom, normal-flow chrome', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  // A minimal HTMLImageElement stand-in — the component only checks truthiness.
  const fakeImage = () => document.createElement('img') as HTMLImageElement;

  const makeProps = (overrides: Partial<CanvasControlBarProps> = {}): CanvasControlBarProps => ({
    image: fakeImage(),
    viewportMode: 'grid',
    setViewportMode: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFit: vi.fn(),
    zoomScale: 1.0,
    ...overrides,
  });

  const setup = (overrides: Partial<CanvasControlBarProps> = {}) => {
    const props = makeProps(overrides);
    render(<CanvasControlBar {...props} />, container);
    return props;
  };

  const buttons = () => Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
  const byText = (text: string) => buttons().find(b => b.textContent?.includes(text));
  const byAria = (label: string) => buttons().find(b => b.getAttribute('aria-label') === label);

  it('renders nothing when there is no image', () => {
    setup({ image: null });
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('renders exactly three view-mode segments with the contract labels + aria-pressed on the active mode', () => {
    setup({ viewportMode: 'symbols' });

    const grid = byText('Grid Colors')!;
    const symbols = byText('Grid + Symbols')!;
    const original = byText('Original Photo')!;
    expect(grid).toBeTruthy();
    expect(symbols).toBeTruthy();
    expect(original).toBeTruthy();

    // Only the active mode ('symbols') reports aria-pressed=true.
    expect(grid.getAttribute('aria-pressed')).toBe('false');
    expect(symbols.getAttribute('aria-pressed')).toBe('true');
    expect(original.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls setViewportMode with the matching mode when a segment is clicked', () => {
    const props = setup();
    byText('Original Photo')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(props.setViewportMode).toHaveBeenCalledWith('reference');

    byText('Grid + Symbols')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(props.setViewportMode).toHaveBeenCalledWith('symbols');

    byText('Grid Colors')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(props.setViewportMode).toHaveBeenCalledWith('grid');
  });

  it('renders the three zoom buttons in grid/symbols mode and fires the matching callbacks', () => {
    const props = setup({ viewportMode: 'grid' });

    const zoomIn = byAria('Zoom in')!;
    const zoomOut = byAria('Zoom out')!;
    const fit = byAria('Fit to screen')!;
    expect(zoomIn).toBeTruthy();
    expect(zoomOut).toBeTruthy();
    expect(fit).toBeTruthy();

    // All three keep the 44px touch targets.
    for (const b of [zoomIn, zoomOut, fit]) {
      expect(b.className).toContain('min-h-[44px]');
      expect(b.className).toContain('min-w-[44px]');
    }

    zoomIn.dispatchEvent(new Event('click', { bubbles: true }));
    zoomOut.dispatchEvent(new Event('click', { bubbles: true }));
    fit.dispatchEvent(new Event('click', { bubbles: true }));
    expect(props.onZoomIn).toHaveBeenCalledTimes(1);
    expect(props.onZoomOut).toHaveBeenCalledTimes(1);
    expect(props.onFit).toHaveBeenCalledTimes(1);
  });

  it('does NOT render the zoom buttons in reference mode, but keeps the switcher', () => {
    setup({ viewportMode: 'reference' });
    expect(byAria('Zoom in')).toBeUndefined();
    expect(byAria('Zoom out')).toBeUndefined();
    expect(byAria('Fit to screen')).toBeUndefined();
    // The switcher stays so the user can leave reference mode.
    expect(byText('Grid Colors')).toBeTruthy();
    expect(byText('Original Photo')).toBeTruthy();
  });

  it('shows the low-zoom warning only in symbols mode below the ~10px cell threshold', () => {
    // symbols + below threshold (0.5 * 16 = 8 < 10) → shown
    setup({ viewportMode: 'symbols', zoomScale: 0.5 });
    expect(container.textContent).toContain('⚠️ Low Zoom');

    // symbols + above threshold (1.0 * 16 = 16 >= 10) → hidden
    render(null, container);
    setup({ viewportMode: 'symbols', zoomScale: 1.0 });
    expect(container.textContent).not.toContain('⚠️ Low Zoom');

    // grid + below threshold → hidden (warning is symbols-only)
    render(null, container);
    setup({ viewportMode: 'grid', zoomScale: 0.5 });
    expect(container.textContent).not.toContain('⚠️ Low Zoom');
  });

  it('roots the strip in normal flow — no absolute/fixed positioning token', () => {
    setup();
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.className).not.toMatch(/\babsolute\b/);
    expect(root.className).not.toMatch(/\bfixed\b/);
    expect(root.className).not.toMatch(/\bbottom-\d/);
  });
});
