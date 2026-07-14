/**
 * OrderScreen — the canvas-first "Order" screen (step 4, ORDER-01).
 *
 * PURE / props-only (D-01): App.tsx stays the sole state owner; this component
 * owns no domain state and imports no engine module. This is the minimal
 * strangler shell introduced in 23-01 behind the `USE_NEW_ORDER` flag — the
 * full order-packet download + terminal confirm surface (D-08/D-09) lands in
 * 23-05.
 */
export interface OrderScreenProps {}

export function OrderScreen(_props: OrderScreenProps) {
  return (
    <section data-screen="order" className="text-muted text-sm">
      Order screen (coming in 23-05)
    </section>
  );
}
