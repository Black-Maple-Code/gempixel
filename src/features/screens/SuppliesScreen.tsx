/**
 * SuppliesScreen — the canvas-first "Supplies" screen (step 3, SUPPLIES-01).
 *
 * PURE / props-only (D-01): App.tsx stays the sole state owner; this component
 * owns no domain state and imports no engine module. Every displayed figure is
 * computed in App and passed as a prop. This is the minimal strangler shell
 * introduced in 23-01 behind the `USE_NEW_SUPPLIES` flag — the full supply
 * table + order-summary surface (D-07) lands in 23-04.
 */
export interface SuppliesScreenProps {}

export function SuppliesScreen(_props: SuppliesScreenProps) {
  return (
    <section data-screen="supplies" className="text-muted text-sm">
      Supplies screen (coming in 23-04)
    </section>
  );
}
