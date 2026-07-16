// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { OrderScreen, type OrderScreenProps } from '../OrderScreen';
import type { OrderPacketShipTo } from '../orderPacket';
import type { OrderQuote } from '../../../engine/quote';
import { formatUSD } from '../../../engine/money';

/**
 * OrderScreen render contract (26-02, ORDER-01/02/04/05, D-06/D-07/D-09). Props-driven
 * jsdom render proving the honest TWO-vendor handoff: section ① "Get your canvas made"
 * offers four downloads (grid PNG, grid+legend PNG, legend PNG, JSON packet), each calling
 * its App handler; section ② "Order your drills" offers the single Diamond Drills USA cart
 * CTA (`onCartCheckout`). The two done-states are INDEPENDENT per-task booleans replacing the
 * old single `packetDownloaded`: `canvasDownloaded` surfaces the "Downloaded ✓" sub-terminal
 * (`order-canvas-terminal`), `cartOpened` surfaces the "Cart opened ↗" sub-terminal
 * (`order-cart-terminal`). Honesty guardrails (D-06/D-09): the cart terminal is "Cart opened",
 * NEVER "Ordered"/"Purchased"/"Complete"; nowhere a "Place order", receipt, order number, or
 * payment control. The price total renders `quote.totalCents` VERBATIM (single source, D-07).
 */
describe('OrderScreen — two honest task sections (canvas downloads + drill cart, independent done-states)', () => {
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
    onDownloadCanvasGrid: vi.fn(),
    onDownloadGridLegend: vi.fn(),
    onDownloadLegend: vi.fn(),
    onDownloadPacket: vi.fn(),
    onCartCheckout: vi.fn(),
    canvasDownloaded: false,
    cartOpened: false,
    ...overrides,
  });

  const setup = (overrides: Partial<OrderScreenProps> = {}) => {
    const props = makeProps(overrides);
    render(<OrderScreen {...props} />, container);
    return props;
  };

  const q = <T extends HTMLElement = HTMLElement>(testid: string) =>
    container.querySelector(`[data-testid="${testid}"]`) as T | null;

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

  it('section ① renders four labeled download CTAs, each invoking its own handler', () => {
    const props = setup();

    const grid = q<HTMLButtonElement>('order-download-canvas-cta')!;
    expect(grid).toBeTruthy();
    expect(grid.textContent).toBe('Download canvas (grid)');
    grid.click();
    expect(props.onDownloadCanvasGrid).toHaveBeenCalledTimes(1);

    const combined = q<HTMLButtonElement>('order-download-grid-legend-cta')!;
    expect(combined).toBeTruthy();
    expect(combined.textContent).toBe('Download grid + legend');
    combined.click();
    expect(props.onDownloadGridLegend).toHaveBeenCalledTimes(1);

    const legend = q<HTMLButtonElement>('order-download-legend-cta')!;
    expect(legend).toBeTruthy();
    expect(legend.textContent).toBe('Download legend');
    legend.click();
    expect(props.onDownloadLegend).toHaveBeenCalledTimes(1);

    const packet = q<HTMLButtonElement>('order-download-cta')!;
    expect(packet).toBeTruthy();
    expect(packet.textContent).toBe('Download order packet');
    // No price baked into any download label (no implied charge).
    expect(packet.textContent).not.toMatch(/\$/);
    packet.click();
    expect(props.onDownloadPacket).toHaveBeenCalledTimes(1);
  });

  it('section ② renders one Diamond Drills USA cart CTA calling onCartCheckout', () => {
    const props = setup();
    const cart = q<HTMLButtonElement>('order-cart-cta')!;
    expect(cart).toBeTruthy();
    expect(cart.textContent).toBe('Open drill cart at Diamond Drills USA ↗');
    cart.click();
    expect(props.onCartCheckout).toHaveBeenCalledTimes(1);
  });

  it('the download CTAs stay available even after canvasDownloaded (done panel is additive)', () => {
    setup({ canvasDownloaded: true });
    // All four downloads remain clickable so the user can keep grabbing artifacts.
    expect(q('order-download-canvas-cta')).toBeTruthy();
    expect(q('order-download-grid-legend-cta')).toBeTruthy();
    expect(q('order-download-legend-cta')).toBeTruthy();
    expect(q('order-download-cta')).toBeTruthy();
  });

  it('surfaces the two sub-terminals INDEPENDENTLY (canvas done ≠ cart done)', () => {
    // Neither done → no terminals.
    setup({ canvasDownloaded: false, cartOpened: false });
    expect(q('order-canvas-terminal')).toBeNull();
    expect(q('order-cart-terminal')).toBeNull();

    // Only canvas done → only the canvas terminal.
    setup({ canvasDownloaded: true, cartOpened: false });
    expect(q('order-canvas-terminal')).toBeTruthy();
    expect(q('order-cart-terminal')).toBeNull();
    expect(q('order-canvas-terminal')!.textContent?.toLowerCase()).toContain('downloaded');

    // Only cart done → only the cart terminal.
    setup({ canvasDownloaded: false, cartOpened: true });
    expect(q('order-canvas-terminal')).toBeNull();
    expect(q('order-cart-terminal')).toBeTruthy();

    // Both done → both terminals.
    setup({ canvasDownloaded: true, cartOpened: true });
    expect(q('order-canvas-terminal')).toBeTruthy();
    expect(q('order-cart-terminal')).toBeTruthy();
  });

  it('the cart sub-terminal reads "Cart opened" — never Ordered/Purchased/Complete (D-06)', () => {
    setup({ cartOpened: true });
    const cartTerminal = q('order-cart-terminal')!;
    expect(cartTerminal.textContent).toMatch(/cart opened/i);
    expect(cartTerminal.textContent).not.toMatch(/ordered|purchased|complete/i);
  });

  it('preserves the D-09 honesty guardrails — no place-order / receipt / order-number / payment UI', () => {
    setup({ canvasDownloaded: true, cartOpened: true });
    const text = container.textContent ?? '';
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
