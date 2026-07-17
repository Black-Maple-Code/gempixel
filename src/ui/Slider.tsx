import type { ComponentProps } from 'preact';
import { cn } from './cn';

export interface SliderProps
  extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'onInput' | 'type' | 'className'> {
  /** Current value (controlled — App owns it, D-04). */
  value: number;
  /** Called live (per drag tick / keyboard step) with the parsed numeric value. */
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Increment for pointer/keyboard steps. Defaults to 1. */
  step?: number;
  /** Accessible name — REQUIRED (D-04); applied as aria-label. */
  ariaLabel: string;
  /** Human-readable value announcement (e.g. "24 of 26 matched"); applied as aria-valuetext. */
  ariaValueText?: string;
  /**
   * Extra utility classes, merged LAST via cn(). Narrowed to a plain string —
   * Preact's native `className` is `Signalish<string>`, which cn() (a plain
   * string join) does not accept; these primitives take literal classes only.
   */
  className?: string;
}

/**
 * Slider — the shared controlled native `<input type="range">` primitive (SC2 / D-04).
 *
 * PURE / controlled: it holds NO value state (App.tsx is the sole owner). The native
 * range gives keyboard operability, focus, `role="slider"`, and `aria-valuenow` for
 * free; we add `aria-label` + `aria-valuetext` so the value announces meaningfully.
 * CRITICAL (Preact, not React): the live handler is `onInput`, NOT `onChange` — in
 * Preact `onChange` fires only on commit/blur, so a controlled slider wired to it
 * would appear frozen mid-drag. The `.gem-slider` class (src/index.css) draws a
 * visible white track + accent thumb for both engines. An optional `className` is
 * merged LAST; remaining native input attributes spread through `...rest`.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaLabel,
  ariaValueText,
  className,
  ...rest
}: SliderProps) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      // Preact: onInput fires per drag tick; onChange would only fire on commit (Pitfall 1).
      onInput={e => onChange(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
      className={cn('gem-slider', className)}
      {...rest}
    />
  );
}
