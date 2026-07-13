# Pitfalls Research

**Domain:** High-fidelity UI/UX redesign recreated in an existing client-side Preact/Vite/Tailwind-v4 diamond-art planner (v4.0 Canvas-First Redesign — frontend-only)
**Researched:** 2026-07-13
**Confidence:** HIGH (grounded in the shipped code — `App.tsx`, `engine/money.ts`, `engine/bagPlanner.ts`, `engine/viewer.ts`, `engine/matcher.worker.ts`, `engine/checkout.ts` — plus the design handoff README and the v2.1/v3.0 retrospectives)

> **Scope note.** These are pitfalls specific to redesigning **this** app. The #1 stated developer frustration is **regression** ("do not re-introduce removed patterns/deps; do not break existing behavior"). The engine (`planOrderSupply`, `money.ts`, `matcher.worker`, `viewer.ts`) and the 240+ Vitest baseline are load-bearing and must stay green at every step. Phase names below are topic-tags for the not-yet-built v4.0 roadmap: **A** Design System & App Shell · **B** Upload · **C** Refine (size cards + edge cleanup + color-count merge) · **D** Supplies · **E** Order (confirm/handoff) · **F** Mobile. Quoting accuracy is cross-cutting (C+D).

---

## Critical Pitfalls

### Pitfall 1: Big-bang rewrite of the 2,449-line `App.tsx` breaks the engine wiring and the app never ships green

**What goes wrong:**
The redesign retires the sidebars (`leftPanelCollapsed`/`rightPanelCollapsed`), the page-flip wizard, the preset/unit sizing system, and the dark-mode toggle — all tangled into one 2,449-line `App.tsx`. Rewriting it wholesale detaches the parts that must NOT change: the `useDiamondArtMatch` worker hook, the `CanvasViewer` init/sync effects (lines 517–562), `planOrderSupply(matchResult.counts, ...)` (line 991), and the symbol allocation. The suite goes red in bulk, the app half-works for many commits, and regressions (the developer's top frustration) slip in unseen.

**Why it happens:**
The UI and the engine wiring live in the same component. A "recreate the design faithfully" mandate invites starting from the mock's markup rather than from the existing state graph. History shows the risk is real: v3.0 force-closed at 40% partly because two big UI reworks were attempted at once.

**How to avoid:**
Strangler-fig, not rewrite. Keep `engine/*` untouched. Sequence so the app ships green at each step:
1. **Phase A first — new shell around the OLD body.** Build the Atelier app-shell (top bar + horizontal step nav) and mount the *existing* viewer/legend/supply UI inside it unchanged. Retire the sidebars/dark-toggle chrome only; behavior identical.
2. **Then replace one step's body at a time** (Upload → Refine → Supplies → Order), each landing green with its own tests, reusing the same `matchResult`/`planOrderSupply`/`CanvasViewer` seams the old UI used.
3. **Never touch `engine/*` signatures** in a UI phase; if the engine must change (e.g. cols→inches density, see Pitfall 3), do it in its own commit with its own tests *before* the UI depends on it.
4. Extract sub-components out of `App.tsx` as you go, but move logic verbatim (the v2.1 lesson: "reuse established seams — a clean relocation, not a rewrite").

**Warning signs:**
`git diff` touches `engine/*` and UI in the same commit; more than one step's body in flight; `npm test` red for more than one commit; `matchResult`/`priceDb`/`counts` being re-derived in a new component instead of threaded from the existing source.

**Phase to address:** A (shell-first), enforced across B–F.

---

### Pitfall 2: The Grid/Symbol/Photo view switcher and canvas zoom/pan silently regress

**What goes wrong:**
Today the near-instant view switch is a single `viewerRef.current.setViewMode(mode)` call on a persistent `CanvasViewer` (`viewportMode: 'grid'|'symbols'|'reference'`, App.tsx line 544) — it just re-`draw()`s from the already-built offscreen buffer. A redesign that remounts the canvas per step, recreates `CanvasViewer` on every render, or drops the `image | matchResult` init guard (lines 517–533) will: (a) rebuild the offscreen buffer on every switch (the <1ms toggle becomes a visible stall), (b) lose zoom/pan state across steps, or (c) leak viewers by skipping `destroy()`.

**Why it happens:**
The viewer is imperative (a class holding `scale`/`offsetX`/`offsetY` + a double-buffered offscreen canvas) inside a declarative Preact tree. Moving the `<canvas>` into a new step component re-runs the init effect and can re-instantiate the class, discarding `getViewportState()`.

**How to avoid:**
- Keep exactly ONE `CanvasViewer` instance for the whole session; mount its `<canvas>` once in the shell/Refine area and keep it mounted across steps (Refine and Supplies both show the chart — reuse, don't remount).
- Preserve the init/sync effect structure: create-once guarded by `!viewerRef.current`, `destroy()` on unmount only, `setData/setViewMode/setSymbolMap` for updates.
- Preserve zoom/pan across step navigation via `getViewportState()`/`setViewportState()` (already exists) rather than letting a remount reset it.
- Add a test/assert that switching `viewportMode` does NOT call `redrawOffscreen()` (only `draw()`), locking the <1ms invariant.

**Warning signs:**
Frame stutter on view toggle; zoom resets when moving between Refine and Supplies; multiple `pointerdown` listeners firing (leaked viewers); `new CanvasViewer(...)` in a component that re-renders.

**Phase to address:** A (mount the viewer once in the shell), verified in C and D.

---

### Pitfall 3: Copying the mock's illustrative size/inch numbers ships a quote that contradicts the engine's real density

**What goes wrong:**
The design's size cards read `Small 18×12 in / 60×40`, `Medium 24×16 in / 80×53 / 4,240 drills`, `Large 30×20 in / 100×66`. **These inches are fantasy for this engine.** The app's density is 10 dots/inch (2.5 mm): `calculateCanvasCost(..., 'grid')` divides grid by 10 (checkout.ts line 184) and `sizingAdviceData` does `cols/10` inches (App.tsx line 265). So an 80×53 grid is **8 × 5.3 in**, not 24×16. (The drill count 4,240 = 80×53 IS correct; only the inch label is wrong.) If the "24×16 in" label is hard-coded from the mock while the price is computed from the real 8×5.3-in area, **the card shows a size its own quote disagrees with**, and the A4 "Canvas print · 24×16 in" line, the proof badge, and the Lumaprints spec all inherit a size the canvas was never priced or rendered at.

**Why it happens:**
The handoff explicitly says all numbers are "illustrative mock data — wire it to real sources," but high-fidelity mocks are seductive; the specific "24×16 in / 80×53" pairing looks authoritative and gets typed in as a constant.

**How to avoid:**
- **Derive every inch/drill figure from the grid dims through one shared helper**, never a literal. Reuse the existing `cols/10` mapping (or make the density a single named constant and decide it deliberately — see below).
- **Resolve the density decision explicitly in the roadmap:** either (a) keep 10 dots/inch and recompute the size cards (60×40 → 6×4 in, 80×53 → 8×5.3 in, 100×66 → 10×6.6 in), or (b) if 24×16-in physical canvases are actually the product, the grid-per-inch density and `calculateCanvasCost` must change first (its own engine phase + tests) — you cannot show 24×16 in and price 8×5.3 in.
- Assert in a test that the size shown on the card == the size fed to `calculateCanvasCost` == the size on the A4 spec/proof badge, for all three cards.

**Warning signs:**
The string `24 × 16` (or `18×12`, `30×20`) appears as a literal anywhere; the proof badge size differs from `Math.round(cols/10)`; canvas price doesn't move when you change size cards; two places compute inches with different divisors.

**Phase to address:** C (size cards) with the density decision made *before* C; verified end-to-end in D and E.

---

### Pitfall 4: The color-count "merge" slider is non-deterministic, visibly changes the picture, or de-syncs the legend/cart/quote

**What goes wrong:**
The Refine slider is meant to merge rare one-off drills into an already-used near-identical shade with **no visible change**. Five ways it breaks:
- **Non-determinism:** picking the "nearest used shade" without a strict tie-break (like `bagPlanner`'s and the legend's `frequency desc, then localeCompare`) makes the merge order jitter between renders — the same slider value yields different pictures.
- **Visible change:** merging a rare color into a shade that isn't actually near (no ΔE ceiling) recolors visible regions, breaking the "no visible change" promise.
- **De-sync:** the merge changes `matchResult.counts`, `matchResult.matches` (grid cells), the symbol map, the legend, `planOrderSupply(...)` (line 991), and the cart items (line 1127). If any surface reads pre-merge counts, the legend/quote/cart disagree — the exact divergence the shared `planOrderSupply` aggregator exists to prevent.
- **Dye-lot interaction:** folding counts together can push a color across the 800 dye-lot ceiling or change its bag math (`packColor`); the merge must recompute supply, not patch counts in place.
- **Cart handles:** the merged-away DMC code must not still emit a cart token / symbol.

**Why it happens:**
Merging feels like a cheap post-process, so it's tempting to mutate a copy of `counts` in the UI and forget one of the five downstream consumers.

**How to avoid:**
- Implement the merge as a **pure function** `mergeRareColors(matches, counts, candidates, targetColorCount) → { matches, counts }` in `engine/` with its own tests (deterministic, ΔE-guarded). Reuse `color.ts` CIEDE2000 to choose the nearest *used* shade; refuse (or cap) merges above a ΔE threshold so "no visible change" is enforced, not hoped.
- Tie-break exactly like the existing legend/symbol allocation: merge the **least-frequent** codes first, target the nearest **most-used** shade, `localeCompare` on ties.
- Feed the merged result through the SAME single path everything else uses: rebuild `matches`+`counts` → `viewer.setData` → `planOrderSupply(counts,...)` → legend/cart. Never fork.
- After a merge, re-run `planOrderSupply` (don't hand-edit bag counts) so dye-lot/overshoot rules re-apply.

**Warning signs:**
Same slider value renders different grids; a merged code still appears in the legend/cart; `planOrderSupply` called with a `counts` object other than the merged one; ΔE not checked; picture visibly shifts when lowering the slider.

**Phase to address:** C.

---

### Pitfall 5: The color-count slider max doesn't track the REAL detected count, or the "N of M matched" label is off by one

**What goes wrong:**
The header reads "COLOR COUNT · 24 of 26 matched", slider floor 8 → max 26. The **max must equal the real distinct-color count of the current match** — `Object.keys(matchResult.counts).length` (the app already derives `used` this way at App.tsx line 484). Complex photos routinely map to 24+ colors. Failure modes: hard-coding max=26 (mock leak) so a 40-color photo can't be seen or a 12-color one has dead slider travel; computing max from the palette size (100/200) instead of used colors; and the "N of M" ambiguity — M is the **detected** distinct colors (=`Object.keys(counts).length`), N is the **kept-after-merge** count (the slider value). Confusing "matched against palette" (always ~100/200 candidates) with "distinct colors actually used" produces an off-by-one or a wildly wrong denominator.

**Why it happens:**
"26" is a concrete-looking number in the mock; and there are two plausible meanings of "matched" (palette candidates vs. distinct used codes), so the label gets wired to the wrong one.

**How to avoid:**
- Single source of truth: `detectedCount = Object.keys(matchResult.counts).length`; `sliderMax = detectedCount`; `sliderValue = keptCount` (distinct codes after the merge at the current value). Label: `"{keptCount} of {detectedCount} matched"`.
- Clamp `sliderValue ∈ [floor, detectedCount]`; recompute max on every new match (size change, edge-cleanup change, palette/kit change) — it is not a constant.
- Re-derive from `counts` each time; never persist a stale max across a re-match.

**Warning signs:**
Slider max is a literal (26/100/200); denominator equals the kit size (100/200) not the used-color count; label denominator doesn't change when you switch photos; slider lets you exceed the detected count.

**Phase to address:** C.

---

### Pitfall 6: The quote drifts from the Supplies numbers or double-rounds because canvas/shipping/tax bypass `money.ts`

**What goes wrong:**
`money.ts` is the canonical integer-cents authority and its docstring explicitly says it **supersedes** `Math.round(x*100)/100`. But `calculateCanvasCost` still returns floats rounded with the banned naive form (checkout.ts lines 203/213/217), and `canvasBaseCost`/`canvasShippingEstimate`/`drillPacketCost` live in `useState` as float dollars (App.tsx 209–211). If the Order/Supplies total is summed as `canvas + shipping + tax + drills` in floats — or each piece is rounded then re-rounded — the grand total can disagree with the itemized lines by a cent, and the Supplies "Est. total" can differ from the Order "Total today". The drill side already reconciles through `planOrderSupply` in integer cents; the canvas/shipping/tax side does not.

**Why it happens:**
The v3.0 money work hardened the drill/bag path; the canvas cost predates it and was never routed through `money.ts`. Adding a new quote panel that re-sums dollars is the path of least resistance.

**How to avoid:**
- Build ONE `computeQuote()` that takes `{ optimizedCostCents from planOrderSupply, canvas$, shipping$, tax$ }`, runs every non-cents input through `toCents`/`sanitizeMoney`, sums with `sumCents`, and returns integer cents + a `formatUSD` string. Every surface (Supplies summary, Order price card, proof) reads that one result.
- `sanitizeMoney` every editable price before `toCents` (guards `1e999` → `Infinity` white-screen, CR-01 from v3.0).
- Assert the Supplies "Est. total" cents === the Order "Total today" cents === `sumCents(line items)` in a test.
- Consider routing `calculateCanvasCost`'s final rounding through `money.ts` too, so no naive `Math.round(x*100)/100` remains in the money path.

**Warning signs:**
Any `* 100`, `.toFixed(2)` arithmetic, or `Math.round(x*100)/100` in the quote path; the two totals differ by a cent; a `+` on dollar floats feeding a displayed total; canvas cost not passed through `toCents`.

**Phase to address:** D (Supplies total) and E (Order total) built on one shared `computeQuote`.

---

### Pitfall 7: Presenting shipping/tax estimates as exact, and stale curated vendor rates going out of date silently

**What goes wrong:**
The mock shows "Shipping $9.00" and "Tax — calculated next", "Total today $57.00". With no backend this milestone, there is no real tax calc and no live carrier rate — shipping comes from the curated `VENDOR_REGISTRY[...].baseShipping` (4.99/5.50) and canvas from static `pricingPoints`. Showing "Tax — calculated next" implies a next step that will finalize it (there is none), and a hard "$57.00" reads as a committed price. The curated rates (and Lumaprints/FinerWorks price points) will drift from reality over time with no signal.

**Why it happens:**
The mock was drawn assuming Storyboard C's backend + live vendor APIs (explicitly deferred to v5.0). Recreating it verbatim imports promises the client-side build can't keep.

**How to avoid:**
- Label estimates as estimates: "Est. shipping", "Est. tax" (or omit tax and say "Tax calculated at checkout" only if an actual later checkout exists — it doesn't here, so say "estimated"). The grand total is "Estimated total", not "Total today".
- Add a dated provenance constant for the curated rates (e.g. `RATES_AS_OF = '2026-07'`) surfaced as a small "rates as of …" caption, so staleness is visible and reviewable rather than silent.
- Keep the vendor union narrow and guarded (the v3.0 `null`-not-$0 rule) so a bad rate can't become a free canvas.

**Warning signs:**
UI copy says "Total today"/"calculated next"/"you will be charged"; no "estimate" qualifier; no as-of date on curated rates; a reviewer can't tell when the price table was last checked.

**Phase to address:** D (estimate labeling) and E; provenance constant in the quoting/cross-cutting work.

---

### Pitfall 8: A "Place order · $57.00" button that can't charge or submit — implying a completed purchase

**What goes wrong:**
The mock's A4/B4 primary action is "Place order · $57.00" with "Billed by GemPixel · printed & shipped by our lab". Payments and the Lumaprints submission are **deferred to v5.0** — there is no charge, no lab submit, no order record server-side. Shipping a button that says "Place order" and shows a confirmation screen makes the customer believe they bought a canvas. That is a trust/legal problem (implied transaction, no fulfillment) far worse than an ugly UI.

**Why it happens:**
The redesign's whole point is fidelity to the mock, and the mock depicts a real checkout. "It's just a button" hides that the semantics are a lie without a backend.

**How to avoid:**
- Reframe the action truthfully for a client-side confirm/handoff: e.g. "Review & request canvas", "Save order summary", "Continue to lab" (deep-link/handoff), or "Copy order details" — never "Place order"/"Pay".
- The result screen is a **summary/handoff**, not a receipt: no order number that implies a captured payment, no "Payment captured" timeline (that's Storyboard C / v5.0). If it hands off, hand off to the real vendor upload page (`VENDOR_REGISTRY[...].uploadUrl` already exists) and/or export the spec.
- Show the estimated total clearly as an estimate (Pitfall 7), and state plainly that no payment is taken yet.
- Keep the auto-filled locked spec (Rolled Canvas, size, finish) — that part is honest and valuable; only the "buy now" semantics must change.

**Warning signs:**
Button copy contains "Place order", "Pay", "$X.XX" as a call-to-purchase; a post-click "order confirmed / payment captured" state; a generated order id presented as a purchase; no wording that a human/next step completes fulfillment.

**Phase to address:** E.

---

### Pitfall 9: Dark mode isn't fully retired — leftover `theme` state, persisted key, and `[data-theme]` CSS

**What goes wrong:**
Dark mode here is **not** Tailwind `dark:` classes (there are **zero** `dark:` occurrences in `src/`). It's a `theme: 'dark'|'light'` `usePersistentState` at key `gempixel_theme` (App.tsx 163), applied via `document.documentElement.dataset.theme = theme` (line 167), a toggle button (1439–1449), `[data-theme="dark"]` CSS blocks + CSS variables, and the viewer effect that reads `--drill-round-backing`/`--canvas-gap` on `theme` change (556–562). "Retiring dark mode" by only deleting the toggle button leaves: a persisted `gempixel_theme:'dark'` that still flips `data-theme` for returning users, orphaned `[data-theme="dark"]` CSS, and a dead `theme` dependency in the viewer effect.

**Why it happens:**
People assume "retire dark mode" = remove `dark:` utilities. This codebase's mechanism is different, so the obvious grep finds nothing and the real machinery is missed.

**How to avoid:**
- Remove the `theme` state + toggle + the `dataset.theme` effect; hard-set the Atelier light tokens as the only `:root` values.
- Delete `[data-theme="dark"]` CSS blocks and drop `theme` from the viewer effect deps; push the light `--drill-round-backing`/`--canvas-gap` values unconditionally.
- Handle the persisted key: either delete/ignore `gempixel_theme` on load or migrate it away, so a user who last saved `'dark'` doesn't resurrect a half-dark UI.

**Warning signs:**
A returning user (localStorage `gempixel_theme:"dark"`) still sees dark surfaces; `[data-theme=` remains in CSS; `theme`/`setTheme` still referenced; canvas backing colors don't match the Atelier light tokens.

**Phase to address:** A.

---

### Pitfall 10: Canvas zoom is dead on mobile (wheel-only) and the page scrolls instead of panning

**What goes wrong:**
`CanvasViewer` zoom is **wheel-only** (`handleWheel`, viewer.ts 113–122) — there is **no pinch/touch zoom** (grep: no `touch`, no pinch, no `getTouches`). On a phone there's no wheel, so the customer cannot zoom the chart at all. Pan uses Pointer Events (works for one finger), but there's **no `touch-action: none`** on the canvas (grep: zero occurrences), so a drag scrolls/zooms the page instead of panning the chart, and the browser may hijack the gesture.

**Why it happens:**
The viewer was built desktop-first (mouse wheel + pointer drag) and the test env stubs pointer capture; touch was never exercised. Storyboard B (mobile) is new scope.

**How to avoid:**
- Add pinch-to-zoom: track two active pointers in the existing pointer handlers and map their distance delta to `handleZoom` (reuse the cursor-anchored math; no new dependency — consistent with the "no panzoom lib" architectural avoidance).
- Set `touch-action: none` (CSS or `style.touchAction`) on the canvas so pan/zoom gestures don't scroll the page.
- Provide on-screen zoom controls (the existing `zoomIn/zoomOut/resetZoom` methods) as a touch fallback, so zoom works even before pinch lands.
- Test on a real 300px-wide viewport, not just DevTools.

**Warning signs:**
Can't zoom on a phone; dragging the chart scrolls the page; two-finger gesture zooms the whole page; `touch-action` absent on the canvas element.

**Phase to address:** F (with the pinch/`touch-action` work; expose `zoomIn/out` in the mobile UI).

---

### Pitfall 11: Inline (non-drawer) controls overflow the 300px portrait phone

**What goes wrong:**
The design mandate is "everything inline, never in a drawer" on a 300×620 phone. The Refine rail (size cards with dimensions + mono grid size + drill count on the right), the 4-segment edge-cleanup control, the color-count slider with its long caption, and the Supplies table (`symbol · swatch · DMC · drills+10% · bags`, "N×200" mono) are dense. Recreated as-is they overflow horizontally at 300px: the 4-segment control wraps or clips, the supply table's 5 columns don't fit, and mono number columns get truncated.

**Why it happens:**
The desktop rail is 360px and the supply table assumes desktop width; "inline, no drawer" removes the escape hatch of hiding overflow in a panel.

**How to avoid:**
- Portrait = single stacked column; reflow the rail sections vertically (already the mobile intent), full-width controls.
- Convert the Supplies table to stacked rows/cards on narrow widths (swatch+symbol+code on one line, drills/bags below) rather than a 5-col table; keep mono alignment within each card.
- Verify the 4-segment control and size cards at exactly 300px (min target) — no horizontal scroll, no clipped labels.
- Keep the step nav as the only navigator (no hamburger), per the design.

**Warning signs:**
Horizontal scrollbar at 300px; clipped/overlapping labels (the profile's explicit "avoid overlapping states" directive); the supply table forcing a min-width; a drawer sneaking back in to hide overflow.

**Phase to address:** F.

---

### Pitfall 12: Re-running the matcher/worker on every slider tick or edge-cleanup change janks the UI

**What goes wrong:**
Refine is "live": changing size, edge cleanup, or color count updates the preview. Size change legitimately needs a re-match (new grid dims → worker run). But edge-cleanup and color-count merge should NOT trigger a full CIEDE2000 re-match on every tick — that's the heavy worker path (`matcher.worker.ts`). Firing a re-match on each `input` event floods the worker; even though the worker supersedes stale runs via `currentRunId`, the UI thrashes and the chart flickers. Re-rendering the legend/quote chart on every tick compounds it.

**Why it happens:**
Binding `oninput` directly to a state that a `useEffect` re-matches on is the obvious wiring; the distinction between "needs a re-match" (size) and "post-processes the existing match" (merge) is easy to miss.

**How to avoid:**
- Color-count merge is a **post-process on the existing `matchResult`** (Pitfall 4), not a re-match — recompute merge + `planOrderSupply` from the already-matched `counts`, no worker round-trip.
- Debounce the slider (commit on `change`/idle, ~150–250ms) so drag doesn't spam recomputes; show the live handle value immediately but recompute on settle.
- Edge cleanup (`smoothing.ts`): if it must re-run matching, debounce and rely on the worker's `currentRunId` supersede (already built) so only the final level renders.
- Memoize `planOrderSupply` on `counts` identity so the legend/quote don't recompute unless counts actually change.

**Warning signs:**
Chart flickers while dragging the slider; the worker `progress` events fire repeatedly during a drag; frame drops on edge-cleanup change; `planOrderSupply` recomputing on unrelated re-renders.

**Phase to address:** C.

---

### Pitfall 13: Google Fonts (Newsreader/Pixelify Sans/Archivo/JetBrains Mono) cause FOUT/CLS and layout shift

**What goes wrong:**
The Atelier system specifies four families. Loading them naively (blocking `@import` or default swap without metrics) causes FOUT and cumulative layout shift as serif/mono headings reflow — especially the mono number columns (JetBrains Mono) in the supply table and the large Newsreader titles, which shift alignment when the webfont swaps in. The current codebase uses `'Outfit'` for canvas symbols (viewer.ts 392) — a font not in the new system, which will silently fall back.

**Why it happens:**
Fonts are treated as a CSS afterthought; the mock assumes the fonts are present.

**How to avoid:**
- Self-host or `<link rel="preconnect">`+`preload` the four families with `font-display: swap` and set fallback metrics (size-adjust / fallback stack) so swap doesn't shift layout.
- Subset to the weights actually used (600–700 display, regular body, mono).
- Reconcile the canvas symbol font: `viewer.ts` hard-codes `'Outfit'` — either add Outfit to the system or switch the symbol font to JetBrains Mono/Pixelify and re-run the glyph legibility audit (the grid-symbol redesign from 2026-07-13 assumed monochrome BMP glyphs).
- Measure CLS on the Refine/Supplies screens where mono numbers and serif titles dominate.

**Warning signs:**
Titles/numbers reflow ~100ms after load; CLS > 0.1; the canvas symbols render in a different font than the DOM; blocking font `@import` at the top of CSS.

**Phase to address:** A (font loading + token wiring); symbol-font reconciliation in A or C.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-code the mock's "24×16 in / 80×53" size labels | Pixel-match the mock fast | Quote/proof/spec disagree with the priced size; silent customer-facing error (Pitfall 3) | **Never** — always derive from grid dims |
| Re-derive `counts`/`priceDb`/quote in the new step components | Decoupled components | Legend/cart/quote diverge; defeats the shared `planOrderSupply` guarantee | Never — thread the one source |
| Delete only the dark-mode toggle button | Looks retired in the UI | Persisted `gempixel_theme:'dark'` + `[data-theme]` CSS resurrect it for returning users (Pitfall 9) | Never — remove state+key+CSS together |
| Sum the quote in float dollars | One less helper | Cent drift between Supplies and Order totals (Pitfall 6) | Never — route through `money.ts` |
| Skip pinch-zoom, ship pan-only on mobile | Faster mobile milestone | Customers can't inspect the chart on a phone (Pitfall 10) | Only if on-screen zoom buttons cover it; pinch still owed |
| Re-match on every slider/edge tick | Simplest wiring | Worker thrash + flicker (Pitfall 12) | Never for the merge (post-process); debounce for edge cleanup |
| Keep the retired sidebar/preset/`drillBagSize` state "just in case" | Avoids touching `App.tsx` | Dead state confuses the strangler; regressions hide in unused branches | Only transiently during Phase A; remove before milestone close |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `planOrderSupply` (drill supply/quote engine) | Passing a hand-mutated `counts` after a merge, or a different `counts` than the legend uses | Feed the single merged `counts` to `viewer.setData`, legend, cart, AND `planOrderSupply` from one path |
| `calculateCanvasCost` (checkout.ts) | Treating its `null` return as `0`; feeding it "grid" dims while labeling inches wrong | Keep the `null`-not-$0 guard; derive the displayed inches from the same dims it prices |
| `money.ts` | Summing canvas/shipping/tax as floats alongside the cents-based drill total | `sanitizeMoney`→`toCents`→`sumCents` for every input in one `computeQuote` |
| Lumaprints / FinerWorks | Recreating the mock's live "submit to lab" / "payment captured" flow | v4.0 has no backend — handoff via `uploadUrl` / export only; submission is v5.0 |
| `CanvasViewer` | Recreating the class per step / per render; forgetting `destroy()` | One instance for the session; `setViewMode`/`setData` for updates; `destroy()` on unmount only |
| `matcher.worker` | Firing a match per slider tick | Merge is a post-process; debounce size/edge changes; rely on `currentRunId` supersede |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| View switch rebuilds the offscreen buffer | Stutter toggling Grid/Symbol/Photo | `setViewMode`→`draw()` only, never `redrawOffscreen()` | Large grids (100×66+) |
| Re-match on every slider tick | Chart flicker, repeated worker `progress` | Post-process merge; debounce; memoize `planOrderSupply` | Any live drag on complex photos (24+ colors) |
| Full-grid redraw on highlight/legend hover | Lag hovering legend rows | Existing viewport-clipped highlight path (viewer.ts 330–357) — keep it | Big grids |
| Font swap reflow | Layout shift ~100ms post-load | `font-display: swap` + fallback metrics + preload | First paint, esp. mono tables |
| Symbol overlay drawn every frame at low zoom | Wasted work below the 10px cell threshold | Keep the `scaledCellSize >= 10` guard (viewer.ts 370) | Zoomed-out large grids |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Implying a completed purchase with no backend | Trust/consumer-protection problem — customer thinks they paid (Pitfall 8) | Truthful confirm/handoff copy; no "Payment captured" state; explicit "no payment taken" |
| Presenting estimates as exact prices | Customer disputes a "quoted" price that was never a real charge | Label "Estimated total"; dated curated rates (Pitfall 7) |
| Trusting persisted/edited prices into `toCents` | `Infinity`/NaN white-screen (v3.0 CR-01) | `sanitizeMoney` before `toCents` on every editable price |
| Unvalidated partner/vendor URL in a handoff link | Open-redirect / phishing vector (the still-deferred SEC-01) | http/https allowlist on any outbound canvas/vendor URL before navigating |
| User photo assumptions | (Privacy invariant) image must never leave the client | Keep all decode/match client-side — no upload, per the core constraint |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Lowering merges — no visible change" but the picture visibly changes | Broken promise; distrust of the tool | ΔE-guarded merge; refuse merges above threshold (Pitfall 4) |
| Slider max not tracking detected colors | Dead travel or can't reduce enough on a 40-color photo | `max = distinct used colors` (Pitfall 5) |
| "24×16 in" card that prices as 8×5.3 in | Customer orders the wrong physical size | Derive inches from grid (Pitfall 3) |
| Losing zoom/pan when moving between steps | Re-inspecting the chart from scratch each step | Persist viewport across steps (Pitfall 2) |
| Overlapping/clipped controls at 300px | Unusable mobile (profile: "avoid overlapping states") | Stacked cards, full-width controls (Pitfall 11) |
| "Place order" that does nothing | Confusion / perceived scam | Confirm/handoff semantics (Pitfall 8) |

## "Looks Done But Isn't" Checklist

- [ ] **Size cards:** derive inches+drills from grid dims via one helper — verify card size == priced size == A4 proof/spec size (not the mock's "24×16").
- [ ] **Color-count merge:** deterministic (tie-break like the legend), ΔE-guarded, and `matches`+`counts`+legend+cart+`planOrderSupply` all rebuilt from the one merged result.
- [ ] **Slider max:** equals `Object.keys(matchResult.counts).length`, recomputed on every re-match; "N of M" = kept-of-detected.
- [ ] **Quote:** Supplies "Est. total" cents === Order total cents === `sumCents(line items)`; canvas+shipping+tax routed through `money.ts`; estimates labeled "estimated".
- [ ] **Order button:** no "Place order"/"Pay"; no receipt/"payment captured"; states plainly no payment is taken.
- [ ] **Dark mode:** `theme` state+toggle+`[data-theme]` CSS removed; persisted `gempixel_theme:'dark'` neutralized; canvas backing = Atelier light tokens.
- [ ] **Mobile canvas:** pinch-zoom works, `touch-action: none` set, on-screen zoom buttons present; verified at 300px.
- [ ] **View switch:** toggling Grid/Symbol/Photo calls `draw()` only, no `redrawOffscreen()`; zoom/pan preserved across steps.
- [ ] **Fonts:** four families loaded with swap + fallback metrics; canvas symbol font reconciled (currently `'Outfit'`).
- [ ] **Tests:** the 240+ baseline stays green at every commit; `engine/*` untouched in UI phases.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Mock inch labels shipped | LOW | Replace literals with the grid-derived helper; add the card==priced==spec assertion |
| Legend/cart/quote de-sync after merge | MEDIUM | Trace every consumer back to one merged `counts`; delete forks; re-run `planOrderSupply` |
| Quote cent drift | LOW | Introduce `computeQuote` routing all inputs through `money.ts`; add the two-totals-equal test |
| "Place order" shipped | LOW (copy) / MEDIUM (if a fake receipt exists) | Rename action; remove receipt/payment states; add "no payment taken" note |
| Dark mode resurfaces | LOW | Remove `[data-theme]` CSS + `theme` state; migrate/ignore the persisted key |
| Mobile zoom missing | MEDIUM | Add two-pointer pinch to the existing pointer handlers + `touch-action:none`; expose zoom buttons |
| Big-bang `App.tsx` regression | HIGH | Revert to shell-first strangler; land one step at a time green (v2.1 "clean relocation" pattern) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Big-bang rewrite / regression | A (enforced B–F) | Suite green every commit; `engine/*` diff empty in UI phases |
| 2 View-switch / zoom-pan regression | A (mount once), C/D | Toggle = `draw()` only; viewport persists across steps |
| 3 Mock inch numbers | C (density decided pre-C) | card size == priced size == proof/spec size |
| 4 Merge determinism/sync | C | Same value → same grid; one `counts` feeds all surfaces; ΔE cap test |
| 5 Slider max / off-by-one | C | max == distinct used colors; label = kept-of-detected |
| 6 Quote cent drift | D + E (shared `computeQuote`) | Supplies total cents == Order total cents == `sumCents` |
| 7 Estimates-as-exact / stale rates | D, E | "Estimated" labels; dated rate provenance |
| 8 "Place order" honesty | E | No purchase/receipt semantics; "no payment taken" copy |
| 9 Dark mode not retired | A | Returning `theme:'dark'` user sees light; no `[data-theme]` CSS |
| 10 Mobile canvas zoom | F | Pinch works, page doesn't scroll on pan, at 300px |
| 11 Inline overflow at 300px | F | No horizontal scroll / clipping at 300px |
| 12 Slider/edge worker thrash | C | No re-match on merge; debounced; no chart flicker on drag |
| 13 Font FOUT/CLS | A | CLS < 0.1 on Refine/Supplies; symbol font reconciled |

## Sources

- Direct code review (HIGH): `src/App.tsx` (theme 163–167/1439, viewer wiring 517–562, `counts`/`used` 483–494, `planOrderSupply` 991, cart 1127, canvas cost effect 243–260, `sizingAdviceData` 262–282), `src/engine/money.ts`, `src/engine/bagPlanner.ts` (`planOrderSupply`, dye-lot 800, overshoot cap), `src/engine/checkout.ts` (`calculateCanvasCost` grid/10, `VENDOR_REGISTRY`), `src/engine/viewer.ts` (wheel-only zoom, `setViewMode`, offscreen buffer, `'Outfit'` symbol font), `src/engine/matcher.worker.ts` (`currentRunId` supersede).
- Grep audits (HIGH): zero `dark:` classes and zero `touch-action`/pinch handlers in `src/`.
- Design handoff README (MEDIUM — illustrative mock data by its own statement): Atelier tokens/fonts, 4-step flow, Refine rail, A4 order "Place order · $57.00", mobile 300×620, "illustrative mock data — wire to real sources".
- `.planning/PROJECT.md` + `RETROSPECTIVE.md` (HIGH): v4.0 scope (client-side, backend→v5.0), regression frustration, v3.0 money/`planOrderSupply` foundation, v2.1 "code review caught what tests couldn't" + "clean relocation not rewrite" lessons.

---
*Pitfalls research for: v4.0 Canvas-First Redesign (recreating a high-fidelity design in an existing client-side Preact app)*
*Researched: 2026-07-13*
