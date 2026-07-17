/**
 * STEP_META — the single source of truth for the 4-step wizard's labels, order,
 * and locked-step tooltip copy (D-02). The canvas-first shell's one-and-only
 * navigator (`StepBar`) and the `AtelierShell` top bar both read their step
 * labels/order from here — no inline label arrays anywhere else.
 *
 * Because labels + order live in exactly one place, the Phase 23 semantic remap
 * (e.g. renaming a step, reordering the journey) is a DATA edit to this array,
 * not another pass through the 2400-line App.tsx.
 *
 * `lockedTooltip` is the short static copy shown when a step is gated/unreachable
 * (D-12). Only Refine and Supplies gate on upstream data, so only they carry
 * tooltip copy; Upload is always reachable and Order has no dedicated copy.
 */
export interface StepMeta {
  /** 1-based step index, matching `WizardApi.step` / `canEnter` / `goTo`. */
  index: number;
  /** Visible step label (chrome copy). */
  label: string;
  /** Static tooltip shown while the step is locked, or null if it has none. */
  lockedTooltip: string | null;
}

export const STEP_META: readonly StepMeta[] = [
  { index: 1, label: 'Upload', lockedTooltip: null },
  { index: 2, label: 'Refine', lockedTooltip: 'Upload an image to unlock' },
  { index: 3, label: 'Supplies', lockedTooltip: 'Compute a match to unlock' },
  { index: 4, label: 'Order', lockedTooltip: null },
] as const;
