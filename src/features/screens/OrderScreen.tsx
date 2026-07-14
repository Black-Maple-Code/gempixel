import { formatUSD } from '../../engine/money';
import type { OrderQuote } from '../../engine/quote';
import type { OrderFinish, OrderPacketShipTo } from './orderPacket';
import { Pill } from '../../ui/Pill';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * OrderScreen — the canvas-first "Order" screen (step 4, ORDER-01/02, D-08/D-09).
 *
 * PURE / props-only (D-01): App.tsx stays the sole state owner; this component
 * owns NO domain state, does NO cents math, and makes NO network call. It is the
 * honest, client-side handoff: an auto-filled LOCKED spec (Rolled Canvas fixed,
 * size derived from the grid, finish), a finish selector, a client-only ship-to,
 * and the SAME single-source `buildOrderQuote` result Supplies renders (D-07).
 *
 * The flow COMPLETES by DOWNLOADING a versioned, self-contained JSON packet
 * (`onDownloadPacket`, wired in App to buildOrderPacket + a Blob download). The
 * terminal state is an honest "Packet downloaded — take this to the vendor"
 * confirmation: NO order number, NO receipt, NO payment UI (D-09). The mock's
 * "Place order · $57.00" is deliberately NOT shipped.
 */

/** The two locked finish options (fixed enum, no price impact — RESEARCH Q3). */
const FINISH_OPTIONS: Array<{
  value: OrderFinish;
  label: string;
  blurb: string;
  tag?: string;
}> = [
  { value: 'trimmed', label: 'Trimmed', blurb: 'No border — full grid to the edge.', tag: 'BEST FOR ART' },
  { value: 'wrap', label: 'Image wrap', blurb: '1½″ wraps around a stretched frame.' },
];

/** One editable ship-to field descriptor (client-only free text). */
const SHIP_TO_FIELDS: Array<{ key: keyof OrderPacketShipTo; label: string; autocomplete: string }> = [
  { key: 'name', label: 'Full name', autocomplete: 'name' },
  { key: 'addressLine1', label: 'Address', autocomplete: 'address-line1' },
  { key: 'addressLine2', label: 'Apt / suite (optional)', autocomplete: 'address-line2' },
  { key: 'city', label: 'City', autocomplete: 'address-level2' },
  { key: 'state', label: 'State / region', autocomplete: 'address-level1' },
  { key: 'postalCode', label: 'Postal code', autocomplete: 'postal-code' },
  { key: 'country', label: 'Country', autocomplete: 'country-name' },
];

export interface OrderScreenProps {
  /** LOCKED product name — always "Rolled Canvas" (App passes the constant). */
  product: string;
  /** Physical size label, e.g. "8 × 5.3 in" (App-derived via gridToInches). */
  sizeLabel: string;
  /** Grid label for the spec caption, e.g. "80×53" (App-derived). */
  gridLabel: string;
  /** Selected finish (fixed enum). */
  finish: OrderFinish;
  /** Finish selection callback. */
  onFinishChange: (finish: OrderFinish) => void;
  /** Client-only ship-to block (embedded in the packet, never transmitted). */
  shipTo: OrderPacketShipTo;
  /** Ship-to field-patch callback (App merges into its shipTo state). */
  onShipToChange: (patch: Partial<OrderPacketShipTo>) => void;
  /** The single-source customer quote (the SAME object Supplies renders, D-07). */
  quote: OrderQuote;
  /** Build + download the versioned JSON packet (App handler). */
  onDownloadPacket: () => void;
  /** true once the packet has downloaded — drives the honest terminal state. */
  packetDownloaded: boolean;
}

export function OrderScreen(props: OrderScreenProps) {
  const {
    product,
    sizeLabel,
    gridLabel,
    finish,
    onFinishChange,
    shipTo,
    onShipToChange,
    quote,
    onDownloadPacket,
    packetDownloaded,
  } = props;

  const finishLabel = FINISH_OPTIONS.find((o) => o.value === finish)?.label ?? finish;

  return (
    <section
      data-screen="order"
      className="flex w-full max-w-full flex-col gap-6 text-ink md:flex-row"
    >
      {/* ── Left: the auto-filled, LOCKED spec (ORDER-01) ─────────────── */}
      <div className="flex min-w-0 flex-col gap-4 border-border bg-panel p-6 md:w-[470px] md:shrink-0 md:border-r">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            Your canvas proof
          </span>
          <span
            data-testid="order-size-badge"
            className="w-fit rounded-[var(--radius-pill)] bg-[#EAF2EF] px-3 py-1 font-mono text-sm font-semibold text-accent"
          >
            {sizeLabel}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            Sent to the lab · auto-filled 4/4
          </span>

          <dl className="flex flex-col divide-y divide-[var(--border-2)] text-sm">
            {/* IMAGE */}
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-faint">Image</dt>
              <dd className="text-right text-ink">Finished chart · print-ready</dd>
            </div>
            {/* PRODUCT — LOCKED */}
            <div data-spec-row="product" className="flex items-center justify-between gap-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-faint">Product</dt>
              <dd className="flex items-center gap-2 text-right text-ink">
                <span>{product}</span>
                <Pill variant="neutral" title="This spec is fixed and cannot be edited.">
                  LOCKED
                </Pill>
              </dd>
            </div>
            {/* SIZE */}
            <div data-spec-row="size" className="flex items-baseline justify-between gap-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-faint">Size</dt>
              <dd className="text-right font-mono text-ink">
                {sizeLabel} · from {gridLabel} grid
              </dd>
            </div>
            {/* FINISH */}
            <div data-spec-row="finish" className="flex items-baseline justify-between gap-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-faint">Finish</dt>
              <dd className="text-right text-ink">{finishLabel}</dd>
            </div>
          </dl>

          <p className="text-xs leading-relaxed text-muted">
            Everything the print lab needs is carried over. Nothing to re-enter.
          </p>
        </div>
      </div>

      {/* ── Right: finish · ship-to · price · download ────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-6 bg-panel-2 p-6">
        {/* CANVAS FINISH — two selectable cards */}
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">
            Canvas finish
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {FINISH_OPTIONS.map((opt) => {
              const selected = finish === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-finish={opt.value}
                  aria-pressed={selected}
                  onClick={() => onFinishChange(opt.value)}
                  className={cn(
                    'flex flex-1 cursor-pointer flex-col gap-1 rounded-[var(--radius-card)] border p-3 text-left transition-all',
                    selected
                      ? 'border-2 border-accent bg-[#EAF2EF]'
                      : 'border border-border bg-panel hover:border-accent',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{opt.label}</span>
                    {opt.tag && <Pill variant="tag">{opt.tag}</Pill>}
                  </span>
                  <span className="text-xs text-muted">{opt.blurb}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* SHIP TO — client-side only, embedded in the packet, never sent */}
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">
            Ship to
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SHIP_TO_FIELDS.map((field) => (
              <label
                key={field.key}
                className={cn(
                  'flex flex-col gap-1 text-xs text-muted',
                  (field.key === 'name' || field.key === 'addressLine1' || field.key === 'addressLine2') &&
                    'sm:col-span-2',
                )}
              >
                <span>{field.label}</span>
                <input
                  type="text"
                  data-shipto={field.key}
                  autocomplete={field.autocomplete}
                  value={shipTo[field.key] ?? ''}
                  onInput={(e) =>
                    onShipToChange({ [field.key]: (e.target as HTMLInputElement).value })
                  }
                  className="rounded-[var(--radius-control)] border border-border bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                />
              </label>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-faint">
            Stays on your device — embedded in the downloaded file only, never sent anywhere.
          </p>
        </fieldset>

        {/* PRICE — the SAME single-source quote, rendered VERBATIM (D-07) */}
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Price</span>
          <dl className="flex flex-col gap-1.5 font-mono text-sm">
            {quote.lineItems.map((li) => {
              const unavailable = li.key === 'canvas' && !quote.canvasPriced;
              return (
                <div
                  key={li.key}
                  data-line={li.key}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="text-muted">{li.label}</dt>
                  <dd className="text-right text-ink">
                    {unavailable ? (
                      <Pill variant="neutral" title={li.note}>
                        unavailable
                      </Pill>
                    ) : (
                      <>
                        {formatUSD(li.cents)}
                        {li.estimate && (
                          <span className="ml-1 text-[10px] uppercase text-faint">est.</span>
                        )}
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <span className="font-mono text-xs uppercase tracking-wider text-faint">Total</span>
            <span
              data-testid="order-total"
              className="font-mono text-[20px] font-semibold text-accent"
            >
              {formatUSD(quote.totalCents)}
            </span>
          </div>
          <p className="font-mono text-[10px] text-faint">rates as of {quote.ratesAsOf}</p>
        </div>

        {/* PRIMARY ACTION / honest terminal state (D-09) */}
        {packetDownloaded ? (
          <div
            data-testid="order-terminal"
            className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-accent bg-[#EAF2EF] p-4"
          >
            <span className="text-sm font-semibold text-accent">Packet downloaded.</span>
            <span className="text-xs leading-relaxed text-muted">
              Take this file to your vendor to place the order.
            </span>
          </div>
        ) : (
          <Button
            variant="primary"
            data-testid="order-download-cta"
            className="w-full py-2.5 text-sm"
            onClick={onDownloadPacket}
          >
            Download order packet
          </Button>
        )}
      </div>
    </section>
  );
}
