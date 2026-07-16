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
  /** Save handler for the top-bar Save pill. */
  onSave: () => void;
  /** Whether Save is currently allowed (pill disabled when false). */
  canSave: boolean;
  /**
   * Fixed bottom action bar (Zone 3) — the relocated Back/Next footer. Rendered
   * in a `shrink-0 no-print` bar below the internally-scrolling content so it
   * stays hittable without page scroll no matter how long the step content is
   * (D-05 / SC9). Optional so the shell degrades gracefully if omitted.
   */
  bottomBar?: ComponentChildren;
  /**
   * In-flow canvas control strip for Zone 3 (Plan 25-07, GAP-1/SC8) — the
   * relocated view-mode switcher + zoom controls. Rendered as a `shrink-0
   * no-print` strip immediately ABOVE the `bottomBar` Back/Next bar, so Zone 2
   * (the canvas region) fills the remaining height and nothing floats over the
   * raster. Optional; supplied by App only on Refine (step 2).
   */
  canvasControls?: ComponentChildren;
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

export function AtelierShell({ children, step, canEnter, goTo, onSave, canSave, bottomBar, canvasControls }: AtelierShellProps) {
  return (
    // Fixed 3-zone shell (D-05): Zone 1 top step-bar (shrink-0) → Zone 2 the
    // internally-scrolling content (flex-1 min-h-0 overflow-y-auto — `min-h-0` is
    // the load-bearing detail that lets the scroll region shrink inside a flex
    // column) → Zone 3 the fixed bottom action bar (shrink-0). Long lists scroll
    // INSIDE Zone 2 while the step bar and the Back/Next stay pinned (SC9).
    <div className="@container flex flex-col h-dvh overflow-hidden print:h-auto print:overflow-visible">
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
        <StepBar step={step} canEnter={canEnter} goTo={goTo} />

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

      {/* Zone 2 — internally-scrolling content. `min-h-0` lets it shrink so the
          overflow scroll is bounded to this zone (never pushing Zone 3 off-screen).
          Print reveals the full content (the plain @media print path). */}
      <div className="flex-1 min-h-0 overflow-y-auto print:overflow-visible print:h-auto">
        {children}
      </div>

      {/* Zone 3a — in-flow canvas control strip (Plan 25-07). Sits above the
          Back/Next bar; both are `shrink-0`, so Zone 2 keeps filling the height. */}
      {canvasControls && (
        <div className="no-print shrink-0 border-t border-border bg-panel px-4 py-2">
          {canvasControls}
        </div>
      )}

      {/* Zone 3 — fixed bottom action bar (relocated Back/Next). `px-4 py-3`
          matches the header; `no-print` because the wizard chrome never prints. */}
      {bottomBar && (
        <div className="no-print shrink-0 border-t border-border bg-panel px-4 py-3">
          {bottomBar}
        </div>
      )}
    </div>
  );
}
