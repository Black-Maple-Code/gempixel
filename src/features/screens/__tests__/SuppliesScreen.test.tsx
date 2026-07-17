// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { SuppliesScreen, type SuppliesScreenProps, type SupplyRow } from '../SuppliesScreen';
import type { OrderQuote } from '../../../engine/quote';
import { formatUSD } from '../../../engine/money';

/**
 * SuppliesScreen render contract (23-04, SUPPLIES-01/02, D-07). Props-driven jsdom
 * render proving the SINGLE-SOURCE seam: the order summary renders the stub
 * `quote.lineItems` + `quote.totalCents` VERBATIM (the displayed total is set to a
 * value distinct from the line sum, so a passing assertion proves the component does
 * NO local cents math). Also locks the supply table rows, the honesty affordance for
 * an unpriced canvas (never a silent "$0.00" substitute), and the native "Why these
 * bags?" disclosure.
 */
describe('SuppliesScreen — single-source summary + supply table + honesty', () => {
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

  const DYE_LOT_WHY = 'Colors needing 800 drills or fewer stay in single-lot bags.';

  const makeRows = (): SupplyRow[] => [
    { code: '310', name: 'Black', hex: '#000000', safety: 275, bagsText: '2×200', hasUnpricedSize: false },
    { code: '321', name: 'Red', hex: '#c00000', safety: 550, bagsText: '3×200', hasUnpricedSize: false },
  ];

  // A stub OrderQuote whose `totalCents` is DELIBERATELY NOT the sum of the line cents
  // (240 + 1800 + 999 + 0 = 3039). The component must render 9999 verbatim — proving
  // it reads quote.totalCents and never re-sums the line items (D-07 anti-pattern).
  const makeQuote = (overrides: Partial<OrderQuote> = {}): OrderQuote => ({
    lineItems: [
      { key: 'drills', label: 'Drills', cents: 240, estimate: false },
      { key: 'canvas', label: 'Canvas print', cents: 1800, estimate: true, note: 'rates as of 2026-07-14' },
      { key: 'shipping', label: 'Shipping (est.)', cents: 999, estimate: true, note: 'rates as of 2026-07-14' },
      { key: 'tax', label: 'Tax', cents: 0, estimate: true, note: 'calculated at vendor checkout' },
    ],
    totalCents: 9999,
    ratesAsOf: '2026-07-14',
    canvasPriced: true,
    ...overrides,
  });

  const makeProps = (overrides: Partial<SuppliesScreenProps> = {}): SuppliesScreenProps => ({
    rows: makeRows(),
    symbolMap: { '310': '♣', '321': '♦' },
    dyeLotWhy: DYE_LOT_WHY,
    totalSafetyDrills: 825,
    totalPackets: 5,
    quote: makeQuote(),
    ...overrides,
  });

  const setup = (overrides: Partial<SuppliesScreenProps> = {}) => {
    const props = makeProps(overrides);
    render(<SuppliesScreen {...props} />, container);
    return props;
  };

  it('renders the order summary from quote.lineItems + quote.totalCents VERBATIM (single-source, no local math)', () => {
    const props = setup();

    // Every line item label + its formatted amount is present.
    for (const li of props.quote.lineItems) {
      const line = container.querySelector(`[data-line="${li.key}"]`) as HTMLElement;
      expect(line).toBeTruthy();
      expect(line.textContent).toContain(li.label);
      if (li.key === 'canvas' && !props.quote.canvasPriced) continue; // honesty path tested separately
      expect(line.textContent).toContain(formatUSD(li.cents));
    }

    // The displayed total equals quote.totalCents EXACTLY (9999 → "$99.99"), which is
    // NOT the line-item sum (3039) — so the component performed no local summation.
    const total = container.querySelector('[data-testid="supplies-est-total"]') as HTMLElement;
    expect(total.textContent).toBe(formatUSD(9999));
    expect(total.textContent).toBe('$99.99');
    // Guard: the line sum ($30.39) is never shown as the total.
    expect(total.textContent).not.toBe('$30.39');
  });

  it('renders one supply row per rows entry with its code, name, safety count, and bagsText', () => {
    const props = setup();
    const rows = Array.from(container.querySelectorAll('[data-supply-row]')) as HTMLElement[];
    expect(rows.length).toBe(props.rows.length);

    const black = rows.find((r) => r.getAttribute('data-supply-row') === '310')!;
    expect(black.textContent).toContain('♣'); // symbol from symbolMap
    expect(black.textContent).toContain('310');
    expect(black.textContent).toContain('Black');
    expect(black.textContent).toContain('275'); // +10% safety count
    expect(black.textContent).toContain('2×200'); // bagsText
  });

  it('surfaces an "unavailable" affordance for an unpriced canvas — never a silent "$0.00"', () => {
    setup({
      quote: makeQuote({
        canvasPriced: false,
        lineItems: [
          { key: 'drills', label: 'Drills', cents: 240, estimate: false },
          { key: 'canvas', label: 'Canvas print', cents: 0, estimate: true, note: 'rates as of 2026-07-14' },
          { key: 'shipping', label: 'Shipping (est.)', cents: 999, estimate: true },
          { key: 'tax', label: 'Tax', cents: 0, estimate: true, note: 'calculated at vendor checkout' },
        ],
        totalCents: 1239,
      }),
    });

    const canvasLine = container.querySelector('[data-line="canvas"]') as HTMLElement;
    expect(canvasLine).toBeTruthy();
    // Honesty (Pitfall 6 / T-23-04-01): the unpriced canvas shows an explicit
    // "unavailable" affordance, not a "$0.00" figure.
    expect(canvasLine.textContent?.toLowerCase()).toContain('unavailable');
    expect(canvasLine.textContent).not.toContain('$0.00');
  });

  it('marks a row with an unpriced bag size instead of a bag string', () => {
    setup({
      rows: [
        { code: '471', name: 'Avocado Green VY LT', hex: '#a0b060', safety: 100, bagsText: '', hasUnpricedSize: true },
      ],
    });
    const row = container.querySelector('[data-supply-row="471"]') as HTMLElement;
    expect(row.textContent?.toLowerCase()).toContain('unpriced');
  });

  it('renders the SC2/BAG-02 totals caption from totalPackets + totalSafetyDrills', () => {
    setup({ totalPackets: 5, totalSafetyDrills: 825 });
    // The aggregator's totalPackets is user-visible (not merely derived).
    expect(container.textContent).toMatch(/Drills \(5 bag\(s\)\)/);
    expect(container.textContent).toContain('825');
  });

  it('renders the native "Why these bags?" <details> whose body is the dyeLotWhy prop', () => {
    const props = setup();
    const details = Array.from(container.querySelectorAll('details')).find(
      (d) => d.querySelector('summary')?.textContent?.trim() === 'Why these bags?',
    ) as HTMLDetailsElement | undefined;
    expect(details).toBeTruthy();
    expect(details!.textContent).toContain(props.dyeLotWhy);
  });

  it('pins the order-summary panel md:sticky on desktop while keeping mobile natural flow (GAP-2/SC9)', () => {
    setup();
    // The order-summary panel is the closest ancestor <div> of the est-total that
    // also carries the "Order summary" heading (jsdom computes no layout, so — like
    // print.test.tsx — assert on className tokens).
    const total = container.querySelector('[data-testid="supplies-est-total"]') as HTMLElement;
    let panel: HTMLElement | null = total.parentElement;
    while (panel && !panel.textContent?.includes('Order summary')) {
      panel = panel.parentElement;
    }
    expect(panel).toBeTruthy();

    const cls = panel!.className;
    // Desktop pin: sticky, pinned to the Zone 2 scroll viewport top, content-height.
    expect(cls).toContain('md:sticky');
    expect(cls).toContain('md:top-0');
    expect(cls).toContain('md:self-start');
    // Mobile stays natural single-column flow — the pin is md:-gated, never a bare
    // unprefixed `sticky`/`self-start` token.
    expect(cls).not.toMatch(/(^|\s)sticky(\s|$)/);
    expect(cls).not.toMatch(/(^|\s)self-start(\s|$)/);
  });
});
