import type { ComponentProps } from 'preact';
import { cn } from './cn';

export interface SizeCardProps extends Omit<ComponentProps<'button'>, 'onSelect' | 'className'> {
  /** Prose size name (Archivo control label), e.g. "Medium". */
  label: string;
  /** Pre-formatted grid dimensions string, e.g. "80×53" (fully computed upstream). */
  gridDims: string;
  /** Pre-formatted physical size string, e.g. "16 × 10.6 in" (fully computed upstream). */
  inches: string;
  /** Total drill/dot count as a number — rendered as a JetBrains Mono data figure. */
  drillCount: number;
  /** Selection state (controlled — App owns it, D-04). Drives the accent border + tint. */
  selected: boolean;
  /** Called when the card is clicked. */
  onSelect: () => void;
  /** Optional short badge text (e.g. "BEST FOR ART"); no element renders when omitted. */
  tag?: string;
  /**
   * Extra utility classes, merged LAST via cn(). Narrowed to a plain string —
   * Preact's native `className` is `Signalish<string>`, which cn() (a plain
   * string join) does not accept; these primitives take literal classes only.
   */
  className?: string;
}

/**
 * SizeCard — the dumb, selectable presentational size card (D-05 / SC1).
 *
 * PURE / props-only: it holds no internal state and performs NO derivation — every
 * displayed value (`label`, `gridDims`, `inches`, `drillCount`, optional `tag`) is a
 * fully-computed prop rendered exactly as received. That is the D-05 seam: Phase 22's
 * density helper + merged drill count reach this card only through props in Phase 23,
 * so it imports no engine module. Renders a native `<button type="button">` with
 * `aria-pressed` reflecting `selected`; the selected state applies the UI-SPEC recipe
 * (2px green accent border + `#EAF2EF` accent-tint fill), the default state a neutral
 * border, so the two are visually distinct. `onSelect` fires on click (fully
 * controlled — App owns selection, D-04); an optional `className` is merged LAST and
 * remaining native button attributes spread through `...rest`.
 */
export function SizeCard({
  label,
  gridDims,
  inches,
  drillCount,
  selected,
  onSelect,
  tag,
  className,
  ...rest
}: SizeCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-1 p-6 text-left rounded-[var(--radius-card)] border-2 transition-all cursor-pointer',
        selected ? 'border-accent bg-[#EAF2EF]' : 'border-border bg-panel-2',
        className,
      )}
      {...rest}
    >
      <span class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-ink">{label}</span>
        {tag ? (
          <span class="text-[10px] font-mono uppercase tracking-wider text-faint">{tag}</span>
        ) : null}
      </span>
      <span class="text-xs text-muted">{gridDims}</span>
      <span class="text-xs text-muted">{inches}</span>
      <span class="font-mono text-sm text-ink">{drillCount}</span>
    </button>
  );
}
