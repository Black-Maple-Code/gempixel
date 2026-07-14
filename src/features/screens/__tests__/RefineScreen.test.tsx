// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { RefineScreen, type RefineScreenProps } from '../RefineScreen';
import type { DmcColor } from '../../../engine/types';

/**
 * RefineScreen render contract (23-03). Props-driven jsdom render asserting the LOCKED
 * two-tier reactivity seam (D-03/D-04): a size-card click is the worker tier (calls
 * onSelectSize, never onRecompute/worker); edge-cleanup + the color slider are the
 * post-process tier (their own setters, no staleness). Also locks the stable slider max
 * (= detectedColorCount, Pitfall 3) and the Advanced defaults (closed; kit=all, shape=square).
 */
describe('RefineScreen — two-tier seam + slider max + Advanced defaults', () => {
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

  const candidate = (dmc: string, name: string, hex: string): DmcColor => ({
    dmc,
    name,
    hex,
    r: 0,
    g: 0,
    b: 0,
    lab: { l: 0, a: 0, b: 0 },
    kits: ['100'],
  });

  const makeProps = (overrides: Partial<RefineScreenProps> = {}): RefineScreenProps => ({
    sizePresets: [
      { label: 'Small', cols: 60, rows: 40, inches: '6 × 4 in', drillCount: 2400 },
      { label: 'Medium', cols: 80, rows: 53, inches: '8 × 5.3 in', drillCount: 4240, tag: 'BEST' },
      { label: 'Large', cols: 110, rows: 73, inches: '11 × 7.3 in', drillCount: 8030 },
    ],
    cols: 80,
    rows: 53,
    onSelectSize: vi.fn(),
    widthInput: '80',
    heightInput: '53',
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    edgeCleanup: 1,
    onEdgeCleanupChange: vi.fn(),
    colorTarget: 26,
    detectedColorCount: 26,
    currentColorCount: 24,
    onColorTargetChange: vi.fn(),
    selectedBaseKit: 'all',
    onKitChange: vi.fn(),
    drillStyle: 'square',
    onShapeChange: vi.fn(),
    excludedColors: new Set<string>(),
    onToggleExclude: vi.fn(),
    baseCandidates: [candidate('310', 'Black', '#000000'), candidate('321', 'Red', '#c00000')],
    stale: false,
    onRecompute: vi.fn(),
    ...overrides,
  });

  const setup = (overrides: Partial<RefineScreenProps> = {}) => {
    const props = makeProps(overrides);
    render(<RefineScreen {...props} />, container);
    return props;
  };

  const sizeCards = () =>
    Array.from(container.querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];

  it('renders one SizeCard per preset with its inch string + drill count', () => {
    setup();
    const cards = sizeCards();
    expect(cards.length).toBe(3);
    const medium = cards.find(c => c.textContent?.includes('80×53 grid'))!;
    expect(medium.textContent).toContain('8 × 5.3 in');
    expect(medium.textContent).toContain('4240');
  });

  it('marks the currently-selected preset with aria-pressed="true" and no others', () => {
    setup(); // cols/rows = 80/53 → Medium selected
    const cards = sizeCards();
    const medium = cards.find(c => c.textContent?.includes('80×53 grid'))!;
    const small = cards.find(c => c.textContent?.includes('60×40 grid'))!;
    expect(medium.getAttribute('aria-pressed')).toBe('true');
    expect(small.getAttribute('aria-pressed')).toBe('false');
  });

  it('size-card click calls onSelectSize(cols, rows) and NEVER onRecompute (worker tier is App-owned)', () => {
    const props = setup();
    const large = sizeCards().find(c => c.textContent?.includes('110×73 grid'))!;
    large.click();
    expect(props.onSelectSize).toHaveBeenCalledWith(110, 73);
    expect(props.onRecompute).not.toHaveBeenCalled();
  });

  it('renders the color Slider with max === detectedColorCount and reports numeric input', () => {
    const props = setup({ detectedColorCount: 26 });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.getAttribute('max')).toBe('26');
    expect(slider.getAttribute('min')).toBe('8');

    slider.value = '18';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(props.onColorTargetChange).toHaveBeenCalledWith(18);
    expect(typeof (props.onColorTargetChange as any).mock.calls[0][0]).toBe('number');
  });

  it('hides the degenerate slider when detectedColorCount <= 8 (WR-02: never max < min)', () => {
    // Fewer than 9 detected colors → nothing to reduce; the slider (min=8) would be
    // degenerate, so it is replaced by an inert note.
    setup({ detectedColorCount: 2, currentColorCount: 2, colorTarget: 2 });
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(container.textContent).toContain('nothing to reduce');
  });

  it('renders a valid slider (min <= max) exactly at the 8-color boundary threshold (WR-02)', () => {
    // At detectedColorCount === 8 there is still nothing to reduce (floor is 8) → no slider.
    setup({ detectedColorCount: 8, currentColorCount: 8, colorTarget: 8 });
    expect(container.querySelector('input[type="range"]')).toBeNull();

    // At 9 the slider returns and its max (9) is strictly above the min (8).
    render(null, container);
    setup({ detectedColorCount: 9, currentColorCount: 9, colorTarget: 9 });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(Number(slider.getAttribute('max'))).toBeGreaterThanOrEqual(Number(slider.getAttribute('min')));
    expect(slider.getAttribute('max')).toBe('9');
    expect(slider.getAttribute('min')).toBe('8');
  });

  it('edge cleanup is a role="radiogroup" of four options; selecting one calls onEdgeCleanupChange', () => {
    const props = setup();
    const group = container.querySelector('[role="radiogroup"][aria-label="Edge cleanup"]') as HTMLElement;
    expect(group).toBeTruthy();
    const radios = Array.from(group.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
    expect(radios.length).toBe(4);
    // Select "Strong" (value 3).
    radios[3].click();
    expect(props.onEdgeCleanupChange).toHaveBeenCalledWith(3);
  });

  it('Advanced is a <details> closed by default with kit=all and shape=square selected', () => {
    setup();
    const details = container.querySelector('details') as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
    expect(details.hasAttribute('open')).toBe(false);

    // Kit select (always mounted inside details) defaults to "all".
    const kit = container.querySelector('select') as HTMLSelectElement;
    expect(kit.value).toBe('all');

    // Drill-shape radiogroup defaults to "square".
    const shapeGroup = container.querySelector('[role="radiogroup"][aria-label="Drill shape"]') as HTMLElement;
    const squareRadio = Array.from(shapeGroup.querySelectorAll('[role="radio"]')).find(
      r => r.textContent?.trim() === 'Square',
    ) as HTMLButtonElement;
    expect(squareRadio.getAttribute('aria-checked')).toBe('true');
  });

  it('renders the Recompute affordance only when stale, and clicking it calls onRecompute', () => {
    // Not stale → no affordance.
    const notStale = setup({ stale: false });
    let recompute = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Recompute match',
    );
    expect(recompute).toBeUndefined();
    expect(notStale.onRecompute).not.toHaveBeenCalled();

    // Stale → affordance renders and fires onRecompute.
    const props = setup({ stale: true });
    recompute = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Recompute match',
    );
    expect(recompute).toBeTruthy();
    (recompute as HTMLButtonElement).click();
    expect(props.onRecompute).toHaveBeenCalledTimes(1);
  });
});
