import { formatUSD } from '../../engine/money';
import type { OrderQuote } from '../../engine/quote';
import { Pill } from '../../ui/Pill';

/**
 * One pre-joined supply row (a subset of App's `sortedMatches`). App owns the
 * DMC_PALETTE name/hex join, the +10% safety math, and the bag packing — this
 * screen renders the already-derived figures verbatim (D-01 / Pattern 2).
 */
export interface SupplyRow {
  /** DMC code, e.g. "310". */
  code: string;
  /** DMC color name, e.g. "Black". */
  name: string;
  /** Swatch hex from DMC_PALETTE, e.g. "#000000". */
  hex: string;
  /** Drill count including the +10% safety margin (App-computed). */
  safety: number;
  /** Human bag string, e.g. "9×200" (App-computed via the bag planner). */
  bagsText: string;
  /** PRICE-02: this color is coverable only by an unpriced bag size. */
  hasUnpricedSize: boolean;
}

/**
 * SuppliesScreen — the canvas-first "Supplies" screen (step 3, SUPPLIES-01/02).
 *
 * PURE / props-only (D-01): App.tsx stays the sole state owner; this component
 * owns NO domain state and does NO cents math. It renders two surfaces from
 * already-derived props:
 *  - a **drill supply plan table** (one row per `rows` entry: symbol · swatch ·
 *    DMC code+name · drills incl. +10% safety · bags) + an inline "Why these
 *    bags?" `<details>` disclosure, and
 *  - an **order-summary panel** that renders `quote.lineItems` + `quote.totalCents`
 *    VERBATIM from the single-source `buildOrderQuote` result (D-07). There is NO
 *    `.reduce`/summation of cents in this component — Supplies and Order read the
 *    exact same quote object, so their totals can never diverge.
 *
 * Honesty (Pitfall 6 / T-23-04-01): when `quote.canvasPriced` is false, the canvas
 * line renders an explicit "unavailable" affordance instead of a silent `$0`; a
 * row with `hasUnpricedSize` carries an inline "unpriced" pill. The tax line is a
 * deliberate, labelled `$0.00` ("calculated at vendor checkout"), never silent.
 */
export interface SuppliesScreenProps {
  /** Pre-joined + pre-sorted supply rows (App's `sortedMatches`). */
  rows: SupplyRow[];
  /** DMC code → symbol glyph (App's `symbolMap`). */
  symbolMap: Record<string, string>;
  /** The static dye-lot "why these bags?" explanation (App's `DYE_LOT_WHY_SENTENCE`). */
  dyeLotWhy: string;
  /** The single-source customer quote (App's `buildOrderQuote(...)` result). */
  quote: OrderQuote;
}

export function SuppliesScreen(props: SuppliesScreenProps) {
  const { rows, symbolMap, dyeLotWhy, quote } = props;

  return (
    <section
      data-screen="supplies"
      className="flex w-full max-w-full flex-col gap-6 text-ink md:flex-row"
    >
      {/* ── Left: drill supply plan table ─────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-[18px] font-semibold leading-[1.2] text-ink">
            Drill supply plan
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            counts include +10% safety
          </span>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-faint">
              <th className="py-1.5 pr-2 font-normal" scope="col">
                <span aria-hidden="true">◇</span>
                <span className="sr-only">Symbol</span>
              </th>
              <th className="py-1.5 pr-2 font-normal" scope="col">
                <span className="sr-only">Swatch</span>
              </th>
              <th className="py-1.5 pr-2 font-normal" scope="col">
                DMC color
              </th>
              <th className="py-1.5 pr-2 text-right font-normal" scope="col">
                Drills
              </th>
              <th className="py-1.5 text-right font-normal" scope="col">
                Bags
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.code}
                data-supply-row={row.code}
                className="border-b border-[var(--border-2)] align-middle"
              >
                {/* Symbol glyph */}
                <td className="py-2 pr-2 font-mono text-sm text-ink">
                  {symbolMap[row.code] ?? ''}
                </td>
                {/* Swatch */}
                <td className="py-2 pr-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-4 w-4 shrink-0 rounded-[3px] border border-border"
                    style={{ backgroundColor: row.hex }}
                  />
                </td>
                {/* DMC code + name */}
                <td className="py-2 pr-2">
                  <span className="font-mono font-bold text-ink">{row.code}</span>{' '}
                  <span className="text-muted">{row.name}</span>
                </td>
                {/* Drills incl. +10% safety */}
                <td className="py-2 pr-2 text-right font-mono tabular-nums text-ink">
                  {row.safety.toLocaleString()}
                </td>
                {/* Bags — with an inline honesty pill when a size is unpriced */}
                <td className="py-2 text-right font-mono text-accent">
                  {row.hasUnpricedSize ? (
                    <Pill variant="neutral" title="A required bag size has no price set">
                      unpriced
                    </Pill>
                  ) : (
                    row.bagsText
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Inline "Why these bags?" disclosure (native <details>, a11y-native). */}
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-accent">
            Why these bags?
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-muted">{dyeLotWhy}</p>
        </details>
      </div>

      {/* ── Right: order-summary panel (single-source quote, verbatim) ──── */}
      <aside className="flex w-full flex-col gap-3 border-l border-border bg-panel p-6 md:w-[320px] md:shrink-0">
        <h2 className="font-serif text-[18px] font-semibold leading-[1.2] text-ink">
          Order summary
        </h2>

        <dl className="flex flex-col gap-1.5 font-mono text-sm">
          {quote.lineItems.map((li) => {
            const unavailable = li.key === 'canvas' && !quote.canvasPriced;
            return (
              <div key={li.key} className="flex items-baseline justify-between gap-3">
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

        {/* Divider → the grand total, rendered VERBATIM from quote.totalCents
            (no local summation — D-07 single-source). */}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-2">
          <span className="font-mono text-xs uppercase tracking-wider text-faint">
            Est. total
          </span>
          <span
            data-testid="supplies-est-total"
            className="font-mono text-[20px] font-semibold text-accent"
          >
            {formatUSD(quote.totalCents)}
          </span>
        </div>

        <p className="text-[10px] leading-relaxed text-faint">
          Billed by GemPixel · printed &amp; shipped by our lab
        </p>
        <p className="font-mono text-[10px] text-faint">rates as of {quote.ratesAsOf}</p>
      </aside>
    </section>
  );
}
