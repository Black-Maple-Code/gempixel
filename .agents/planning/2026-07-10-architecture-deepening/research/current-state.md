# Current-State Map (as-is)

Authoritative snapshot of the code being refactored, for cold-start agents. Line numbers are from
`master` as of 2026-07-10 and WILL drift as edits land — treat them as starting anchors, re-grep to
confirm before editing. Every claim here was verified against the source during scoping.

## Module sizes
| File | Lines | Nature |
|---|---|---|
| `src/engine/variants.ts` | 5106 | Static catalog `DRILL_VARIANTS` (data — DO NOT TOUCH) |
| `src/engine/palette.ts` | 4058 | Static catalog `DMC_PALETTE` (data — DO NOT TOUCH) |
| `src/App.tsx` | 3321 | God component (all five candidates live here) |
| `src/engine/viewer.ts` | 437 | CanvasViewer (deep, healthy) |
| `src/engine/checkout.ts` | 291 | Cart/vendor logic (Candidate 1 touches this) |
| `src/engine/export.ts` | 273 | PNG/print export (deep, healthy) |
| `src/engine/color.ts` | 195 | CIEDE2000 matching + substitution (Candidate 2 consumes) |
| `src/engine/ingest.ts` | 121 | Image load + box-sample downscale (deep, healthy) |
| `src/engine/matcher.worker.ts` | 96 | Web Worker entry (Candidate 2 consumes) |
| `src/engine/symbols.ts` | 90 | `generateSymbolAllocation` (Candidate 2 consumes) |
| `src/engine/worker-client.ts` | 45 | `MatcherClient` adapter (Candidate 2 wraps) |

## Candidate 1 — Supply/bag/cost surface (the two `optimizeBags`)

### Functions in `src/App.tsx` (all exported; imported by tests)
- `:136` `calculateSafetyPurchase(exactCount, bagSize=200): {safety, packets, purchase}` — +10% safety
  margin, round up to `bagSize`. Tested: `src/__tests__/print.test.tsx:6,13,21,27`.
- `:143` `getDefaultPacketCost(type: 'standard'|'ab'|'glow'|'crystal', bagSize): number` — hardcoded
  price table by bag size. Used: `App.tsx:729`.
- `:169` `optimizeBags(target, prices:{200,500,1000,2000}): {bags, cost, totalDrills}` — **brute-force
  COST-MINIMIZER** over four bag sizes. Ignores dye-lot rule and per-color variant availability.
  Used: `App.tsx:1142-1143` (per-legend-row estimate). Tested: `print.test.tsx:38,50`.

### Functions in `src/engine/checkout.ts`
- `:35` `optimizeBags(count): {qty200,qty500,qty1000,qty2000}` — **DYE-LOT PACKER**: `≤800 → 200-bags
  only`, else greedy bulk packing. Tested: `src/engine/__tests__/checkout.test.ts:7,15,23`
  (`describe('Dye Lot Bag Optimizer')`).
- `:70` `compileShopifyCartLink(items, affiliateTag, affiliateApp)` — **packs PER-COLOR against
  `DRILL_VARIANTS[dmcCode][shape]` availability** (`:80-104`), so the cart respects which bag sizes
  actually exist for each color and applies the ≤800 dye-lot rule. This is the true "what the user
  buys" packing.
- `:169` `compileCanvasPartnerUrl(options)`; `:245` `calculateCanvasCost(w,h,unit,vendor)` (used
  `App.tsx:383`, heavily tested `checkout.test.ts:114-163`); `:202` `VENDOR_REGISTRY`.

### The divergence (the latent bug)
The legend cost estimate (`App.tsx:1130-1180`, `sortedMatches`) already packs **per-color** — it calls
`optimizeBags(count, priceDb)` per DMC code — BUT uses the cost-minimizer, which (a) ignores the
≤800 dye-lot rule and (b) assumes all of 200/500/1000/2000 exist for every color. The cart
(`compileShopifyCartLink`) packs the same per-color counts but respects the dye-lot rule and only the
bag sizes available in `DRILL_VARIANTS`. So for a given color the estimate and the cart can report
different bag counts and therefore different totals. **Reconciliation (per idea-honing Q1): the
estimate must re-run the cart's per-color packer, then price it.**

**IMPORTANT (verified during review):** the legend loop is **two branches** gated by the
`#optimize-bags-checkbox` (`optimizeBagsCost`). Only the *checked* branch (`~:1137-1165`) uses the
cost-minimizer and is the one to reconcile to the cart's packer. The *unchecked* branch (`~:1166-1180`)
uses `calculateSafetyPurchase(count, drillBagSize)` — a manual, user-chosen **uniform** bag size,
independent of `DRILL_VARIANTS`; it is not a bug and must keep working, so `calculateSafetyPurchase`
**stays in `App.tsx`** (only the cost-minimizer `optimizeBags` and `getDefaultPacketCost` leave).
`App.test.tsx` (~:139-144, ~:219-224) unchecks the box and asserts literal values ($23.00, packet
0.25/0.35) — the manual branch must stay byte-identical. `print.test.tsx` repoints only its
`optimizeBags` block; its `calculateSafetyPurchase` block is unchanged.
Also: `withSafetyMargin` cannot round "to the smallest available bag size for the color" from a bare
`count` — it needs `dmcCode`+`shape`, or that rounding must live in `planColorSupply` (design bug).

## Candidate 2 — Matcher pipeline (in `src/App.tsx`)
- `:2-3` imports `substituteLowCountColors` from `./engine/color`, `MatcherClient` from
  `./engine/worker-client`.
- `:310` `rawMatchResult` state; `:339` etc. related flags; `loading`/`progress` state.
- `:558` `clientRef = useRef<MatcherClient>`; `:618-625` init effect (`new MatcherClient(new URL(
  './engine/matcher.worker.ts', import.meta.url))`) + terminate on unmount; `:893` `clientRef.current
  ?.match(...)` invocation (inside the match-trigger effect keyed on `image,cols,rows,selectedBaseKit,
  excludedColors`).
- Derived memos: `:569` `matchResult` (applies `substituteLowCountColors` when `enableSubstitution`),
  `:584` `symbolMap` (`generateSymbolAllocation`), `:592` `leftLegendColors/rightLegendColors`.
- Downstream effects feed `viewerRef.current.setData(...)` (`:651-669`).
- Engine seams already available: `color.substituteLowCountColors(gridCodes, counts,
  activeCandidates, threshold)`, `symbols.generateSymbolAllocation(codes, dmcList)`,
  `MatcherClient.match(pixels, candidates, onProgress, onComplete, cols?)`.

## Candidate 3 — Persistence (in `src/App.tsx`)
- `:12` `interface ProjectSummary`, `:20` `interface ProjectData` (serialization shape).
- `:42` `generateUUID()`, `:49` `generateThumbnail(canvas)`.
- `:65` `saveProjectToStorage(summary, data)`, `:87` `loadProjectFromStorage(id): ProjectData|null`,
  `:97` `deleteProjectFromStorage(id)` — all `localStorage`, all exported.
- State: `projectsRegistry`, `recentImages`, `activeProjectId`; quota-eviction `useEffect` (~`:601`).
- Consumers: `handleSaveProject` (`:495`), project load path (~`:422`, not `:432`), recents effects.
- **4 raw-`localStorage` bypass sites** that skip the exported functions and must also be repointed:
  registry init read (`~:245-252`), recents init read (`~:288-293`), post-save registry reload
  (`~:542-543`), delete-handler registry filter (`~:1333-1335`).
- **`RecentImage` is not a named type** anywhere (only inline/anonymous) — must be authored.
  Eviction direction differs: registry appends newest (oldest = index 0), recents prepend newest
  (oldest = last) — a naive `.pop()` on the registry evicts the newest. New tests need
  `// @vitest-environment jsdom`.

## Candidate 4 — Active candidates (in `src/App.tsx`)
- `:302` `selectedBaseKit: 'all'|'100'|'200'`; `:304` `excludedColors: Set<string>`.
- `:563-567` `baseCandidates = selectedBaseKit==='all' ? DMC_PALETTE : DMC_PALETTE.filter(c => c.kits.includes(selectedBaseKit))`;
  `activeCandidates = baseCandidates.filter(c => !excludedColors.has(c.dmc))` — **recomputed every
  render, no memo**. Identity field is **`c.dmc`** (string), NOT `c.code`; kit field is
  `kits: ("100"|"200")[]`.
- `activeCandidates` is consumed by: matcher trigger (`:893` region), `matchResult` memo (`:569`),
  `symbolMap` (`:584`), legend split (`:592`), the viewer-feed colorMap builders (`~:654`, `~:1077`,
  `~:1099`), and the legend render (`~:3303`). It is the load-bearing "which colors are in play" value.
- **`baseCandidates` is independently live — do NOT delete it** when memoizing `activeCandidates`:
  read by `toggleColorExclusion`'s keep-one guard (`~:917`), `handleDeselectAll` (`~:932-933`), and
  two kit-browser render blocks (`~:1824`, `~:2763`), including the Step 2 exclusion checklist (which
  must iterate `baseCandidates`, not `activeCandidates`, or exclusion becomes irreversible).

## Candidate 5 — Wizard (in `src/App.tsx`)
- `:299` `wizardStep: number` (1-4); `:492` reset to 1.
- `:417` `isStepValid(step)` logic (e.g. `step===3||4 → !!matchResult`).
- Four inline render blocks (contents differ from their design-doc labels — verified against source):
  `:1370` Step 1 = ingest + fit/preset/units/size/drill-style; `:1693` Step 2 = kit `<select>` +
  drill-type `<select>` + substitution + DMC Supply List legend table; `:1908` Step 3 = **"Cost &
  Order" form** (vendor, canvas price/shipping, `#optimize-bags-checkbox`, per-bag pricing, cost
  breakdown, order/print/download actions, sizing advice, affiliate) — **not** the canvas viewer or
  legend; `:2238` Step 4 = **Summary + "Save to My Images" form + reset** — **not** export/print/cart.
- The pixel-canvas viewport HUD (`~:2522-2708`, gated only by `image &&`) and the interactive color
  legend `<aside>` (`~:2710-2916`, incl. "BUY SUPPLIES →" at `~:2989`) are **persistent chrome
  rendered outside any `wizardStep` gate** — not part of any step block; do not move them.
- **5th `wizardStep` reference:** print-only checklist guard `{wizardStep === 3 && matchResult && ...}`
  at `~:3299-3318` (`hidden`, shown via `@media print`) — separate from the four blocks; update it
  when `wizardStep` state is removed or the build breaks.
- Nav footer/validity is duplicated across **4 sites in two renderings**: mobile/sidebar footer
  (`~:2382-2435`) + desktop top progress bar (`~:2438-2484`), each with its own dots + Next
  (`isStepValid(...) || isTestEnv`). `isTestEnv` derived at `~:238`.
- `hasImage`/`hasMatch` **do not exist as state** — derive inline (`!!(image || activeProjectId)`,
  `!!matchResult`).

## Test inventory (must stay green; some imports must move)
| Test file | Lines | Touches |
|---|---|---|
| `src/__tests__/App.test.tsx` | 867 | Full app integration; `#optimize-bags-checkbox`, project fixtures, wizard nav (`< Back`), HUD |
| `src/__tests__/integration.test.tsx` | 794 | End-to-end flows |
| `src/__tests__/print.test.tsx` | 60 | **imports `calculateSafetyPurchase, optimizeBags` from `../App`** — will move (Candidate 1) |
| `src/engine/__tests__/checkout.test.ts` | 166 | dye-lot `optimizeBags`, `calculateCanvasCost`, cart/partner URLs |
| `src/engine/__tests__/viewer.test.ts` | 361 | CanvasViewer |
| `src/engine/__tests__/*` (color, ingest, export, symbols, palette, worker) | — | engine units |

Baseline: **99 tests passing** (`SUMMARY.md`). Any test whose import path moves (e.g. `print.test.tsx`)
must be updated in the same increment that moves the code.

## Verify gates (run after every increment)
```
npx tsc --noEmit      # typecheck
npm test              # vitest run (all green)
npm run build         # tsc && vite build (CI compiler check)
npm run dev           # http://localhost:5173 — visual check for UI-touching increments (2,5)
```
