import { useRef } from 'preact/hooks';
import { cn } from './cn';

/** One selectable segment — its `value` flows back through `onChange`, its `label` is the visible text. */
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Currently-selected value (controlled — App owns it, D-04). */
  value: T;
  /** Called with the newly-selected value on click or arrow/Home/End keyboard selection. */
  onChange: (value: T) => void;
  /** The mutually-exclusive segments, in visual order. */
  options: SegmentOption<T>[];
  /** Accessible group name — applied as the radiogroup's aria-label. */
  label: string;
  /**
   * Extra utility classes, merged LAST via cn(). Narrowed to a plain string —
   * Preact's native `className` is `Signalish<string>`, which cn() (a plain
   * string join) does not accept; these primitives take literal classes only.
   */
  className?: string;
}

/**
 * SegmentedControl — a hand-built WAI-ARIA `role="radiogroup"` (SC2 / D-04).
 *
 * PURE / controlled: it holds NO value state (App.tsx is the sole owner). It keeps
 * only a ref-array of the option nodes for imperative focus — that is focus
 * machinery, not value state. Each option is a native `<button role="radio">` with
 * `aria-checked` reflecting `value` and a roving tabindex (the selected option is
 * the single tab stop). ArrowRight/ArrowDown -> next, ArrowLeft/ArrowUp -> prev,
 * Home -> first, End -> last — all wrapping, each moving selection (`onChange`) AND
 * focus (`.focus()`) in the same tick, per the APG radiogroup "selection follows
 * focus" rule. Imperative focus is required: changing `tabIndex` alone never moves
 * focus. An optional `className` is merged LAST onto the radiogroup container.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex(o => o.value === value),
  );

  // Move selection + focus to `to`, wrapping around the ends (APG behavior).
  const move = (to: number, e: KeyboardEvent) => {
    e.preventDefault(); // stop the page from scrolling on arrow/Home/End
    const next = (to + options.length) % options.length;
    onChange(options[next].value); // selection follows focus
    refs.current[next]?.focus(); // imperative focus — does not come free from tabIndex
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex gap-1', className)}>
      {options.map((opt, i) => {
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === selectedIndex ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i + 1, e);
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i - 1, e);
              else if (e.key === 'Home') move(0, e);
              else if (e.key === 'End') move(options.length - 1, e);
            }}
            className={cn(
              'px-3 py-1.5 text-xs rounded-[var(--radius-control)] transition-all cursor-pointer',
              checked ? 'bg-accent text-on-accent' : 'bg-panel-2 text-muted',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
