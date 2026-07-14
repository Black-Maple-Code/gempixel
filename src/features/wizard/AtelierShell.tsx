import { ComponentChildren } from 'preact';
import { StepBar } from './StepBar';

/**
 * AtelierShell — the canvas-first shell's top-bar chrome: the green 3×3
 * pixel-logo tile + "GemPixel" wordmark (Newsreader) on the left, the single
 * StepBar navigator in the center, and the dark "Save" pill on the right. Its
 * `children` (the step panels + single-mount viewer, wired by App in Plan 04)
 * render below the bar.
 *
 * PURE / props-only (D-01): it owns no step state and makes no engine calls —
 * App.tsx stays the sole state owner. This seeds the minimal shell chrome in
 * `src/features/wizard/`; the formal shared `src/ui/` primitives are Phase 21.
 */
export interface AtelierShellProps {
  /** The shell body (step panels + viewer), supplied by App. */
  children: ComponentChildren;
  /** Current 1-based step (WizardApi.step) — passed straight to StepBar. */
  step: number;
  /** Validity gate (WizardApi.canEnter) — passed straight to StepBar. */
  canEnter: (step: number) => boolean;
  /** Navigate handler (WizardApi.goTo) — passed straight to StepBar. */
  goTo: (step: number) => void;
  /**
   * D-13 soft-invalidate: the earliest step index that is out of date after an
   * upstream edit, or null when nothing is stale. Passed straight to StepBar,
   * which renders the out-of-date marker on steps at/after this index.
   */
  stale?: number | null;
  /** Save handler for the top-bar Save pill. */
  onSave: () => void;
  /** Whether Save is currently allowed (pill disabled when false). */
  canSave: boolean;
}

// The 3×3 pixel-logo tile reuses the pure-CSS `.gem-logo` mark (src/index.css);
// the gem palette vars are theme-independent content colors.
const GEM_LOGO_CELLS = [
  '--gem-pink',
  '--gem-cyan',
  '--gem-violet',
  '--gem-amber',
  '--gem-pink',
  '--gem-cyan',
  '--gem-violet',
  '--gem-amber',
  '--gem-pink',
] as const;

export function AtelierShell({ children, step, canEnter, goTo, stale, onSave, canSave }: AtelierShellProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-panel no-print shrink-0">
        {/* Left: pixel-logo tile + Newsreader wordmark (21/600) */}
        <div className="flex items-center gap-3">
          <div className="gem-logo w-[38px] h-[38px] shrink-0" aria-hidden="true">
            {GEM_LOGO_CELLS.map((c, i) => (
              <span key={i} style={{ backgroundColor: `var(${c})` }} />
            ))}
          </div>
          <span className="font-display text-[21px] font-semibold text-ink leading-none">GemPixel</span>
        </div>

        {/* Center: the single navigator */}
        <StepBar step={step} canEnter={canEnter} goTo={goTo} stale={stale} />

        {/* Right: the one deliberate dark accent — Save pill
            (bg #1B1A17 = ink token, text #F4F1E9 = on-accent token). */}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="bg-ink text-on-accent rounded-[20px] px-5 py-2 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
        >
          Save
        </button>
      </header>

      {children}
    </div>
  );
}
