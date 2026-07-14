/**
 * RefineScreen — the canvas-first "Refine" keystone screen (step 2, REFINE-01/05).
 *
 * PURE / props-only (D-01): App.tsx stays the sole state owner; this component
 * owns no domain state and imports no engine module. This is the minimal
 * strangler shell introduced in 23-01 behind the `USE_NEW_REFINE` flag — the
 * full size/edge-cleanup/color-slider surface (D-03..D-06) lands in 23-03.
 */
export interface RefineScreenProps {}

export function RefineScreen(_props: RefineScreenProps) {
  return (
    <section data-screen="refine" className="text-muted text-sm">
      Refine screen (coming in 23-03)
    </section>
  );
}
