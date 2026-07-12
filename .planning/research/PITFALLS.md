# Pitfalls Research

**Domain:** Client-side creative-commerce tool (diamond-art planner) — adding a two-mode viewport wizard, pricing accuracy, an offline customer order packet, and gem-bag optimization to a shipped Preact/Vite/TS app.
**Researched:** 2026-07-12
**Confidence:** HIGH (grounded in the actual v2.1 codebase: `src/App.tsx`, `src/engine/bagPlanner.ts`, `checkout.ts`, `variants.ts`, `projectStore.ts`; several pitfalls are *live* bugs read directly from source, not hypotheticals)

> Scope note: these are pitfalls of **adding the v3.0 features to THIS system**, not generic web advice. Phase letters below are placeholders for the roadmapper; the ordering recommendation is the load-bearing part. Recommended sequence: **pure-logic correctness first (pricing → data integrity → bag optimization), then the two UI reworks staged one-after-another (viewport wizard, THEN mode split), then the order packet last.**

---

## Critical Pitfalls

### Pitfall 1: Two large overlapping UI reworks landed on one 2,318-line file at once

**What goes wrong:**
`src/App.tsx` is a single 2,318-line component holding the 4-step wizard, the supply checklist, the viewport HUD, project drawer, print legends, and all pricing/checkout wiring. v3.0 asks for **two** big reworks of exactly this surface: (1) viewport-native wizard replacing collapsible sidebars + the page-flip wizard, and (2) a Customer/Artist mode split layered on top. Doing them together (or interleaved) produces a giant unreviewable diff, destroys the shipped 178-test baseline in one shot, and makes it impossible to tell whether a regression came from the wizard change or the mode change.

**Why it happens:**
The two features touch the same JSX tree and the same state, so it *feels* efficient to "just do the new UI once." But the mode split is a **cross-cutting concern** over the wizard, not a sibling of it — combining them multiplies the state-space you must verify (wizard-step × mode × view-toggle × print) instead of adding it.

**How to avoid:**
- Stage strictly: **Rework #1 = viewport wizard** (mode-agnostic; both modes will share it). Ship it green (all 178 tests + new wizard tests) before starting the mode split. **Rework #2 = mode split** layered on the stabilized wizard.
- Before either rework, extract stable sub-components/pure helpers out of `App.tsx` (HUD, supply table, pricing panel, checkout panel) so each rework touches a bounded surface. `bagPlanner`/`checkout`/`projectStore` are already extracted — do the same for the big JSX blocks.
- Keep the existing HUD 3-way viewport switcher (`grid`/`symbols`/`reference`, App.tsx ~L1474) and the <1ms no-DOM-rerender behavior (SYMBOL-03) as an explicit regression target — it is a shipped, un-UAT'd-but-working invariant that a wizard rewrite can silently break.

**Warning signs:**
A single PR/phase diff that both deletes sidebar markup and adds a mode selector; test count dropping then "fixed later"; `App.tsx` growing past ~2,600 lines instead of shrinking as blocks extract.

**Phase to address:**
Viewport-wizard phase (Rework #1) owns the extraction + wizard; Mode-split phase (Rework #2) owns the layer. **These must be two separate phases, sequenced, never merged.**

---

### Pitfall 2: The mode split regresses the shipped 178-test suite because tests assume a single implicit mode

**What goes wrong:**
The current suite (`App.test.tsx`, `integration.test.tsx`, `print.test.tsx`, + engine tests) was written against a single-path app. Introducing a mode gate means every existing UI test now runs in *some* default mode; if the default mode hides controls the tests reach for (e.g. the artist price table, the exclude-color list, the vendor dropdown), tests fail for the "wrong" reason and get weakened rather than fixed.

**Why it happens:**
Under schedule pressure a red test after a UI change is "fixed" by loosening the assertion or forcing test setup into artist mode, quietly deleting coverage of the customer path (or vice-versa).

**How to avoid:**
- Decide the **default mode for tests explicitly** and make existing tests assert it, rather than letting it be implicit.
- For each existing UI test, consciously classify: *mode-agnostic* (keep), *artist-only* (tag + run in artist mode), *customer-only* (new). Add a customer-mode counterpart rather than repurposing an artist test.
- Treat "178 passing" as a ratchet: the mode-split phase must **add** tests, not net-delete. Run `npm test` count before/after as a gate.

**Warning signs:**
Assertions changed from `getByText` to `queryByText`/optional; test files gaining `setMode('artist')` boilerplate at the top of previously mode-free tests; coverage of the checkout/print path silently only exercised in one mode.

**Phase to address:**
Mode-split phase, with the pricing/data phases keeping their engine tests mode-free.

---

### Pitfall 3: Artist-only / Customer-only actions leak into the wrong mode

**What goes wrong:**
Customer mode is "done-for-you": it must **not** expose the raw price table (`priceDb` editing, App.tsx ~L174/L181), the per-bag `drillPacketCost`, the affiliate tag/app fields, the Diamond Drills USA cart link, or the vendor-cost internals — those are artist/self-serve tools and margin inputs. Conversely Artist mode should not show the customer service-fee or the "submit order packet for review" flow. Leaks either expose your cost basis/affiliate mechanics to customers or clutter the artist path.

**Why it happens:**
The controls all live in one JSX tree today. A mode split done by `{mode === 'artist' && ...}` sprinkled inline is easy to get wrong — one un-gated block leaks. Affiliate params (`ref`/`rfsn`, App.tsx ~L992) and the editable cost table are especially dangerous because they reveal business economics.

**How to avoid:**
- Don't gate with scattered inline booleans. Define a **capability map** per mode (e.g. `canEditPrices`, `canSeeAffiliate`, `canBuildDrillCart`, `showServiceFee`, `showOrderPacket`) and render from it, so "which mode sees what" is one auditable table.
- Write an explicit test per capability: "in customer mode, the price table / affiliate field / cart link is NOT in the DOM." Absence tests, not just presence tests.
- Default the *cost-basis* fields (priceDb, packet cost, affiliate tag) to artist-only and make customer mode strictly a superset-consumer of computed numbers, never the raw inputs.

**Warning signs:**
`mode === 'artist' &&` appearing dozens of times inline; a customer screenshot showing "$0.60/bag" edit fields or a `diamonddrillsusa.com/cart/...` link; affiliate query params present on a customer-facing URL.

**Phase to address:**
Mode-split phase (capability map is the phase's core deliverable).

---

### Pitfall 4: Persisted-state bleedover between modes

**What goes wrong:**
`ProjectData` (projectStore.ts) is a single frozen blob with no `mode` field. If mode is added as just another persisted setting, a project saved in Artist mode reloads carrying artist-only economics (custom priceDb, laborMarkup, affiliate tag) that then silently drive a customer quote — or a customer's service-fee state leaks into an artist session. Because `save()` freezes the shape for backward-compat, getting this wrong is expensive to unwind later.

**Why it happens:**
Persistence is centralized and "just add a field" is the path of least resistance. But mode changes the *meaning* of other fields (a price is a cost input in artist mode, a locked quote in customer mode).

**How to avoid:**
- Add `mode` and a `schemaVersion` to `ProjectData` **now**, with an explicit migration/defaulting rule for the existing (v2.1) blobs that lack them (default to artist, since that is the shipped behavior).
- Decide per-field whether it is mode-scoped or shared, and document it. Don't let artist-only fields (priceDb, affiliate tag, laborMarkup) feed a customer quote path — recompute customer-facing numbers from a defined, mode-appropriate source.
- When switching modes in a live session, define explicitly what carries over vs resets (grid/image/dimensions carry; economics reset to the target mode's rules).

**Warning signs:**
A customer quote that changes when you previously edited the artist price table; loading an old project throws or shows `undefined` mode; no `schemaVersion` in the saved JSON.

**Phase to address:**
Pricing/data phase introduces `schemaVersion`; mode-split phase adds the `mode` field + carry-over rules.

---

### Pitfall 5: Ambiguous mode switching / no clear "which mode am I in"

**What goes wrong:**
Users (and the artist testing the customer flow) get confused about which mode is active, take an action that only makes sense in the other mode, or lose work switching. Given the developer profile's stated frustration with "overlapping states or confusing visual indicators," a mode toggle that isn't obviously persistent and reversible is a real UX failure here.

**Why it happens:**
Mode is invisible after selection; the viewport wizard already has step state and view-toggle state, so a third dimension (mode) without a persistent, obvious indicator overloads the user.

**How to avoid:**
- Persistent, always-visible mode indicator in the HUD/chrome; switching modes is explicit and confirms if it will reset economics.
- Entry mode selector should be a genuine fork (Customer = done-for-you, Artist = self-serve), not a hidden toggle. Deep-link/restore into the last mode.

**Warning signs:**
Testers ask "am I in customer or artist mode?"; a control appears/disappears with no explanation; switching mode silently wipes the quote.

**Phase to address:**
Mode-split phase (UX indicator is part of the capability-map deliverable).

---

### Pitfall 6: Money math in floats — rounding drift and tier off-by-ones

**What goes wrong:**
Pricing today is all IEEE-754 float: `calculateCanvasCost` (checkout.ts) does float area math, `Math.abs(p.areaSqIn - area) < 0.05` epsilon tier matching, linear interpolation, then `Math.round(x*100)/100`; `priceColorPack` / `defaultPacketCost` sum floats. Adding a percent service fee and customer totals on top compounds drift, so line items can fail to sum to the displayed total (a classic `0.1 + 0.2 !== 0.3`). The `< 0.05` epsilon tier match is a literal tier-boundary off-by-one waiting to happen: an area 0.05 sq-in off a tier silently falls through to interpolation/`sqInchRate` and prices differently than the "same" canvas.

**Why it happens:**
Floats are the default and "it looks right" for small demos. The epsilon compare was a pragmatic hack for grid-vs-cm-vs-inch rounding.

**How to avoid:**
- Do money math in **integer cents** (or a small money helper); round **once** at display, and assert `sum(line items) === grand total` in a test.
- Replace the `< 0.05` area epsilon with an explicit, documented tolerance tied to the unit conversions, and add tier-boundary tests at exactly the tier area and ±epsilon.
- The service fee is a **percentage** — decide and test the rounding rule (round the fee, or round the total?) so fee + subtotal always reconcile to the shown total.

**Warning signs:**
Displayed total ≠ sum of visible line items by a cent; a canvas priced differently at 319.99 vs 320.00 sq-in; a fee that's off by a cent on re-computation.

**Phase to address:**
Pricing-accuracy phase (owns money-helper + tier tests); service-fee phase reuses the money helper.

---

### Pitfall 7: A missing/undefined price is treated as FREE ($0) by the cost minimizer (LIVE BUG)

**What goes wrong:**
This is not hypothetical — it's in `bagPlanner.ts` today. `minCostBulk` uses `const priceOf = (size) => priceDb[size] ?? 0` and `priceColorPack` uses `priceDb[Number(size)] || 0`. Any bag size absent from `priceDb` is costed at **$0**, so the cost-minimizing search will preferentially select that "free" size — producing a plan that looks cheapest precisely *because* its price is missing. Separately, `calculateCanvasCost` returns `0.0` for an unknown vendor (`if (!config) return 0.0`), i.e. a **free canvas** on bad input. This is exactly review-item PRICE-02, now in the customer-quote path where a $0 becomes a price you'd have to honor.

**Why it happens:**
`?? 0` / `|| 0` are the reflexive "safe default" for a missing lookup, but for a *cost minimizer* zero is the most dangerous possible default — it's the global optimum, so the bug is self-selecting.

**How to avoid:**
- A missing price must be **`+Infinity` (never selected) or a hard error**, never `0`. Change `priceOf` to treat undefined as `Infinity` in the minimizer, and make `priceColorPack` refuse to price a pack containing an unpriced size (surface it, don't silently zero it).
- `calculateCanvasCost` unknown-vendor should not return `0.0` — return `null`/throw so the UI can't show a free canvas.
- Add a guard: no customer quote may contain a `$0` line for a non-free item; block/flag the order instead.

**Warning signs:**
A drill color or canvas showing `$0.00`; the optimizer favoring an odd bag size; the total dropping when a price field is cleared.

**Phase to address:**
Pricing-accuracy phase (PRICE-02) — do this **before** bag-optimization and before the customer quote/packet phases, which both consume these numbers.

---

### Pitfall 8: The 500-count bag is priced at the wrong tier (LIVE BUG — PRICE-01)

**What goes wrong:**
`defaultPacketCost(type, bagSize)` in `bagPlanner.ts` has explicit branches for `200`, `1000`, `2000`, and an `else` that is commented "5000 drills bulk bag." There is **no `500` branch** — so a 500-count bag falls into the `else` and is priced as the $3.00+ 5000-bulk tier. Yet `priceDb` and the variants table use 500 everywhere (App.tsx seeds `500: 1.10`). `defaultPacketCost` seeds `drillPacketCost` (App.tsx ~L550) and the non-optimized "Bags (500)" display path, so a customer/artist picking 500-count bags sees a wildly inflated per-bag cost. This is review-item PRICE-01 verbatim.

**Why it happens:**
The 500 tier was added to `priceDb` and `variants` but `defaultPacketCost`'s branch ladder wasn't updated — a classic "two sources of truth for the same tier list" drift.

**How to avoid:**
- Add the `500` branch to `defaultPacketCost`, and better, **derive all bag-size logic from one canonical size list** so a new tier can't be half-added again.
- Add a test asserting `defaultPacketCost(type, 500)` is between the 200 and 1000 values for every drill type.

**Warning signs:**
500-count bag per-unit cost ≈ the 5000 bulk price; "Bags (500)" column far pricier than "Bags (Opt)".

**Phase to address:**
Pricing-accuracy phase (PRICE-01).

---

### Pitfall 9: The drill-variant table has integrity holes (empty mappings, duplicate variant IDs)

**What goes wrong:**
`variants.ts` already contains: **empty mappings** (`"471"` has `square: {}`, `"798"` has `round: {}`) and **duplicated variant IDs across different DMC codes** (`"731"` and `"732"` share identical IDs across all sizes; `"781"` and `"782"` likewise). An empty mapping means a color silently packs to nothing (`packColor` returns an empty pack → that color is missing from the cart/quote with no error). A duplicate variant ID means two DMC codes point at the **same** Diamond Drills USA product — a customer orders the wrong physical color. Without the DATA-01 integrity test these ship invisibly into the customer packet.

**Why it happens:**
The table is 5,107 lines of hand/scraped data; copy-paste and missing-SKU gaps are inevitable and invisible to typechecking.

**How to avoid:**
- Ship the **DATA-01 automated integrity test** (already scoped): every variant ID unique OR explicitly allow-listed as a known shared SKU; no empty `square`/`round` object for a code that's reachable from a palette; every palette DMC has at least one mapping in at least one shape.
- On an empty/absent mapping at runtime, the color must be **surfaced as unmapped** (checkout already collects `unmappedItems`) — never silently dropped from a quote/packet.

**Warning signs:**
A palette color that never appears in the supply table or cart; two colors resolving to the same product URL; `Object.keys(mapping).length === 0` reached in `packColor`.

**Phase to address:**
Data-integrity phase (DATA-01) — run before the customer packet phase.

---

### Pitfall 10: Showing a customer a price you can't honor

**What goes wrong:**
Customer mode presents a firm quote (canvas + optimized drills + % fee + totals) that becomes a manual/offline order. If any input is stale or wrong — a $0 from Pitfall 7, a mis-tiered 500 bag from Pitfall 8, an unmapped color from Pitfall 9, an interpolated canvas cost from a size outside the tier table, or hardcoded default per-bag prices (`DEFAULT_PRICE_DB` in checkout.ts) that don't match live vendor cost — you've quoted a number you must either eat or renege on. A percentage service fee on top of a wrong subtotal magnifies it.

**Why it happens:**
Client-side quotes feel authoritative but are computed from editable/estimated local tables with no server-side source of truth (that's the v4.0 backend, deferred).

**How to avoid:**
- Present customer quotes as **"estimate, confirmed at fulfillment"** for this milestone, not a payment-binding total — the packet feeds manual review.
- The "large orders flagged for human review" gate (already in scope) must trigger on **quote risk**, not just size: any `$0` line, any unmapped color, any canvas priced by fallback `sqInchRate` (outside tier table), or total over a threshold → flag for review instead of presenting as final.
- Stamp each quote with the price-table version/date so a later dispute is traceable.

**Warning signs:**
A quote with a $0 or "estimated" line presented as final; fee computed on a subtotal containing an unmapped color; canvas cost from the `sqInchRate` fallback branch shown without an "estimate" caveat.

**Phase to address:**
Service-fee + customer-quote phase; the review-gate lives in the order-packet phase.

---

### Pitfall 11: Order-packet data model that can't map to the v4.0 backend

**What goes wrong:**
The packet (PNG + optimized bag list + spec + fee + totals) is explicitly meant to later feed a v4.0 order backend. `ProjectData` today has **no `schemaVersion`, no order/customer entity, no quote snapshot** — it's an artist workspace blob. If the packet is serialized as "whatever App state happens to be," v4.0 will have to reverse-engineer and migrate an unversioned shape, and offline packets already in customers' hands won't map.

**Why it happens:**
It's easy to `JSON.stringify(currentState)` and call it an order. The frozen-shape convention in `projectStore` (existing projects must keep loading) makes ad-hoc additions tempting but locks in mistakes.

**How to avoid:**
- Define an explicit, **versioned `OrderPacket` schema** separate from `ProjectData`: `schemaVersion`, a stable order id (reuse `generateUUID` CSPRNG — never `Math.random`), a frozen **quote snapshot** (line items in cents, fee %, totals, price-table version), the canvas spec, the bag plan (`bySize` per color + shape), and the PNG reference — designed as the contract the v4.0 backend will ingest.
- Snapshot computed values (don't store just inputs and recompute later against a changed price table).
- Keep the PNG **out of the JSON blob** (see Pitfall 12) and reference it, so the packet schema stays small and portable.

**Warning signs:**
Packet = `JSON.stringify(appState)`; no version field; totals stored as floats or recomputed on load; order id from `Date.now()`/`Math.random`.

**Phase to address:**
Order-packet phase (schema is the first deliverable, before UI).

---

### Pitfall 12: PNG size / serialization limits and localStorage quota blow-ups

**What goes wrong:**
The packet embeds a full-resolution canvas PNG. A large canvas PNG as a base64 data URL is multi-MB; JSON-embedding it into a `ProjectData`/packet blob and writing to `localStorage` will hit the ~5 MB origin quota fast. `projectStore.save()` already returns `{ ok:false, reason:'quota' }` and recents-save evicts oldest on quota — but an **order the customer thinks they placed** must not silently fail or evict. Also `canvas.toDataURL` can throw/oversize on very large grids, and building a giant base64 string can jank the main thread.

**Why it happens:**
The existing persistence path is sized for small thumbnails (80×60 JPEG, projectStore.ts) and project blobs, not full-res order PNGs.

**How to avoid:**
- **Don't store the order PNG in localStorage.** Generate it on demand as a **downloaded file / Blob** (the export path already produces PNGs), and keep only a small reference + metadata in any persisted packet.
- Offer the packet as an explicit **download/export** (file the customer sends you), not a silent localStorage write — offline fulfillment needs the artifact to leave the browser anyway.
- Surface quota failures loudly (the ERR-01 banner pattern already exists) — an order must never be a silent no-op. Prefer `toBlob` over `toDataURL` for large canvases.

**Warning signs:**
`QuotaExceededError` on "Buy"; multi-MB base64 strings in a saved blob; the save banner firing during checkout; UI jank when generating the packet.

**Phase to address:**
Order-packet phase.

---

### Pitfall 13: Customer / order / PII data living only in the browser

**What goes wrong:**
This milestone starts crossing the "client-side only, no image ever leaves the browser" constraint by capturing customer orders — but with no backend yet. If any customer contact/PII or the only copy of an order lives solely in `localStorage`, it's lost on cache clear, private mode, or a different device, and there's no fulfillment record. It also quietly changes the app's privacy posture (the shipped promise is "images never upload") — a customer packet that must reach the artist is in tension with that promise if handled carelessly.

**Why it happens:**
The app has always been storage-only; "just persist the order locally" continues the pattern, but an order is not a scratch workspace.

**How to avoid:**
- The **source of truth for an order is the exported packet artifact** the customer transmits to the artist (download/email/upload-to-you), not browser storage. Local storage is at most a convenience cache.
- Collect the **minimum PII** needed for manual fulfillment; be explicit that the current privacy promise ("images processed locally") still holds for design, while the *order packet* is deliberately shared with the artist for fulfillment — don't blur the two.
- Design the packet so the future v4.0 backend is the intended durable store; nothing this milestone should assume localStorage is durable.

**Warning signs:**
The only record of a placed order is a `gempixel_*` localStorage key; PII persisted without the user knowing; "where did my order go?" after a cache clear.

**Phase to address:**
Order-packet phase (with a privacy note carried up to PROJECT.md scope).

---

### Pitfall 14: Bag optimizer that isn't actually minimal / breaks the dye-lot rule to save a bag

**What goes wrong:**
The core tension of gem-bag optimization: **fewest bags** vs **dye-lot color consistency**. `bagPlanner.ts` encodes the dye-lot rule as "≤ 800 drills → 200-count bags only; > 800 → cost-minimize over bulk sizes, never mixing 200s." Two failure modes when extending it: (a) a naive greedy "largest bag first" is *not* always minimal cost/bags (e.g. `1×1000 + 2×500` when `1×2000` is fewer and cheaper — the current bounded search handles this, but a rewrite might regress it); (b) "optimizing" by mixing dye lots (combining a 200 top-up with bulk bags, or splitting one color across sizes that come from different dye lots) saves a bag but produces **visibly mismatched drills** in the finished art — the exact quality failure a done-for-you customer is paying to avoid.

**Why it happens:**
Bin-packing/covering intuition says "just fill greedily." The dye-lot constraint is invisible in the math but critical to the physical product; a well-meaning "make it cheaper" change quietly relaxes it.

**How to avoid:**
- Treat the dye-lot rule as a **hard constraint**, cost as the objective under it — never trade consistency for a cheaper plan. Keep the `DYE_LOT_CEILING = 800` rule and the "never mix 200s into bulk" invariant as tested properties.
- Guard the "actually minimal" property with tests on known-tricky counts (the `1×2000` vs `1×1000+2×500` case, counts just over 800, counts requiring the smallest bulk size to ceil-fill).
- Keep the **single shared packing primitive** (`packColor`) driving both the legend estimate and the Shopify cart (already the design) so the quoted plan and the ordered plan can never diverge.

**Warning signs:**
A "cheaper" plan that mixes a 200 bag into a bulk order; the cart and legend showing different bag counts; a rewrite that drops the bounded search for a plain greedy loop; test counts just over 800 producing bulk instead of 200s.

**Phase to address:**
Bag-optimization phase (after pricing correctness, so the minimizer runs on real prices not $0s).

---

### Pitfall 15: Infeasible / unpriced inputs crash or silently mis-plan the optimizer

**What goes wrong:**
Feasibility gaps: a color with **only a 200 mapping** (many in `variants.ts`) but a huge required count → dozens of 200 bags (correct but expensive, and dye-lot-fragmented — unavoidable, but must be surfaced, not hidden); a color with **empty mapping** (Pitfall 9) → empty pack, color vanishes from the plan; a bulk color whose bulk sizes are **all unpriced** → the $0-is-free bug (Pitfall 7) picks a phantom-cheap plan. The optimizer must degrade predictably, never throw in the render path (its docstring promises this) and never silently produce a wrong-but-plausible plan.

**Why it happens:**
Real catalog data is ragged (some colors have 200 only, some have gaps), and the optimizer's "return empty pack on unknown" safety can mask genuine data problems as "no bags needed."

**How to avoid:**
- Distinguish **"legitimately needs no bags"** (count 0) from **"couldn't plan"** (unknown/empty mapping / all sizes unpriced) — the latter must be surfaced as an unmapped/flag-for-review item, not an empty row.
- Feed the optimizer only **validated** prices (Pitfall 7 fix) and a **validated** table (Pitfall 9 fix) so infeasibility is real, not an artifact.
- Keep the "never throw in render path" invariant under test with adversarial inputs (empty mapping, negative/zero count, unpriced sizes).

**Warning signs:**
A palette color with a nonzero count but no bag row; an order that plans "cheaply" for a color whose prices are missing; an exception during supply-table render.

**Phase to address:**
Bag-optimization phase (consuming the pricing + data-integrity phase outputs).

---

### Pitfall 16: Removing Prodigi leaves dangling references and a $0 fallback path

**What goes wrong:**
Prodigi is wired in several places: the `VENDOR_REGISTRY` entry and the `Record<'lumaprints'|'prodigi'|'finerworks'>` **type union** in `checkout.ts`, `selectedVendor` state typed the same way in `App.tsx` (~L168), and the vendor dropdown UI. Removing it carelessly: (a) breaks the type union (compile errors, or worse, a widened `string` that loses safety); (b) leaves **saved projects that reference `prodigi`** — on load, `calculateCanvasCost` hits `if (!config) return 0.0` and quotes a **free canvas** (Pitfall 7 again); (c) orphans any persisted `selectedVendor: 'prodigi'`.

**Why it happens:**
"Just delete the entry" ignores the type union and the persisted-state migration. The $0 unknown-vendor fallback turns a removed vendor into a silent free-canvas bug.

**How to avoid:**
- Remove Prodigi from the union **and** add a load-time migration: any persisted `selectedVendor === 'prodigi'` → remap to `lumaprints` (default) with the price recomputed.
- Fix the unknown-vendor fallback to not return `0.0` (Pitfall 7) so a stray `prodigi` can't produce a free canvas.
- Grep for every `prodigi` occurrence (registry, union, UI option, tests, saved-blob handling) as the removal checklist.

**Warning signs:**
Type error on the vendor union or a widened `string` type; a loaded old project showing a $0 or default canvas cost; `prodigi` still present in any test fixture.

**Phase to address:**
Vendor-cleanup phase (pair it with the Pitfall 7 unknown-vendor fix).

---

### Pitfall 17: Backend concerns creep into a client-side milestone (boundary crossing)

**What goes wrong:**
v3.0 explicitly stays client-side; the order backend, payments, and printer/vendor APIs are v4.0. The gravitational pull of "customer orders" invites scope creep: adding a fetch to a half-built order endpoint, an auth stub, a payments SDK, or server-side price validation — crossing the client→server boundary badly and half-implementing the thing that's supposed to be a whole v4.0 milestone. The reverse risk: designing the packet so tightly to "just works locally" that v4.0 can't consume it (Pitfall 11).

**Why it happens:**
Once you model an "order," a server feels one small step away. But a partial backend is worse than none — it splits the source of truth and leaves an insecure/incomplete surface.

**How to avoid:**
- Hard rule for the milestone: **no network calls for order fulfillment, no payments, no auth.** The packet is a *local artifact* designed as the v4.0 backend's future input contract.
- Keep the client→server **seam** clean and one-directional: the packet schema (Pitfall 11) is the interface; nothing this milestone calls a server.
- Route all work through the GSD workflow (the repo enforces this) so scope creep surfaces at planning, not in a stray commit.

**Warning signs:**
A `fetch('/api/orders')`, a Stripe/PayPal import, an env var for an API base URL, or an auth token appearing in the diff; the packet only usable by this client.

**Phase to address:**
Order-packet phase (scope guard) + carried in every v3.0 phase's non-goals.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Do both UI reworks in one phase | One big "new UX" merge | Unreviewable diff, 178-test baseline lost, can't attribute regressions | **Never** — stage wizard then mode split |
| Gate modes with inline `mode === 'x' &&` everywhere | Fast to write | Leak-prone, no single source of "who sees what", hard to test absence | Never — use a capability map |
| Money math in floats + round at the end | Works in the demo | Line items don't sum to total; tier off-by-ones | Never for customer-facing money — use integer cents |
| `priceDb[size] ?? 0` / `\|\| 0` in a minimizer | No crash on missing price | Free price becomes the chosen optimum (LIVE BUG) | Never in a cost minimizer — use `Infinity`/error |
| Embed order PNG in the localStorage blob | One-call "save order" | Quota blow-up, silent order loss | Never — export as Blob, reference only |
| `JSON.stringify(appState)` as the order packet | Ships an "order" today | v4.0 can't ingest; unversioned; recompute drift | Never — versioned `OrderPacket` schema |
| Delete Prodigi entry only | Looks done | Free-canvas on old projects, type/union breakage | Never — migrate persisted state + fix $0 fallback |
| Treat client quote as final price | Simple UX | Quote you can't honor | Only if labeled "estimate, confirmed at fulfillment" |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Diamond Drills USA cart (`compileShopifyCartLink`) | Cart bag plan diverges from the quoted/legend plan | Keep the single shared `packColor` primitive driving both; test they match |
| Diamond Drills USA variant table | Empty mapping → color silently dropped; dup ID → wrong product | DATA-01 integrity test + surface unmapped items, never drop |
| Canvas vendors (`VENDOR_REGISTRY`) | Unknown vendor → `return 0.0` free canvas; Prodigi removal orphans saved state | Return null/throw on unknown; migrate persisted `selectedVendor` |
| Affiliate params (`ref`/`rfsn`) | Leak into customer-facing URLs, exposing affiliate mechanics | Capability-map: affiliate is artist-only; absence-test in customer mode |
| Future v4.0 order backend | Packet designed only to work locally / unversioned | Versioned `OrderPacket` as the deliberate ingest contract |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-res PNG base64 in a JSON blob | UI jank on "Buy", multi-MB strings | `toBlob` + download, keep PNG out of JSON | Large canvases / big grids |
| localStorage as order store | `QuotaExceededError`, evicted/lost orders | Export artifact is source of truth | After a few large projects near the 5MB quota |
| Mode split forcing full Preact re-renders | Lost <1ms viewport-switch (SYMBOL-03) | Preserve the no-DOM-rerender view switcher through the rework | Large grids on every mode/view toggle |
| Optimizer bounded search on many colors | Slower supply table | Keep per-color search bounded (already is); memoize per color | Very large palettes with all-bulk sizes |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Order id from `Math.random`/`Date.now` | Collision overwrites another order (same class as WR-02/W9) | Reuse `generateUUID` CSPRNG in the packet |
| Exposing cost basis / affiliate tags to customers | Reveals margins & affiliate mechanics | Capability-map gates artist-only economics out of customer mode |
| PII/order only in browser | Data loss, unclear privacy posture vs the "stays local" promise | Exported artifact is the record; collect minimal PII; explicit privacy note |
| Partner/canvas URL opened unvalidated | Open-redirect / bad URL (deferred SEC-01, resurfaces via `uploadUrl`/`compileCanvasPartnerUrl`) | Validate against an http/https allowlist before opening |
| Half-built backend endpoint | Insecure/incomplete server surface | No network fulfillment this milestone (Pitfall 17) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Invisible current mode | User acts in the wrong mode, loses work | Persistent mode indicator; explicit, confirmed switching |
| Customer sees raw price/cost fields | Confusing + exposes economics | Customer mode shows computed numbers only |
| $0 or "estimate" line shown as a firm price | Broken trust when the artist can't honor it | Flag-for-review gate; label estimates clearly |
| Losing the shipped HUD 3-way switch feel | Regressed, sluggish viewport toggles | Treat SYMBOL-03 behavior as a regression target through both reworks |
| Overlapping/ambiguous states after rework | Matches the user's stated top frustration | Clean, non-overlapping HUD; one obvious action per context |

## "Looks Done But Isn't" Checklist

- [ ] **Viewport wizard:** often missing — the shipped HUD 3-way viewport switch still toggles in <1ms without Preact re-render; verify grid/symbols/reference all still work.
- [ ] **Mode split:** often missing — **absence** tests (customer mode does NOT render price table / affiliate field / drill cart link); verify with `queryByText`-is-null assertions.
- [ ] **Pricing:** often missing — `sum(line items) === grand total` in cents; verify with a reconciliation test including the % service fee.
- [ ] **Pricing:** often missing — no `$0` line reaches a customer quote; verify unpriced size → `Infinity`/flagged, not free.
- [ ] **500-bag:** often missing — `defaultPacketCost(type, 500)` lies between the 200 and 1000 values; verify per drill type.
- [ ] **Variant table:** often missing — DATA-01 test for unique IDs, no empty mappings, full palette coverage; verify it actually fails on the known `471`/`798`/`731==732`/`781==782` cases (or they're fixed/allow-listed).
- [ ] **Order packet:** often missing — `schemaVersion` present; totals stored in cents; PNG NOT in the JSON blob; verify a round-trip parse.
- [ ] **Prodigi removal:** often missing — saved project with `selectedVendor:'prodigi'` migrates to lumaprints and does NOT price at $0; verify with an old-blob fixture.
- [ ] **Bag optimizer:** often missing — dye-lot rule holds (no 200s mixed into bulk); `1×2000` beats `1×1000+2×500`; verify at counts around 800.
- [ ] **Scope:** often missing — no `fetch`/payments/auth in the diff; verify the packet is a pure local artifact.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Two reworks merged into one broken diff | HIGH | Revert, extract sub-components first, redo as two staged phases |
| Mode leak of cost/affiliate data | LOW–MEDIUM | Introduce capability map, add absence tests, re-audit each gate |
| $0-as-free priced into shipped quotes | MEDIUM | Fix `priceOf`→Infinity + unknown-vendor fallback; re-flag any quotes with $0 lines |
| 500-bag mis-tier already quoted | LOW | Add 500 branch + test; re-derive affected quotes |
| Unversioned packet already in customer hands | HIGH | Define versioned schema, write a migration for legacy packets; unavoidable manual reconciliation |
| Order lost to localStorage quota | MEDIUM | Move to export-artifact model; surface quota via ERR-01 banner |
| Backend creep committed | MEDIUM | Rip out network/payments code; restore packet-only seam |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 6, 7, 8 — money floats, $0-as-free, 500 mis-tier (PRICE-01/02) | **Pricing-accuracy phase (do first)** | Cents-reconciliation test; unpriced→Infinity test; 500-tier test |
| 9, 15 — variant integrity, infeasible inputs (DATA-01) | **Data-integrity phase (early)** | DATA-01 test fails on known holes; unmapped surfaced not dropped |
| 14, 15 — minimality vs dye-lot, degradation | **Bag-optimization phase (after pricing/data)** | Dye-lot invariant + known-tricky-count tests; no-throw adversarial test |
| 16 — Prodigi removal + $0 fallback | **Vendor-cleanup phase** | Old-blob migration test; unknown-vendor ≠ $0 |
| 1, 2 — double-rework, test-suite regression | **Viewport-wizard phase (Rework #1, standalone)** | 178 tests still green + wizard tests; App.tsx shrinks |
| 3, 4, 5 — mode leaks, state bleedover, ambiguous switch | **Mode-split phase (Rework #2, after wizard)** | Capability-map absence tests; `mode`+`schemaVersion` migration; visible indicator |
| 6 (fee), 10 — fee rounding, un-honorable quote | **Service-fee / customer-quote phase** | Fee reconciliation; review-gate on risky quotes |
| 10, 11, 12, 13, 17 — review gate, packet schema, PNG/quota, PII, scope | **Order-packet phase (last)** | Versioned schema round-trip; PNG as Blob; no-network guard; review-flag test |

**Sequencing recommendation (load-bearing):** pricing-accuracy → data-integrity → bag-optimization → vendor-cleanup → **viewport-wizard (Rework #1)** → **mode-split (Rework #2)** → service-fee/quote → order-packet. Correctness (pure logic, test-guarded) lands before UI churn; the two UI reworks are strictly separated; the packet comes last so it consumes final pricing/plan and a stable mode surface.

## Sources

- **GemPixel v2.1 source (HIGH):** `src/engine/bagPlanner.ts` (`priceOf ?? 0`, `|| 0`, `DYE_LOT_CEILING`, missing 500 branch in `defaultPacketCost`), `src/engine/checkout.ts` (`calculateCanvasCost` float/epsilon math, `return 0.0` unknown vendor, `VENDOR_REGISTRY` incl. prodigi, `DEFAULT_PRICE_DB`), `src/engine/variants.ts` (empty `471`/`798` mappings, duplicate IDs `731==732`, `781==782`), `src/engine/projectStore.ts` (frozen `ProjectData`, no schema version, CSPRNG `generateUUID`, quota `SaveResult`), `src/App.tsx` (2,318 lines; `selectedVendor` union incl. prodigi ~L168; `priceDb` seeding; HUD 3-way switch ~L1474).
- **v2.1-REQUIREMENTS.md (HIGH):** PRICE-01 (500-bag mis-tier / review W6), PRICE-02 ($0-as-free / W7), DATA-01 (variant integrity / IN-03), SEC-01 (URL allowlist / W10), WR-02/W9 (UUID collision).
- **PROJECT.md v3.0 milestone (HIGH):** two-mode viewport pivot, frontend-first/client-side scope boundary, backend/payments deferred to v4.0, manual/offline packet + human-review flag.
- **Developer profile (`.agents/GEMINI.md`, MEDIUM):** regression-averse, dislikes overlapping/ambiguous UI states, prefers browser-native lightweight solutions — informs the staging + clean-HUD + no-backend-creep guidance.

---
*Pitfalls research for: client-side creative-commerce diamond-art planner — v3.0 two-mode viewport milestone*
*Researched: 2026-07-12*
