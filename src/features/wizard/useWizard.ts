import { useState, useCallback } from 'preact/hooks';

/**
 * useWizard — the 4-step wizard state machine: current step, validity, and
 * transitions. `canEnter` is the single source of truth for "is step N reachable
 * given the current data" (pure validity, no test bypass), replacing the
 * duplicated `isStepValid` checks scattered across the nav footer.
 *
 * The `isTestEnv` bypass is applied only where it was before — it lets `goTo`
 * (the dot navigation) jump anywhere in tests, but is intentionally NOT baked
 * into `canEnter`, because the mobile "Next" button's disabled state never had
 * the bypass (App.test asserts Next stays locked with no image, in jsdom).
 */

export interface WizardApi {
  step: number; // 1..4
  canEnter(step: number): boolean;
  next(): void;
  back(): void;
  goTo(step: number): void;
  reset(): void;
}

export function useWizard(deps: { hasImage: boolean; hasMatch: boolean; isTestEnv: boolean }): WizardApi {
  const { hasImage, hasMatch, isTestEnv } = deps;
  const [step, setStep] = useState(1);

  const canEnter = useCallback(
    (target: number): boolean => {
      if (target === 1) return true;
      if (target === 2) return hasImage;
      if (target === 3 || target === 4) return hasMatch;
      return false;
    },
    [hasImage, hasMatch]
  );

  const next = useCallback(() => setStep(s => Math.min(4, s + 1)), []);
  const back = useCallback(() => setStep(s => Math.max(1, s - 1)), []);
  const goTo = useCallback(
    (target: number) => {
      if (canEnter(target) || isTestEnv) setStep(target);
    },
    [canEnter, isTestEnv]
  );
  const reset = useCallback(() => setStep(1), []);

  return { step, canEnter, next, back, goTo, reset };
}
