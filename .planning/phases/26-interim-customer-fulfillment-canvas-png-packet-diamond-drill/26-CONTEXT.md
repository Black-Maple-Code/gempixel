# Phase 26: Interim Customer Fulfillment — Canvas PNG Packet + Diamond Drills USA Order - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 26 re-homes the still-live **canvas-PNG export** (`engine/export.ts`) and the
**Diamond Drills USA drill-cart handoff** (`engine/checkout.ts` `compileShopifyCartLink`) out of
the legacy `Step3Canvas` and into the new v4.0 **Order** step, as **interim, 100%-client-side,
vendor-agnostic fulfillment** before the v5.0 backend/partnerships land. It then **completes the
strangler close** that Phase 25 deliberately left open: deleting `Step3Canvas`, the coupled
`slate-*` fulfillment modals, and the `flags.ts` module — reaching a single UI tree. (ORDER-04,
ORDER-05, SC1–SC5)

**In scope:**
- Order step downloads the canvas artwork as PNG(s): grid-only, grid+legend combined, and the
  legend on its own — using the existing `drawCanvasOnly` / `drawCombinedCanvasSheet` renderers
  plus one **additive** `drawLegendOnly` (see D-05).
- The PNGs + the existing ORDER-02 JSON spec/quote packet are delivered as **separate labeled
  downloads** (D-03).
- Order step hands the optimized drill order to Diamond Drills USA via `compileShopifyCartLink`,
  with cart bags reconciling exactly to the displayed legend/quote (D-01).
- The Order step composes these into **two grouped, honest task sections** — "get your canvas
  made" and "order your drills" — with per-task terminal states (D-07).
- **Strangler close (SC5):** delete `Step3Canvas.tsx`, its 3 re-homed handlers' legacy call site,
  the coupled `slate-*` fulfillment modals, and `flags.ts`; retarget the coupled tests; suite
  stays green. Folds in the WR-04 dark-slate/error-banner cleanup (D-08).

**Out of scope:**
- Any **existing** `engine/*` signature change — the two frozen renderers and `compileShopifyCartLink`
  are used as-is. (The single new **additive** `drawLegendOnly` export is the one sanctioned
  engine addition — see D-05; it does not touch a frozen signature.)
- Real payment, real lab/order submission, order numbers, receipts — deferred to v5.0 (D-06).
- The three non-fulfillment Phase-25 review todos (WR-02 debounce-cancel, WR-05 `isFitMode`,
  short-viewport Refine fit) — reviewed, **not** folded (see Deferred).
- New capabilities beyond ORDER-04/05 + the strangler close.

</domain>

<decisions>
## Implementation Decisions

### Drill-cart handoff placement (ORDER-05)
- **D-01:** **Order step only.** The single `compileShopifyCartLink` → `diamonddrillsusa.com/cart/`
  handoff lives on the Order step — the honest terminal where all outbound actions converge. One
  call site fed by the one `bagPlanner`/quote output **structurally guarantees** the cart can't
  diverge from the displayed legend/quote (SC3). SC3's "(or Supplies)" is permissive fallback
  wording, **not** a mandate to duplicate — a second live cart button on Supplies is explicitly
  rejected (divergence risk + duplicated-CTA confusion). If later UAT shows customers stop at
  Supplies, add a lightweight **"Continue to Order to buy drills →" pointer** on Supplies — never
  a second live cart button.

### Canvas PNG delivery (ORDER-04)
- **D-03:** **Separate labeled downloads.** Reuse `triggerCanvasDownload(canvas, filename)` as-is,
  once per artifact (grid PNG, grid+legend PNG, legend PNG, and the existing JSON spec packet) —
  zero new code, zero new dependency, ships the interim fast. Each file is independently named
  (`{baseName}-canvas.png`, `-grid-legend.png`, `-legend.png`).
  - **Known caveat (accept for interim):** multiple programmatic downloads trigger a one-time
    Chromium "Download multiple files?" permission prompt, and Safari/Firefox may drop rapid
    sequential downloads — space them with small awaits (the existing handlers are already `async`).
  - **Rejected:** hand-rolled store-only ZIP (~70 lines + CRC32 + round-trip test — over-engineering
    for an interim path) and `fflate` (breaks the standing zero-new-dependency rule). The store-only
    ZIP is noted as the clean "one canvas package" **upgrade** if the multi-file prompt proves
    annoying — deferred, not built now.

### Interim honesty (SC4)
- **D-06:** **Honest two-vendor, self-serve handoff — no payment, no receipt, no order number.**
  Consistent with the shipped ORDER-02 / D-09 terminal. The canvas artifacts go to the customer's
  chosen **canvas maker** (self-serve); the drill cart goes to **Diamond Drills USA** (external).
  GemPixel fulfills neither — the UI must not imply a single GemPixel-placed order or any charge.

### Standalone legend PNG (SC1 vs "no engine signature changes")
- **D-05:** **Additive `drawLegendOnly` renderer.** SC1's "using the existing renderers with no
  engine signature changes" is read as **"don't mutate the two Phase-22-frozen renderers"** — a
  **new additive export** is permitted. `drawLegendOnly` factors out the legend-draw loop already
  shared with `drawCombinedCanvasSheet` and returns an `HTMLCanvasElement` (same shape as the other
  two), downloaded via `triggerCanvasDownload`. This is artifact-free (unlike a UI-layer crop of the
  combined sheet, which is brittle — it re-derives 6 private layout constants and captures stray
  full-width folding-guide fragments across the legend band; **rejected**).
  - **Deviation note (call it out in PLAN):** this is the **one sanctioned engine addition** in an
    otherwise UI-focused phase. It does not change any existing signature, so it honors the strangler
    "engine signatures froze in Phase 22" invariant in spirit. If the planner/executor finds the
    shared-loop extraction would force a signature change on `drawCombinedCanvasSheet`, fall back to
    **two PNGs (grid, grid+legend) + the existing `printLegendSheetOnly` print path** and record the
    SC1 third-PNG trim explicitly — do **not** ship the brittle crop.

### Order-step handoff UX (SC4)
- **D-07:** **Two grouped task sections on the Order step**, each with its own honest sub-terminal:
  - **① "Get your canvas made"** — the locked spec + the PNG downloads + the JSON spec/quote packet
    (all canvas-maker artifacts). Honest done-state: **"downloaded ✓"** (the files are really on the
    user's disk).
  - **② "Order your drills"** — the Diamond Drills USA cart link (opens external in a new tab).
    Honest done-state: **"cart opened ↗ — finish your order on Diamond Drills USA"** — **never**
    "ordered" (GemPixel can't confirm an external cart).
  - **Retire the single `packetDownloaded` boolean** in favor of a small per-task state
    (e.g. `{ canvasDownloaded, cartOpened }`) so one flag never has to describe two outcomes with
    different confirmability. Retarget the OrderScreen terminal-state tests accordingly.
  - **Rejected:** a single "Download everything" bundle (implies one vendor destination — fights the
    two-vendor honesty of SC4) and the flat button list (the retired `Step3Canvas` "Order & Actions"
    stack — the exact pattern being removed).

### Strangler close & ownership (SC5)
- **D-02:** **Phase 26 owns the `Step3Canvas` deletion and the single-UI-tree close** (per Phase 25
  guardrail #11 / 25-CONTEXT D-01 deferral). Once the 3 handlers
  (`handleShopifyCheckout`, `handleDownloadCanvasOnly`, `handleDownloadCombinedCanvasSheet`) are
  re-homed as OrderScreen props (App stays the state owner — they move their *call site*, not their
  home), delete: `Step3Canvas.tsx`, panel-3's `USE_NEW_SUPPLIES ? SuppliesScreen : Step3Canvas`
  ternary → collapse to `SuppliesScreen` only, the coupled `slate-*` fulfillment modals (Artist
  Resources modal ~`App.tsx:1660`, Checkout Warning modal ~`App.tsx:1756`), and the **`flags.ts`
  module** (all four flags are `true` and the last legacy branch is gone). Retarget the
  `Step3Canvas`-coupled assertions in `App.test.tsx` / `integration.test.tsx` / `print.test.tsx`
  (mirror the Phase 23 aside test-retargeting precedent). Suite stays green at every commit.

### Folded Todos
- **D-08 — Retire remaining dark-slate modal + error-banner remnants (WR-04, `resolves_phase:26`).**
  From `25-REVIEW.md` (WR-04 warning + IN-04). Directly coupled to this phase's deletion: the
  **Checkout Warning modal** dies with the re-homed dormant checkout path; the **Artist Resources
  modal** is a `Step3Canvas`-era `slate-*` remnant; and the **frame-scope error banners**
  (`bg-slate-900/950` / `rose-950` / `text-white`, hoisted in 23-08) re-token to Atelier light as
  the download/checkout error path (`actionError`) moves to the Order step. The error banner is the
  **only user-visible** remnant (it can show on a real match/worker error), so it matters most.
  Grep-gate: no `bg-slate-9(00|50)` / `text-white` / `rose-950` left on any live surface.

### Claude's Discretion
- **`drawLegendOnly` internals** — exact shared-loop extraction, canvas sizing, and whether it takes
  the same options shape as `drawCombinedCanvasSheet` (D-05). Planner/executor's call, provided no
  existing signature changes.
- **Per-task state shape** — the exact fields/naming replacing `packetDownloaded` (D-07).
- **Download spacing** — the small await/delay between sequential `triggerCanvasDownload` calls to
  avoid dropped downloads (D-03).
- **Section-② cart affordance copy + the "cart opened ↗" sub-terminal wording** (D-07), within the
  honest-handoff constraint (D-06).
- **PNG filenames** — `{baseName}-legend.png` etc.; `baseName` reuses `saveProjectName.trim() ||
  'gempixel-layout'` as the existing handlers do.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone grounding
- `.planning/ROADMAP.md` §"Phase 26: Interim Customer Fulfillment — Canvas PNG Packet + Diamond
  Drills USA Order" — the goal, Success Criteria 1–5, and the Phase 24→25→26 coupling note.
- `.planning/ROADMAP.md` §"Phase 25" guardrail #11 + SC10 — why the fulfillment path was preserved
  and that Phase 26 owns its deletion.
- `.planning/REQUIREMENTS.md` — **ORDER-04** (canvas PNGs alongside the JSON packet) and
  **ORDER-05** (Diamond Drills USA cart) — the two requirements this phase closes; plus the v4.0
  boundary and the standing "browser-native, zero new deps" avoidance.
- `.planning/PROJECT.md` — v4.0 boundary (frontend-only, 100% client-side; fulfillment backend →
  v5.0) and the strangler discipline (App owns state, screens pure/props-only, engine signatures
  froze in Phase 22).

### Live targets (the edits this phase makes)
- `src/App.tsx` — the three fulfillment handlers to re-home: `handleDownloadCanvasOnly` (`:1003`),
  `handleDownloadCombinedCanvasSheet` (`:1027`), `handleShopifyCheckout` (`:1214`); the
  `Step3Canvas` import (`:19`) + render/props (`:1618–1642`); the coupled `slate-*` modals
  (Artist Resources ~`:1660`, Checkout Warning ~`:1756`) and the frame-scope error banners (WR-04,
  D-08); `printLegendSheetOnly` (`:1054`, the legend print fallback for D-05). Note the handlers use
  App state (`matchResult`, `activeCandidates`, `matchCols/Rows`, `symbolMap`, `leftLegendColors`,
  `rightLegendColors`, `saveProjectName`) — they stay in App and pass down as props (D-02).
- `src/engine/export.ts` — `drawCanvasOnly` (`:48`), `drawCombinedCanvasSheet` (`:99`),
  `triggerCanvasDownload` (`:260`), `FRAMER_MARGIN_CELLS` (`:22`). Add **additive** `drawLegendOnly`
  (D-05) — no existing signature changes. The full-width dashed folding-guides (~`:240–249`) are why
  a UI-layer crop of the combined sheet is brittle.
- `src/engine/checkout.ts` — `compileShopifyCartLink` (`:33`) — used as-is for the D-01 cart.
- `src/features/screens/OrderScreen.tsx` — the pure/props-only Order screen: retire the single
  `packetDownloaded` prop (`:65–66`) + terminal (`:257–277`) for the two-section, per-task-state
  model (D-07); add PNG-download + cart props.
- `src/features/screens/orderPacket.ts` — the existing JSON packet builder (`buildOrderPacket`) that
  section ① keeps; the PNGs deliver alongside it (D-03).
- `src/features/wizard/steps/Step3Canvas.tsx` — **delete** (D-02); its fulfillment UI (`:268–317`)
  is the reference for what re-homes.
- `src/features/screens/flags.ts` — **delete** this phase (D-02); the last legacy branch (panel 3)
  is gone.
- `src/features/screens/SuppliesScreen.tsx` — no cart wiring today; leave cart on Order (D-01),
  optional pointer only.

### Test retargeting (deletion blast radius)
- `src/__tests__/App.test.tsx`, `src/__tests__/integration.test.tsx`, `src/__tests__/print.test.tsx`
  — retarget/retire `Step3Canvas`-coupled assertions when it's deleted (mirror the Phase 23 aside
  precedent); **preserve** assertions that now exercise the re-homed Order fulfillment path.
- `src/features/screens/__tests__/` — OrderScreen tests: update terminal-state expectations for the
  per-task state (D-07).

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md`, `CONVENTIONS.md`, `STRUCTURE.md`, `TESTING.md` — the
  pure-engine/thin-UI split, naming, and the Vitest+jsdom baseline the retargeted tests extend.

### Prior-phase decisions carried in
- `.planning/phases/25-retire-legacy-steps-cleanup/25-CONTEXT.md` — D-01 (the `Step3Canvas`
  preservation + the explicit Phase-26 hand-off of its deletion), the four pure/props screens, and
  the App-owns-state / single-mount-viewer invariants.
- `.planning/phases/23-the-four-screens-in-flow-order/23-CONTEXT.md` — ORDER-01/02, the honest
  no-payment terminal (D-08/D-09), and the single-source `buildOrderQuote` the cart must reconcile to.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`handleDownloadCanvasOnly` / `handleDownloadCombinedCanvasSheet` / `handleShopifyCheckout`
  (`App.tsx:1003 / :1027 / :1214`)** — the three still-live handlers; re-home as OrderScreen props
  (call site moves, logic stays in App). Already `async` and already `setActionError`-guarded.
- **`triggerCanvasDownload(canvas, filename)` (`export.ts:260`)** — the Blob + object-URL + anchor
  download path; reused verbatim per PNG (D-03), no bundling.
- **`drawCombinedCanvasSheet` legend loop (`export.ts:99+`)** — the exact swatch/symbol/label render
  `drawLegendOnly` factors out (D-05).
- **`compileShopifyCartLink` (`checkout.ts:33`)** — builds the Diamond Drills USA permalink from the
  bag plan; single call site on Order (D-01) keeps cart == legend.
- **`OrderScreen` `onDownloadPacket` prop pattern (`OrderScreen.tsx:63`)** — the precedent for
  passing App-owned handlers into the pure screen; the new PNG/cart handlers follow it exactly.
- **`printLegendSheetOnly` (`App.tsx:1054`)** — the D-05 fallback if the additive renderer proves
  infeasible.

### Established Patterns
- **App owns state; screens pure/props-only** (P20 D-01) — every re-homed handler stays in App and
  is passed down; OrderScreen owns no domain state and does no cents math.
- **Engine signatures froze in Phase 22** — the two renderers + `compileShopifyCartLink` are used
  as-is; `drawLegendOnly` is the single sanctioned **additive** export (D-05), no existing signature
  touched.
- **Single-source quote / bag plan** — cart, legend, and quote all read one `bagPlanner`/`buildOrderQuote`
  output → structurally can't diverge (D-01).
- **Browser-native, zero new deps** (CLAUDE.md + pragmatic-fast profile) — no zip lib; separate
  downloads (D-03).
- **Strangler ships green every commit** — re-home (add) before delete; test-retargeting lands with
  the deletion (D-02).

### Integration Points
- `OrderScreen` ← new props: `onDownloadCanvasGrid`, `onDownloadGridLegend`, `onDownloadLegend`,
  `onCartCheckout`, and the per-task state replacing `packetDownloaded` (D-03/D-07).
- `App.tsx` panel 3 ← collapse `USE_NEW_SUPPLIES ? SuppliesScreen : Step3Canvas` to `SuppliesScreen`;
  delete `Step3Canvas` import + coupled modals + error-banner re-token (D-02/D-08).
- `engine/export.ts` ← add `drawLegendOnly` (D-05).
- `flags.ts` ← delete (D-02).

</code_context>

<specifics>
## Specific Ideas

- **"Two boxes to check"** — the Order terminal is genuinely two errands to two vendors: get your
  canvas made (download the art), and order your drills (the cart link). Make that the layout, don't
  smooth it into a false single order (D-07).
- **"Cart opened ↗, never ordered"** — GemPixel can't confirm an external cart, so the drill
  sub-terminal is honest about being a handoff, matching the no-receipt spirit of the shipped Order
  step (D-06/D-07).
- **"Reuse the exact renderers the old software used"** — the PNGs come from the identical
  `drawCanvasOnly` / `drawCombinedCanvasSheet` code the pre-v4.0 app shipped; this phase reconnects
  them, it doesn't reinvent them.
- **"Don't orphan the live feature, then close the strangler"** — re-home first, delete
  `Step3Canvas` + `flags.ts` + coupled modals after, single UI tree (D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Store-only ZIP "one canvas package" download** — the clean single-file upgrade over D-03's
  separate downloads, if the browser multi-file prompt proves annoying in use. Zero-dep (hand-rolled
  CRC32 store-only) — deliberately **not** built now (over-engineering for an interim path).
- **"Continue to Order to buy drills →" pointer on Supplies** — only if UAT shows customers treat
  Supplies as their stopping point (D-01). A pointer, never a second live cart button.
- **Richer finish/canvas visualization proof on Order (ORDER-03)** — v4.x follow-on, already deferred
  in REQUIREMENTS.
- **v5.0 fulfillment backend** — real payment, lab submission (Lumaprints), server-side render, asset
  storage, shipment tracking, sourcing — the whole reason this phase is labeled *interim*.

### Reviewed Todos (not folded)
- **Cancel debounced custom-size recompute timer on select/reset/load (WR-02)** — a Refine-screen
  bug, outside Phase 26's fulfillment domain. Left deferred.
- **Consume or remove unused viewer `isFitMode` API (WR-05)** — `viewer.ts` cleanup, outside
  fulfillment domain. Left deferred.
- **Tighten Refine canvas fit at short viewports** — Refine layout tweak, outside fulfillment domain.
  Left deferred.

</deferred>

---

*Phase: 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill*
*Context gathered: 2026-07-16*
