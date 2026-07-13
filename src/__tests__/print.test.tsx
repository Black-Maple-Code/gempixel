// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { calculateSafetyPurchase, calculateFixedBagCost, App, DYE_LOT_WHY_SENTENCE } from '../App';
import { packColor, priceColorPack } from '../engine/bagPlanner';

// Render the App only needs the heavy side-effect modules stubbed out (the same
// worker/viewer stubs App.test.tsx uses); the print-only report block is always
// in the DOM (jsdom applies no CSS, so `hidden print:block` is still queryable).
vi.mock('../engine/worker-client', () => ({
  MatcherClient: class MockMatcherClient {
    match = vi.fn();
    terminate = vi.fn();
  },
}));

vi.mock('../engine/viewer', () => ({
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
  },
}));

// Standard price table (bag size -> unit price) shared by the fixed-bag cases.
const priceDb = { 200: 0.25, 500: 0.55, 1000: 0.8, 2000: 1.4 };

describe('Safety margin calculations', () => {
  it('correctly rounds up counts to recommended standard 200 bags', () => {
    const result = calculateSafetyPurchase(350);
    expect(result.safety).toBe(385);
    expect(result.packets).toBe(2);
    expect(result.purchase).toBe(400);
  });

  it('handles boundary multiples correctly', () => {
    const result = calculateSafetyPurchase(181); // 181 * 1.1 = 199.1 -> 200 safety -> 1 packet -> 200 purchase
    expect(result.safety).toBe(200);
    expect(result.packets).toBe(1);
    expect(result.purchase).toBe(200);
  });

  it('supports custom bulk bag sizes in safety purchase calculations', () => {
    // 350 exact drills with 1000 bulk bag size
    const resultLarge = calculateSafetyPurchase(350, 1000);
    expect(resultLarge.safety).toBe(385);
    expect(resultLarge.packets).toBe(1);
    expect(resultLarge.purchase).toBe(1000);

    // 1500 exact drills with 1000 bulk bag size
    const resultTwoBags = calculateSafetyPurchase(1500, 1000);
    expect(resultTwoBags.safety).toBe(1650);
    expect(resultTwoBags.packets).toBe(2);
    expect(resultTwoBags.purchase).toBe(2000);
  });
});

describe('Fixed-bag cost is mapping-aware (WR-02)', () => {
  it('emits a $0 line for an unmapped-shape color (471 + square)', () => {
    // 471 has an empty `square: {}` mapping in variants.ts.
    const fixed = calculateFixedBagCost('471', 'square', 350, 200, 0.25);
    expect(fixed.costExact).toBe(0);
    expect(fixed.costSafety).toBe(0);
    expect(fixed.packets).toBe(0);
    expect(fixed.purchase).toBe(0);
    // +10% drill count is preserved (matches the optimized branch's Safety Margin column).
    expect(fixed.safety).toBe(385);
  });

  it('reconciles the estimate to the cart ($0) for the unmapped color', () => {
    // Compute the cart contribution exactly as checkout.ts does.
    const cartCost = priceColorPack(packColor('471', 'square', 350, priceDb), priceDb);
    expect(cartCost).toBe(0);
    // The cart drops the color entirely (no purchasable pack).
    expect(packColor('471', 'square', 350, priceDb).packets).toBe(0);
    // Estimate == cart: the divergence is closed.
    expect(calculateFixedBagCost('471', 'square', 350, 200, 0.25).costSafety).toBe(cartCost);
  });

  it('emits a $0 line for the second empty pair (798 + round)', () => {
    // 798 has an empty `round: {}` mapping in variants.ts.
    const fixed = calculateFixedBagCost('798', 'round', 350, 200, 0.25);
    expect(fixed.costSafety).toBe(0);
    expect(fixed.packets).toBe(0);
  });

  it('leaves a mapped color unchanged (310 + square regression guard)', () => {
    const fixed = calculateFixedBagCost('310', 'square', 350, 200, 0.25);
    expect(fixed.safety).toBe(385);
    expect(fixed.packets).toBe(2);
    expect(fixed.purchase).toBe(400);
    expect(fixed.costSafety).toBeCloseTo(0.5); // 2 * 0.25
    expect(fixed.costExact).toBeCloseTo(0.4375); // (350 / 200) * 0.25
  });
});

// The brute-force cost-minimizer `optimizeBags(target, prices)` was deleted in the
// Candidate 1 consolidation. Dye-lot-correct per-color packing is now covered by
// `src/engine/__tests__/bagPlanner.test.ts` (packColor / planColorSupply), and the
// estimate == cart property is asserted there against `compileShopifyCartLink`.

// BAG-03/BAG-02 · D-08/D-10: the printable "GemPixel Supply Plan Report" must
// mirror BOTH the savings headline and the one-sentence dye-lot "why" as static
// text — self-contained regardless of the on-screen expander state.
describe('Print report mirrors the savings headline + dye-lot "why" (D-10)', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  function renderApp() {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<App />, container);
  }

  // Locate the print-only report block (`hidden print:block` div that holds the
  // supply table) so the assertions target the mirror, not the on-screen UI.
  function getPrintReport(): HTMLElement {
    const report = Array.from(container.querySelectorAll('div')).find(
      (d) => d.className.includes('print:block') && d.querySelector('table') !== null,
    );
    expect(report).toBeTruthy();
    return report as HTMLElement;
  }

  it('renders the static dye-lot sentence inside the print report', () => {
    renderApp();
    const report = getPrintReport();
    expect(report.textContent).toContain(DYE_LOT_WHY_SENTENCE);
  });

  it('renders the savings headline inside the print report (zero-state at empty plan)', () => {
    renderApp();
    const report = getPrintReport();
    // With no image loaded the shared aggregator reports no bulk savings, so the
    // mirrored headline is the truthful zero-state line (D-08) — still present,
    // never hidden.
    expect(report.textContent).toContain('No bulk savings at this size');
  });

  it('keeps the print sentence independent of the on-screen expander (closed by default)', () => {
    renderApp();
    // The "Why these bags?" expander is collapsed by default, so its on-screen
    // copy is absent — yet the print mirror still carries the sentence exactly once.
    const whyButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-controls') === 'why-these-bags-explainer',
    );
    expect(whyButton).toBeTruthy();
    expect(whyButton?.getAttribute('type')).toBe('button');
    // Accessible name is exactly "Why these bags?" (the ▶ arrow is aria-hidden).
    expect(whyButton?.textContent?.replace('▶', '').trim()).toBe('Why these bags?');
    expect(whyButton?.getAttribute('aria-expanded')).toBe('false');

    const occurrences = (container.textContent || '').split(DYE_LOT_WHY_SENTENCE).length - 1;
    expect(occurrences).toBe(1); // only the static print mirror, not the collapsed expander
  });
});
