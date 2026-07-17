import type { ComponentProps } from 'preact';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'save' | 'ghost';

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'variant' | 'className'> {
  /** Visual treatment — token-driven, no consumer class soup needed. */
  variant?: ButtonVariant;
  /**
   * Extra utility classes, merged LAST via cn(). Narrowed to a plain string —
   * Preact's native `className` is `Signalish<string>`, which cn() (a plain
   * string join) does not accept; these primitives take literal classes only.
   */
  className?: string;
}

// Each variant maps to existing Atelier token utilities (src/index.css).
// `save` is the exact AtelierShell dark-pill recipe (bg-ink pill); radius uses
// the arbitrary value `rounded-[20px]` because --radius-pill is not exposed via
// @theme inline, so `rounded-pill` does not exist (Pitfall 2).
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  save: 'bg-ink text-on-accent rounded-[20px] px-5 py-2 uppercase tracking-wide font-bold hover:brightness-110',
  ghost: 'border border-border text-ink hover:bg-panel-2',
};

/**
 * Button — the shared token-driven action primitive (D-02 / SC1).
 *
 * PURE / props-only: it holds no internal state. The label is the consumer's
 * `children`; `variant` selects a token class set; an optional `className` is
 * merged LAST via cn(); and any remaining native button attributes (`onClick`,
 * `disabled`, `aria-*`, …) spread through `...rest` onto the element. Always
 * renders a native `<button type="button">` so it never submits a form.
 */
export function Button({ variant = 'primary', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'text-xs font-semibold rounded-[var(--radius-control)] px-3 py-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
