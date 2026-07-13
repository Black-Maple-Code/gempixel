---
phase: 16-optimized-supply-plan-savings
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/engine/bagPlanner.ts
  - src/App.tsx
  - src/features/wizard/steps/Step2Palette.tsx
  - src/features/wizard/steps/Step3Canvas.tsx
  - src/index.css
  - src/engine/__tests__/bagPlanner.test.ts
  - src/engine/__tests__/checkout.test.ts
  - src/__tests__/App.test.tsx
  - src/__tests__/print.test.tsx
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-07-12
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 16 rewrote the bulk-bag optimizer (`minCostBulk`: fewest-bags-within-overshoot-cap),
added `naiveColorPack` + `planOrderSupply`, moved money math onto integer-cents `money.ts`,
retired the fixed-bag toggle, and added the savings headline, the "Why these bags?" a11y
expander, and a print-only supply report.

The core engine work is solid: the overshoot-cap comparator (`isBetter`) is a genuine total
order over distinct candidates (packets → cents → covered → lexicographic largest-first), so
`packColor` is deterministic and order-independent regardless of `priceDb` key insertion order.
The savings clamp is correct, the divide-by-zero on `savingsPct` is guarded, and unpriced-only
colors contribute $0 to both totals apples-to-apples. The two print-mode CSS blocks
(`print-only-legend-mode` / `print-only-report-mode`) are correctly isolated — each reveals only
its own container with `!important` over Tailwind `hidden`, and hides the other artifact.

However, moving the grand total onto `toCents()` — which throws on non-finite input by design —
introduced a **render-path crash** for non-finite canvas price inputs (CR-01). Two refactor
side-effects also degrade correctness: a project's persisted per-bag prices are silently
clobbered on load when the drill type differs (WR-01), and the footer packet label still says
"200-ct" although the optimizer now emits mixed bag sizes (WR-02).

## Structural Findings (fallow)

No `<structural_findings>` block was supplied with this review; none to normalize.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Non-finite canvas price crashes the whole app in the render path

**File:** `src/App.tsx:1028-1029` (also `1030-1031`); input at `src/features/wizard/steps/Step3Canvas.tsx:123,134`

`money.ts::toCents` deliberately throws `RangeError` on any non-finite input (NaN/±Infinity).
The grand total is computed unconditionally in the component body:

```ts
const totalCostSafetyCents =
  toCents(canvasBaseCost) + toCents(canvasShippingEstimate) + safetyDrillCostCents;
```

`canvasBaseCost` / `canvasShippingEstimate` are populated from the number inputs via
`parseFloat((e.target).value) || 0`. The `|| 0` guard only catches `NaN` — it does **not** catch
`Infinity`. A `<input type="number">` accepts scientific/oversized notation, so entering
`1e999` (or a ~400-digit number) yields `parseFloat(...) === Infinity`, `Infinity || 0 === Infinity`,
and the next render calls `toCents(Infinity)`, which throws. Because this is in the render body
(not an event handler), the throw propagates through Preact and white-screens the app. A tampered
or imported project whose `kitBaseCost` is non-finite / a string reaches the same line via
`loadProject` (`setCanvasBaseCost(project.kitBaseCost ?? 15.0)`), since `??` only guards
null/undefined. Pre-Phase-16 float math did not throw, so this is a regression.

**Fix:** sanitize before the state ever holds a non-finite value, and/or clamp at the total:

```ts
// in the onInput handlers
const parsed = parseFloat((e.target as HTMLInputElement).value);
setCanvasBaseCost(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);

// defensive at the total (belt-and-suspenders; loadProject path)
const safeDollars = (n: number) => (Number.isFinite(n) ? n : 0);
const totalCostSafetyCents =
  toCents(safeDollars(canvasBaseCost)) + toCents(safeDollars(canvasShippingEstimate)) + safetyDrillCostCents;
```

## Warnings

### WR-01: Restoring a saved project silently clobbers its persisted per-bag prices

**File:** `src/App.tsx:596-607` (effect) vs `304-306` (loadProject restore)

`loadProject` restores the saved `priceDb` (`if (project.pricesPerBagSize) setPriceDb(...)`) and
also restores `drillType` (`setDrillType(project.drillType)`). But the effect keyed on
`[drillType, drillBagSize]` unconditionally overwrites `priceDb` with the drill-type default preset:

```ts
useEffect(() => {
  setDrillPacketCost(defaultPacketCost(drillType, drillBagSize));
  if (drillType === 'standard') setPriceDb({ 200: 0.60, ... });
  else if (drillType === 'ab') setPriceDb({ ... });
  // ...
}, [drillType, drillBagSize]);
```

When the loaded project's `drillType` differs from the currently active one, this effect fires
after commit and replaces the just-restored custom prices with the type defaults — defeating the
intent of persisting `pricesPerBagSize` and feeding wrong numbers into `planOrderSupply`
(the whole point of the milestone is pricing accuracy). It is untested because
`print.test.tsx` seeds a project with `drillType: 'standard'`, matching the default, so the effect
never fires. (The same effect also wipes a user's manually edited prices whenever they change the
drill-type selector, which may be intended but is worth confirming.)

**Fix:** skip the preset reset when the change originates from a load — e.g. gate on a ref that
`loadProject` sets, or only apply the type preset on an explicit user-initiated `drillType` change,
not on the restore path. Minimal version:

```ts
const skipPresetRef = useRef(false);
// in loadProject, before setDrillType/setPriceDb: skipPresetRef.current = true;
useEffect(() => {
  if (skipPresetRef.current) { skipPresetRef.current = false; return; }
  // ...existing preset logic
}, [drillType, drillBagSize]);
```

### WR-02: Footer packet label hardcodes "200-ct" but the optimizer emits mixed bag sizes

**File:** `src/App.tsx:2024`

```tsx
<span className="text-muted uppercase tracking-wider">Packets ({drillBagSize}-ct)</span>
<span className="font-bold text-ink">{totalPackets}</span>
```

`drillBagSize` is now permanently `200` (the fixed-bag controls were retired in this phase), but
`totalPackets` is `orderPlan.totalPackets` — the sum of per-color SAFETY packets across mixed bag
sizes (200/500/1000/2000). A color packed into a single 2000 bag counts as one packet, so the label
"Packets (200-ct): N" misrepresents what N means and understates the drills those packets contain.

**Fix:** drop the bag-size qualifier now that packs are heterogeneous, e.g. `Packets (mixed sizes)`
or just `Bags`, and let the per-row `bagsText` carry the size detail. Remove the now-meaningless
`{drillBagSize}` interpolation.

## Info

### IN-01: Vestigial state and dead production code after retiring fixed-bag mode

**File:** `src/App.tsx:82` (`calculateFixedBagCost`), `211/291/389/597` (`drillPacketCost`), `212/342/597/607/2024` (`drillBagSize`)

With the optimize toggle and fixed-bag controls removed, `calculateFixedBagCost` is no longer
called from any production render path (only from `print.test.tsx`), and `drillPacketCost` is now
write-only in the UI — it is set by the effect and persisted, but no displayed cost consumes it
(costs now come from `priceDb` via `planOrderSupply`). `drillBagSize` is effectively a constant
200. Consider removing or clearly marking these as legacy to avoid future confusion about which
pricing path is authoritative.

### IN-02: `aria-controls` points at an element that does not exist while collapsed

**File:** `src/features/wizard/steps/Step3Canvas.tsx:246,252-259`

The "Why these bags?" button sets `aria-controls="why-these-bags-explainer"`, but the referenced
`<p id="why-these-bags-explainer">` is only rendered when `whyOpen` is true (conditional `&&`). When
collapsed (the default), `aria-controls` references a missing id — a minor a11y/validation nit that
some assistive tech and linters flag. Otherwise the contract is good (real `type="button"`,
`aria-expanded` bound to state, arrow `aria-hidden`, focus-visible ring). Consider always rendering
the region and toggling with `hidden`/CSS, or omitting `aria-controls` until it exists.

### IN-03: `OrderSupplyPlan.rows` doc says "input order" but is numeric-ascending for DMC keys

**File:** `src/engine/bagPlanner.ts:461` (and 490); test acknowledges at `bagPlanner.test.ts:426-435`

`planOrderSupply` iterates `Object.entries(counts)`. For integer-like string keys (DMC codes),
JS enumerates in ascending numeric order, not insertion order — so `rows` is always numeric-ascending,
never the caller's insertion order, contradicting the "input order, unsorted" comment. Harmless today
(the UI re-sorts and the print report consumes the sorted `sortedMatches`), but the comment is
misleading. Reword to "keys in JS object-iteration order (numeric-ascending for DMC codes)".

### IN-04: Savings headline can read "Save $0.0X (0%)" when the percentage rounds to zero

**File:** `src/App.tsx:1039-1042`

The `savingsCents > 0` branch renders `Save ${formatUSD(...)} (${savingsPct}%)`. When savings is a
few cents against a large naive total, `savingsPct = Math.round(smallFraction)` rounds to `0`,
producing a truthful-but-jarring "Save $0.05 (0%) vs per-color". Cosmetic only; consider suppressing
the percentage (or flooring it to 1%) when it rounds to 0 while dollars are non-zero.

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
