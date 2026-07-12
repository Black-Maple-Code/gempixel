---
review: GemPixel maintenance code review (whole-codebase, milestone v2.0 complete)
reviewed: 2026-07-12
depth: deep
method: 3 parallel gsd-code-reviewer agents (engine-core / worker-data-commerce / ui-features)
files_reviewed: 21
excluded_from_line_review:
  - src/engine/variants.ts (≈5,100 lines generated data — integrity spot-checked only)
  - src/engine/palette.ts (≈4,060 lines generated data — integrity spot-checked only)
findings:
  critical: 4
  warning: 10
  info: 18
  total: 32
status: issues_found
part_reports:
  - .planning/codebase/REVIEW-engine.md
  - .planning/codebase/REVIEW-worker-data.md
  - .planning/codebase/REVIEW-ui.md
---

# GemPixel — Maintenance Code Review (consolidated)

**Date:** 2026-07-12
**Scope:** Whole codebase (21 logic/UI files at deep depth; the two ~5k/4k-line generated
data tables integrity-checked, not line-reviewed).
**Method:** Three parallel `gsd-code-reviewer` agents, seeded with the CONCERNS map to
verify/extend rather than rediscover. Full per-finding detail and fix snippets live in the
three linked part reports; this file is the consolidated, de-duplicated index.

> **Deduplication note:** the "worker error → stuck loading" bug was independently reported by
> both the UI cluster (CR-01) and the worker/data cluster (WR-01). It is counted **once** here
> as a blocker (B1). Raw per-cluster totals were 4 critical / 11 warning / 18 info; after
> merging that duplicate the codebase has **4 distinct blockers / 10 warnings / 18 info**.

## Verdict

The codebase is **fundamentally sound** — build clean, 140 tests passing, correct CIEDE2000
color math, a genuinely correct bag-packing search, and a well-sliced engine. But the review
found **4 blocker-class defects**, three of which strike the product's core promises
(accurate chart, accurate supply counts, don't-lose-my-work) and one of which can strand the
whole UI. None are visible to the passing test suite. These should be fixed before any new
feature milestone.

## Blockers (Critical)

| ID | Bug | Impact | Files |
|----|-----|--------|-------|
| **B1** | Worker `kind:'error'` is only `console.error`'d; `setLoading(false)` is unreachable on failure and there is no `worker.onerror`. | Any worker-side error strands the loading overlay **forever** (reload-only recovery). Core function (viewing the chart) blocked. | `worker-client.ts:36-38`, `useDiamondArtMatch.ts:100-128`, `matcher.worker.ts:22-24` |
| **B2** | Abort is a shared module boolean reset by the *next* `match()`, so an in-flight run never aborts; its stale, **wrong-dimension** `matches` array is delivered to the newest callback and fed into `smoothMatches(matches, cols, rows)` at the current dims. | Silent grid corruption + wrong supply counts on rapid slider/palette changes. Data-integrity bug, not a cosmetic race. | `matcher.worker.ts:10,17-18,50-52`, `worker-client.ts:22-39` |
| **B3** | `projectStore.save()` silently evicts the oldest project on `QuotaExceededError` — no return value, no throw, no warning. | **Unannounced permanent data loss** of a saved commission. Realistic (grids are large). | `projectStore.ts:107-133` |
| **B4** | Symbol pool is 82 glyphs but allocation does `index % 82`, so >82 active colors (normal for the **200-color kit**) assign **duplicate symbols to distinct DMC codes**. | Exported chart/legend is ambiguous and un-stitchable — a defect in the tool's core deliverable. | `symbols.ts:75-77` (pool `:32-36`) |

## Warnings

| ID | Issue | Files |
|----|-------|-------|
| W1 | Saved custom canvas price is clobbered on load — the cost-recompute effect fires after `loadProject` and overwrites the restored `kitBaseCost`. | `App.tsx:266` vs `:214-227` |
| W2 | Saved grids are re-run through substitution+smoothing on load using the session's **current** global toggles (which load doesn't restore) → reloaded chart differs from what was saved. | `App.tsx:280-292`, `useDiamondArtMatch.ts:130-162` |
| W3 | localStorage reads happen in render-phase `useState` initializers **unguarded** (only `theme`/`unmappedLog` are wrapped). Storage-blocked/private-mode browser **crashes on mount** — acute for a privacy-first app. | `App.tsx:129,134,139,144,157,161,165,169,189,192,195,203,207,211` |
| W4 | `JSON.parse(localStorage…)` in the checkout click handler is unguarded → corrupted value throws and "Buy Supplies" silently does nothing. | `App.tsx:999` |
| W5 | No user-facing error surface anywhere — every failure is `console.error`. Compounds B1/W4. | `App.tsx:867,892`, `useDiamondArtMatch.ts:122-123` |
| W6 | `defaultPacketCost` has no `500` branch; 500-count bags fall through to a dead "5000" tier and are priced **higher** than 2000-count bags. | `bagPlanner.ts:199-226` |
| W7 | Missing `priceDb` entry is treated as `$0` in cost-minimization/pricing, so an unpriced size looks free and is chosen as "cheapest." | `bagPlanner.ts:89,99,150-155` |
| W8 | Image decode + box-sampling run **synchronously on the main thread** before the worker handoff (up to ~4M px), janking the UI on every match trigger. Confirms the map's perf concern. | `useDiamondArtMatch.ts:108-109`, `ingest.ts:75` |
| W9 | `generateUUID` uses `Math.random()` (not `crypto.randomUUID()`); the id is the storage key, so a collision overwrites another project. | `projectStore.ts:53-59` |
| W10 | `compileCanvasPartnerUrl` validates with `new URL()` but only logs on failure and still returns the string; `new URL()` accepts `javascript:`/`data:`. **Latent** — the function is currently never called from the app. | `checkout.ts:86-103` |

## Info (18) — themes

Full list in the part reports. Grouped:

- **Confirmed debt from the map:** `App.tsx` God component (2,251 lines / 52 `useState` / 18
  `useEffect`) [UI IN-07]; ~7 duplicated persisted-setting read/write pairs → extract
  `usePersistentState` [UI IN-01]; both fixed centrally by the same hook that fixes W3.
- **Latent silent-corruption paths:** gridData round-trip maps unknown codes to black `310`
  [UI IN-03]; `substitutionThreshold` lazy-init can yield `NaN` [UI IN-05]; `matchCache`
  correctness depends on external `paletteHash` [engine IN-01]; `getContrastColor` silently
  accepts malformed hex [engine IN-02].
- **Robustness nits:** export canvas has no dimension cap vs browser limits [engine IN-04];
  `printLegendSheetOnly` can leak an `afterprint` listener on a cancelled dialog [UI IN-06];
  UA-sniffing (`jsdom`) test bypass ships in prod [UI IN-08]; dimension-sync double-source-of-
  truth drift [UI IN-09]; zoom-clamp floor mismatch [engine IN-05]; redundant rounding
  [engine IN-06]; `clearCache` name shadowing in worker [worker IN-01].
- **Dead/unfinished code:** `compileCanvasPartnerUrl` + `canvasTemplate` are persisted but
  never compiled into a link [worker IN-02] — finish the partner flow (with W10's fix) or
  remove it.

## Data-integrity spot-check (generated tables)

- `variants.ts`: 449 DMC keys, **no duplicates**, no null IDs; **4 entries have empty
  `"round": {}`** (handled as unmapped → those 4 round drills silently produce no cart line).
- `palette.ts`: 250 entries, no duplicate `dmc` codes; `palette.test.ts` validates it well.
- **Gap:** there is **no structural test for `variants.ts`** (no assertion of variant-ID
  uniqueness, shape completeness, or that every palette DMC has a mapping). Recommended.

## Recommended remediation order

1. **B1 + W5** together — add an `onError` seam through `match()` + `worker.onerror`, clear
   loading, and introduce a minimal error banner. (One small, high-leverage change.)
2. **B2** — per-run monotonic id; ignore superseded messages on both worker and client sides.
3. **B3 (+W9)** — return a status from `save()` instead of silent eviction; switch to
   `crypto.randomUUID()`.
4. **B4** — deterministic symbol overflow (two-char glyphs) or cap symbol-bearing colors.
5. **W1/W2** — fix the project load path (guard the cost recompute; bypass post-processing for
   restored grids and/or persist the four toggles).
6. **W3** — centralize storage access in a guarded `usePersistentState` (also kills IN-01 debt).
7. **W6/W7** — pricing correctness in `bagPlanner`; add the `variants.ts` integrity test.
8. Backlog: W8 (move decode into worker), W10 (finish or delete partner flow), God-component
   extraction.

---

_Consolidated by orchestrator from 3 deep gsd-code-reviewer passes. See part reports for
per-finding failure scenarios and ready-to-apply fix snippets._
