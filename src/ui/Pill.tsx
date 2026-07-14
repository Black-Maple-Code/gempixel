import type { ComponentProps } from 'preact';
import { cn } from './cn';

export type PillVariant = 'neutral' | 'ok' | 'tag';

export interface PillProps extends Omit<ComponentProps<'span'>, 'variant' | 'className'> {
  /** Visual treatment — token-driven display chip. */
  variant?: PillVariant;
  /**
   * Extra utility classes, merged LAST via cn(). Narrowed to a plain string —
   * Preact's native `className` is `Signalish<string>`, which cn() (a plain
   * string join) does not accept; these primitives take literal classes only.
   */
  className?: string;
}

// Token-driven chip recipes. `ok` uses the UI-SPEC accent-tint pairing (green
// text on the documented #EAF2EF handoff tint, applied as an arbitrary value —
// not a newly-defined token). Radius uses `rounded-[var(--radius-pill)]` because
// --radius-pill is not exposed via @theme inline, so `rounded-pill` does not
// exist (Pitfall 2).
const VARIANTS: Record<PillVariant, string> = {
  neutral: 'bg-panel-2 text-muted border border-border',
  ok: 'bg-[#EAF2EF] text-accent',
  tag: 'bg-panel-2 text-faint uppercase tracking-wider font-mono',
};

/**
 * Pill — the shared token-driven display chip (D-02 / SC1).
 *
 * PURE / props-only: it holds no internal state and renders a plain `<span>`
 * (a display badge, never interactive — an aria-pressed/toggle chip is a
 * Phase 23 concern). `variant` selects a token class set; an optional
 * `className` is merged LAST via cn(); remaining native span attributes spread
 * through `...rest`.
 */
export function Pill({ variant = 'neutral', className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-[var(--radius-pill)]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
