# Implementation Plan — GemPixel Architecture Deepening

Read alongside [`../design/detailed-design.md`](../design/detailed-design.md) and
[`../research/current-state.md`](../research/current-state.md). Each step is one atomic,
verified-green increment (idea-honing Q2). Strict TDD: write the failing test at the new seam first,
RED→GREEN per behavior — never all-tests-first (idea-honing Q4). Re-grep line anchors before editing
(they drift as steps land).

**Verify gate after every step:** `npx tsc --noEmit` && `npm test` (all green, ≥99) && `npm run
build`. For UI-touching steps (4-C2 partial, 6-C5) also `npm run dev` visual pass. Commit only when
green (Cardinal Rule 4).

## Progress checklist
- [x] **Step 1 — Candidate 1:** Supply Bag Optimizer (`bagPlanner.ts`); estimate == cart. `refactor(supply): deepen bag planning — one packer for estimate and cart`
- [x] **Step 2 — Candidate 4:** `resolveActiveCandidates` resolver (memo deferred — see call-site note; it exposed a dimension-sync render race). `refactor(palette): extract active-candidates resolver`
- [x] **Step 3 — Candidate 3:** `projectStore` persistence module. `refactor(persistence): extract projectStore from App`
- [x] **Step 4 — Candidate 2:** `useDiamondArtMatch` hook (adds a `restore()` seam for project-restore/reset/delete writes). `refactor(match): extract diamond-art match pipeline hook`
- [x] **Step 5 — Candidate 5:** `useWizard` + `Step1..4` components. `refactor(wizard): extract wizard machine and step views`
- [x] **Step 6 — Finalize:** full-suite verify (131 green), build clean, handoff notes in `SUMMARY.md`. Whole-flow covered by integration/App tests (interactive browser pass blocked — extension offline).

> **Ordering note:** the plan runs Candidate 1 first (bug fix), then the *cheapest* extractions
> (C4, then C3) to build confidence, then the pipeline hook (C2), then the riskiest JSX surgery (C5)
> last — a deviation from the design's numeric order that reduces risk. Each step is independent, so
> reordering is safe.

---

## Step 1: Consolidate the Supply Bag Optimizer (Candidate 1 — the bug fix)
**Objective:** One per-color packing primitive (`src/engine/bagPlanner.ts`) that the legend cost
estimate and the Shopify cart both consume, so the estimate always equals what the cart charges
(idea-honing Q1: cart packer is source of truth).

**Guidance:**
1. Create `src/engine/bagPlanner.ts` with `packColor(dmcCode, shape, requiredCount)`,
   `withSafetyMargin(count)`, `priceColorPack(pack, priceDb)`, `planColorSupply(...)` and a
   `defaultPacketCost(type, bagSize)` (moved from `App.tsx:143`). `packColor` must honor the ≤800
   dye-lot rule AND only pack into bag sizes present for that color in `DRILL_VARIANTS[dmcCode][shape]`
   (mirror the availability logic in `checkout.ts:80-104`).
2. Refactor `checkout.ts::compileShopifyCartLink` to build its per-color tokens via `packColor(...)`
   instead of its inline loop. Verify consumers of the aggregate `checkout.ts::optimizeBags(count)`;
   make it a thin wrapper over `packColor` or remove if now unused.
3. In `App.tsx`, replace the `sortedMatches` legend loop's `optimizeBags(count, priceDb)` calls
   (`~:1142-1143`) with `planColorSupply(...)`. Remove App's cost-minimizer `optimizeBags`
   (`:169`). Move `calculateSafetyPurchase`/`getDefaultPacketCost` into `bagPlanner.ts`.

**Tests (write first):** `src/engine/__tests__/bagPlanner.test.ts` — dye-lot boundary (≤800 →
200-only), variant availability (color missing a size is never packed into it), safety margin,
pricing. **Regression:** for a fixture color set, assert summed `planColorSupply` bag counts ==
`compileShopifyCartLink` output (estimate == cart). Update `checkout.test.ts` for any signature
change; repoint/replace `print.test.tsx` imports (currently `from '../App'`).

**Integration:** App legend + Shopify cart now read from one module. **Demo:** load an image, open
Step 3; the per-color "Bags (Opt)" column and the cart the "Add to cart" button builds show the
*same* bag counts for every color (previously they could differ). All tests green.

---

## Step 2: Extract the active-candidates resolver (Candidate 4)
**Objective:** Name the "which colors are in play" concept as a pure `resolveActiveCandidates` and
memoize it, removing a per-render allocation.

**Guidance:** Create `src/engine/candidates.ts` exporting
`resolveActiveCandidates(kit, excluded): DmcColor[]` (DMC_PALETTE filtered by kit, minus excluded).
In `App.tsx` replace the inline `baseCandidates`/`activeCandidates` (`~:563-567`) with a `useMemo`
over the resolver keyed on `[selectedBaseKit, excludedColors]`.

**Tests (write first):** `src/engine/__tests__/candidates.test.ts` — kit filters ('all'/'100'/'200'),
exclusion removal, empty-set identity.

**Integration:** all downstream consumers (matcher, `matchResult`, `symbolMap`, legend split) now
read the memoized value unchanged. **Demo:** switching kit / excluding a color updates the grid
exactly as before; React DevTools shows `activeCandidates` no longer recomputed on unrelated
renders. All tests green.

---

## Step 3: Extract the projectStore persistence module (Candidate 3)
**Objective:** Move all `localStorage` persistence + quota eviction out of `App.tsx` into
`src/engine/projectStore.ts` behind a small CRUD interface.

**Guidance:** Move `ProjectSummary`/`ProjectData` (`App.tsx:12,20`), `generateUUID`,
`generateThumbnail`, `saveProjectToStorage`/`loadProjectFromStorage`/`deleteProjectFromStorage`
(`:42-114`) and the recents quota-eviction effect (~`:601`) into the module. Expose
`projectStore.{list,load,save,remove,recents}` + `generateUUID`/`generateThumbnail`. Repoint App
callers (`handleSaveProject` `:495`, load path `:432`, recents effects). **Do not change storage
keys or the serialized shape** (preserves existing saved projects).

**Tests (write first):** `src/engine/__tests__/projectStore.test.ts` — save→list→load round-trip;
delete; recents FIFO; quota eviction via a stubbed `localStorage` throwing `QuotaExceededError`.

**Integration:** App uses `projectStore.*`. **Demo:** save a project, reload the page, reopen it from
the drawer; recents list still caps and evicts oldest. All tests (incl. `App.test.tsx` project
fixtures) green.

---

## Step 4: Extract the match pipeline hook (Candidate 2)
**Objective:** Move the image→grid pipeline + worker lifecycle into
`src/features/match/useDiamondArtMatch.ts`; App consumes `{matchResult, symbolMap, loading,
progress}`.

**Guidance:** Create `src/features/` if absent (see design §3 note). The hook owns `MatcherClient`
init/teardown (`App.tsx:558,618-625`), the `match(...)` dispatch (`:893`), `rawMatchResult`,
`loading`/`progress`, and the `matchResult` (`substituteLowCountColors`) + `symbolMap`
(`generateSymbolAllocation`) memos (`:569-590`). Inputs: `{image, cols, rows, activeCandidates,
enableSubstitution, substitutionThreshold}`. App keeps the viewer-feed effect (`:651-669`) and the
legend split. Preserve abort-on-new-input and cache-hash reuse.

**Tests (write first):** `src/features/match/__tests__/useDiamondArtMatch.test.ts` — mock
`MatcherClient` (pattern: `App.test.tsx` already mocks `CanvasViewer`); assert progress→result flow,
substitution toggle changes `matchResult`, symbolMap regenerates, unmount calls `terminate`.

**Integration:** App renders from the hook's signals. **Demo:** load an image → progress bar advances
→ grid renders; toggle "reduce colors" substitution and the grid + counts update; no worker leak on
unmount. `App.test.tsx`/`integration.test.tsx` green. Visual pass via `npm run dev`.

---

## Step 5: Extract the wizard machine + step views (Candidate 5 — full extraction)
**Objective:** `src/features/wizard/useWizard.ts` (step/validity/transitions) plus four pure step
components `Step1Ingest`…`Step4Export`.

**Guidance:** Create `useWizard({hasImage, hasMatch, isTestEnv})` returning `{step, canEnter, next,
back, goTo, reset}`; make `canEnter` the single source replacing the duplicated dot/button checks
(`App.tsx:417`, `:2382-2480`). Extract each inline block (`:1370/1693/1908/2238`) into a pure
component under `src/features/wizard/steps/`, passing needed values/handlers as props (no local
`useState` mirroring engine state). App renders `{wizard.step === n && <StepN .../>}` and the footer
reads `wizard.canEnter(n)`. Move one step at a time, verifying green between each, to keep the diff
reviewable.

**Tests (write first):** `src/features/wizard/__tests__/useWizard.test.ts` — transitions, `canEnter`
gating (no match → can't reach steps 3/4), `isTestEnv` bypass. Step components covered by existing
integration tests staying green.

**Integration:** App is now a thin coordinator composing five modules. **Demo:** click through all
four steps; Back/Next and the progress dots enable/disable identically to before; steps 3-4 remain
locked until a match exists. Full suite green + `npm run dev` visual pass across all four steps.

---

## Step 6: Finalize and hand off
**Objective:** Confirm the whole effort is clean and leave a trail for the next agent.

**Guidance:** Run the full verify gate once more; do a `npm run dev` pass over the whole flow
(ingest → palette → canvas/pricing → export/cart). Update this checklist. Note in a short handoff
(e.g. append to `summary.md`) any deviations, the new module map, and confirmation that estimate ==
cart. **Demo:** `App.tsx` is materially smaller; five named modules each have their own tests; 99+
tests green; build passes.
