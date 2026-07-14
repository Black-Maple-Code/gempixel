// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { OrderScreen, type OrderScreenProps } from '../OrderScreen';
import type { OrderPacketShipTo } from '../orderPacket';
import type { OrderQuote } from '../../../engine/quote';
import { formatUSD } from '../../../engine/money';

/**
 * OrderScreen render contract (23-05, ORDER-01/02, D-08/D-09). Props-driven jsdom
 * render proving the honest handoff: the CTA is "Download order packet" (never
 * "Place order", no price in the label); the price total renders the stub
 * `quote.totalCents` VERBATIM (single source, D-07); the LOCKED spec Pill is
 * present; the two finish cards select via `onFinishChange`; and the terminal
 * confirmation appears ONLY on `packetDownloaded` with NO order number / receipt /
 * payment text (D-09). Ship-to renders as plain inputs (no dangerouslySetInnerHTML).
 */
describe('OrderScreen — honest handoff (locked spec + finish + ship-to + quote + terminal)', () => {
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

  const makeShipTo = (): OrderPacketShipTo => ({
    name: 'Ada Lovelace',
    addressLine1: '1 Analytical Way',
    city: 'London',
    state: '',
    postalCode: 'EC1',
    country: 'UK',
  });

  // A stub OrderQuote whose totalCents (8888) is NOT the line sum — a passing
  // assertion proves the component reads quote.totalCents and does no local math.
  const makeQuote = (overrides: Partial<OrderQuote> = {}): OrderQuote => ({
    lineItems: [
      { key: 'drills', label: 'Drills', cents: 240, estimate: false },
      { key: 'canvas', label: 'Canvas print', cents: 1800, estimate: true, note: 'rates as of 2026-07-14' },
      { key: 'shipping', label: 'Shipping (est.)', cents: 999, estimate: true },
      { key: 'tax', label: 'Tax', cents: 0, estimate: true, note: 'calculated at vendor checkout' },
    ],
    totalCents: 8888,
    ratesAsOf: '2026-07-14',
    canvasPriced: true,
    ...overrides,
  });

  const makeProps = (overrides: Partial<OrderScreenProps> = {}): OrderScreenProps => ({
    product: 'Rolled Canvas',
    sizeLabel: '8 × 5.3 in',
    gridLabel: '80×53',
    finish: 'trimmed',
    onFinishChange: vi.fn(),
    shipTo: makeShipTo(),
    onShipToChange: vi.fn(),
    quote: makeQuote(),
    onDownloadPacket: vi.fn(),
    packetDownloaded: false,
    ...overrides,
  });

  const setup = (overrides: Partial<OrderScreenProps> = {}) => {
    const props = makeProps(overrides);
    render(<OrderScreen {...props} />, container);
    return props;
  };

  it('renders the LOCKED spec: Rolled Canvas + LOCKED pill, size, and finish', () => {
    setup();
    const productRow = container.querySelector('[data-spec-row="product"]') as HTMLElement;
    expect(productRow.textContent).toContain('Rolled Canvas');
    expect(productRow.textContent).toContain('LOCKED');

    const sizeRow = container.querySelector('[data-spec-row="size"]') as HTMLElement;
    expect(sizeRow.textContent).toContain('8 × 5.3 in');
    expect(sizeRow.textContent).toContain('80×53 grid');

    const finishRow = container.querySelector('[data-spec-row="finish"]') as HTMLElement;
    expect(finishRow.textContent).toContain('Trimmed');
  });

  it('renders two finish cards; selecting one calls onFinishChange', () => {
    const props = setup();
    const trimmed = container.querySelector('[data-finish="trimmed"]') as HTMLButtonElement;
    const wrap = container.querySelector('[data-finish="wrap"]') as HTMLButtonElement;
    expect(trimmed).toBeTruthy();
    expect(wrap).toBeTruthy();
    // Default selection reflected via aria-pressed.
    expect(trimmed.getAttribute('aria-pressed')).toBe('true');
    expect(wrap.getAttribute('aria-pressed')).toBe('false');
    // Trimmed carries the "BEST FOR ART" tag.
    expect(trimmed.textContent).toContain('BEST FOR ART');

    wrap.click();
    expect(props.onFinishChange).toHaveBeenCalledWith('wrap');
  });

  it('renders the ship-to as plain text inputs (no dangerouslySetInnerHTML sink)', () => {
    const props = setup();
    const nameInput = container.querySelector('[data-shipto="name"]') as HTMLInputElement;
    expect(nameInput.value).toBe(props.shipTo.name);
    const cityInput = container.querySelector('[data-shipto="city"]') as HTMLInputElement;
    expect(cityInput.value).toBe('London');
    // No injection sink anywhere in the rendered tree.
    expect(container.innerHTML).not.toContain('<script');
  });

  it('renders the price total from quote.totalCents VERBATIM (single source, no local math)', () => {
    setup();
    const total = container.querySelector('[data-testid="order-total"]') as HTMLElement;
    expect(total.textContent).toBe(formatUSD(8888));
    expect(total.textContent).toBe('$88.88');
    // Guard: the line sum ($30.39) is never shown as the total.
    expect(total.textContent).not.toBe('$30.39');
  });

  it('has a "Download order packet" CTA (no price, never "Place order") that calls onDownloadPacket', () => {
    const props = setup();
    const cta = container.querySelector('[data-testid="order-download-cta"]') as HTMLButtonElement;
    expect(cta).toBeTruthy();
    expect(cta.textContent).toBe('Download order packet');
    // No price baked into the label (no implied charge).
    expect(cta.textContent).not.toMatch(/\$/);
    // The mock's "Place order" is explicitly NOT shipped (D-09).
    expect(container.textContent).not.toMatch(/place order/i);

    cta.click();
    expect(props.onDownloadPacket).toHaveBeenCalledTimes(1);
  });

  it('shows the honest terminal state ONLY on packetDownloaded — no order number/receipt/payment', () => {
    // Before download: no terminal state, CTA present.
    const c = container;
    setup({ packetDownloaded: false });
    expect(c.querySelector('[data-testid="order-terminal"]')).toBeNull();
    expect(c.querySelector('[data-testid="order-download-cta"]')).toBeTruthy();

    // After download: honest confirmation, CTA gone.
    setup({ packetDownloaded: true });
    const terminal = c.querySelector('[data-testid="order-terminal"]') as HTMLElement;
    expect(terminal).toBeTruthy();
    expect(terminal.textContent?.toLowerCase()).toContain('packet downloaded');
    expect(terminal.textContent?.toLowerCase()).toContain('vendor');
    // The price-bearing CTA is gone in the terminal state.
    expect(c.querySelector('[data-testid="order-download-cta"]')).toBeNull();

    // Honesty (D-09): no fake receipt, no order number, no payment UI anywhere.
    const text = c.textContent ?? '';
    expect(text).not.toMatch(/place order/i);
    expect(text).not.toMatch(/receipt/i);
    expect(text).not.toMatch(/order\s*(number|#|no\.)/i);
    expect(text).not.toMatch(/payment|pay now|credit card/i);
  });

  it('surfaces an "unavailable" affordance for an unpriced canvas — never a silent "$0.00"', () => {
    setup({
      quote: makeQuote({
        canvasPriced: false,
        lineItems: [
          { key: 'drills', label: 'Drills', cents: 240, estimate: false },
          { key: 'canvas', label: 'Canvas print', cents: 0, estimate: true },
          { key: 'shipping', label: 'Shipping (est.)', cents: 999, estimate: true },
          { key: 'tax', label: 'Tax', cents: 0, estimate: true, note: 'calculated at vendor checkout' },
        ],
        totalCents: 1239,
      }),
    });
    const canvasLine = container.querySelector('[data-line="canvas"]') as HTMLElement;
    expect(canvasLine.textContent?.toLowerCase()).toContain('unavailable');
    expect(canvasLine.textContent).not.toContain('$0.00');
  });
});
