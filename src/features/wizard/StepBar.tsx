import { STEP_META } from './stepMeta';

/**
 * StepBar — the single horizontal 4-step navigator (Upload · Refine · Supplies ·
 * Order) and the ONLY navigator in the canvas-first shell (SHELL-01, D-03).
 *
 * PURE / props-only (D-01): it reads step state entirely from props and owns
 * nothing — App.tsx stays the sole state owner. Labels/order come from the
 * single STEP_META map (D-02).
 *
 * D-12 gating/a11y contract:
 *  - current step  → filled green circle + number, bold ink label, aria-current="step"
 *  - completed step→ filled green circle + check, muted label, passed (green) connector
 *  - locked step   → outlined circle, muted label, container opacity .45,
 *                    aria-disabled="true", removed from tab order (tabIndex -1),
 *                    a short static tooltip, and a click that never navigates.
 */
export interface StepBarProps {
  /** Current 1-based step (from WizardApi.step). */
  step: number;
  /** Validity gate — is `target` reachable given current data (WizardApi.canEnter). */
  canEnter: (step: number) => boolean;
  /** Navigate to `target` (WizardApi.goTo). Never called for locked steps. */
  goTo: (step: number) => void;
}

export function StepBar({ step, canEnter, goTo }: StepBarProps) {
  return (
    <nav aria-label="Progress" className="flex items-center gap-1.5 @max-[640px]:min-w-0 @max-[640px]:overflow-x-auto">
      {STEP_META.map((meta, i) => {
        const isCurrent = step === meta.index;
        const isCompleted = meta.index < step;
        const isLocked = !isCompleted && !isCurrent && !canEnter(meta.index);
        // Connector leading INTO this step is "passed" (green) when the previous
        // step is completed, i.e. this step index is at most the current step.
        const connectorPassed = meta.index <= step;
        const tooltip = isLocked ? meta.lockedTooltip : null;

        return (
          <div key={meta.index} className="flex items-center gap-1.5">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`w-6 h-px @max-[640px]:hidden ${connectorPassed ? 'bg-accent' : ''}`}
                // Ahead-of-progress connector uses the handoff's fixed muted line
                // color; it has no semantic token (passed connectors use bg-accent).
                style={connectorPassed ? undefined : { backgroundColor: '#D8D0BC' }}
              />
            )}

            <span className={`tooltip-group relative ${isLocked ? 'opacity-45' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  if (!isLocked) goTo(meta.index);
                }}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={isLocked ? 'true' : undefined}
                tabIndex={isLocked ? -1 : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 @max-[640px]:px-2 rounded-md text-[11px] font-mono uppercase tracking-wider transition-all ${
                  isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${isCurrent ? 'text-ink font-bold' : 'text-muted'}`}
              >
                <span
                  aria-hidden="true"
                  className={`relative w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    isCompleted || isCurrent
                      ? 'bg-accent text-on-accent'
                      : 'border border-faint text-faint'
                  }`}
                >
                  {isCompleted ? '✓' : meta.index}
                </span>
                <span className="@max-[640px]:sr-only">{meta.label}</span>
              </button>

              {tooltip && (
                <span className="tooltip-box" role="tooltip">
                  {tooltip}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
