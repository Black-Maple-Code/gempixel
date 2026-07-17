---
phase: 22-additive-engine-density-color-reducer-single-source-quote
verified: 2026-07-14T00:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 22: Additive Engine — Density, Color Reducer, Single-Source Quote Verification Report

**Phase Goal:** The engine exposes the real detected color count, a deterministic target-N color reducer, and one integer-cents quote selector — so every inch figure and every total in the app has a single, non-divergent source, landed in isolated engine-only commits.
**Verified:** 2026-07-14
**Status:** passed
**Re-verification:** No — initial verification (code review CR-01/WR-01/WR-02/IN-01 already resolved in commit fc5a2bf)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | QUOTE-01 — a single 2.5mm/dot density source exists, reconciled with the app's `/10`; no second density path, no hard-coded mock inch labels | ✓ VERIFIED | `src/engine/density.ts` exports `DOTS_PER_INCH=10`, `MM_PER_DOT=2.5`, `gridToInches`, `formatInches`. `gridToInches(cols,rows).widthIn === cols/10` (byte-identical to `calculateCanvasCost` grid→/10). No `10.16` constant; no cm/inch branch. `density.test.ts` asserts reconciliation with `calculateCanvasCost` + NaN guard + 1-dp rounding. |
| 2 | QUOTE-02 — `buildOrderQuote` produces one integer-cents total via `money.ts` where line items sum EXACTLY to the total, with a test asserting it | ✓ VERIFIED | `src/engine/quote.ts:134-139` returns `totalCents: sumCents(lineItems.map(li => li.cents))` — line-sum by construction. All four lines routed through `toCents`. Drills consumed from `optimizedCostCents` (no re-pack). `quote.test.ts:34` "LINE-SUM EQUALITY" asserts `totalCents === sumCents(...)` across fixtures; integer-cents boundary test confirms no float leak. |
| 3 | QUOTE-03 — tax = $0 labeled "calculated at vendor checkout"; combined shipping carries a dated RATES_AS_OF provenance; figures labeled estimates | ✓ VERIFIED | `quote.ts` tax line = 0 cents, note "calculated at vendor checkout", `TAX_RATE_ESTIMATE=0`. One "Shipping (est.)" line = `baseShipping + DRILLS_BASE_SHIPPING`, note `rates as of ${RATES_AS_OF}` (`RATES_AS_OF='2026-07-14'` in checkout.ts). canvas/shipping/tax `estimate: true`. Asserted in `quote.test.ts:57,71`. |
| 4 | SC4 engine support — `detectedColorCount` raw-keyed & stable; `reduceToColorCount` deterministic, Delta-E-guarded (absolute veto, skip-and-continue, targetN ceiling), lowest-DMC tie-break; CR-01 chain-bound fix + chaining regression test | ✓ VERIFIED | `useDiamondArtMatch.ts:241-244` derives `detectedColorCount` in a useMemo keyed ONLY on `[rawMatchResult]`. `color.ts:265-409` `reduceToColorCount`: sorts by `compareDmcCode` every pass (no Object.keys dependence), absolute guard veto with skip-and-continue, targetN ceiling, exact-distance tie-break. CR-01 fix present: `cluster` map bounds every original→destination shift (`rareCluster.every(...) <= guard`, lines 359-366). `color.test.ts:401` "MERGE CHAIN (CR-01 regression)" is a genuine chaining fixture (endpoints >guard, adjacent hops ≤guard) that fails under a per-hop-only guard. Behavioral: full suite green. |
| 5 | SC5 strangler — engine changes ADDITIVE only, quote.ts NOT wired into App.tsx, reduce no-op by default (App byte-identical), zero new dependencies, full suite green (325), tsc 0 | ✓ VERIFIED | Phase touched only `engine/*` + match hook + tests (no App.tsx, no package.json in diff `0a7c067^..39cebe1`). `grep engine/quote src/App.tsx` → no matches. Reduce gated behind `enableReduce && Number.isFinite(targetColorCount)` — not called on default path (`useDiamondArtMatch.ts:271`). checkout.ts diff additive-only; export.ts/viewer.ts diffs are comment-only deletions. `npx tsc --noEmit` exit 0; `npx vitest run` 325 passed / 30 files exit 0. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/engine/density.ts` | Single density source | ✓ VERIFIED | Exports constants + gridToInches + formatInches (IN-01 non-finite guard applied) |
| `src/engine/quote.ts` | Integer-cents quote selector | ✓ VERIFIED | buildOrderQuote, OrderQuote, QuoteLineItem, TAX_RATE_ESTIMATE; WR-01 normalizeVendor + WR-02 taxable-base guard applied |
| `src/engine/checkout.ts` | +DRILLS_BASE_SHIPPING, +RATES_AS_OF | ✓ VERIFIED | Purely additive (lines 162/171); VENDOR_REGISTRY/calculateCanvasCost/normalizeVendor unchanged |
| `src/engine/color.ts` | reduceToColorCount + MERGE_GUARD_DELTA_E + compareDmcCode | ✓ VERIFIED | Additive; existing exports byte-unchanged; CR-01 cluster-guard implemented |
| `src/features/match/useDiamondArtMatch.ts` | detectedColorCount + gated reduce | ✓ VERIFIED | detectedColorCount raw-keyed; optional enableReduce/targetColorCount; reduce last & gated |
| Test suites (density/quote/color/hook) | Behavioral coverage | ✓ VERIFIED | 4 test files present; genuine CR-01 chaining regression; all green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| density.ts DOTS_PER_INCH | checkout.ts /10 | reconciliation test | ✓ WIRED | density.test.ts binds gridToInches to calculateCanvasCost's /10 |
| quote.ts | money.ts | toCents/sumCents | ✓ WIRED | all money routed through money.ts; total is sumCents by construction |
| quote.ts | App.tsx | (intentionally NOT wired) | ✓ CORRECT | additive this phase; wiring is Phase 23 (SC5) |
| useDiamondArtMatch reduce step | color.ts reduceToColorCount | gated import | ✓ WIRED (dormant) | imported & called only under enableReduce guard; no-op default |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck strict | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite | `npx vitest run` | 325 passed / 30 files, exit 0 | ✓ PASS |
| quote not wired | `grep engine/quote src/App.tsx` | no matches | ✓ PASS |
| CR-01 chain bound | reducer chaining regression test | max original→final shift ≤ guard | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUOTE-01 | 22-01 | One density helper (2.5mm/dot); no hard-coded inch labels | ✓ SATISFIED | density.ts single source, reconciled with /10 |
| QUOTE-02 | 22-02 | Quote in one place, integer cents via money.ts; line-sum === total | ✓ SATISFIED | quote.ts line-sum by construction + test |
| QUOTE-03 | 22-02 | Estimates labeled with dated "rates as of" provenance | ✓ SATISFIED | tax $0 label + RATES_AS_OF shipping/canvas notes |
| REFINE-04 (engine support only) | 22-03, 22-04 | detectedColorCount + reduceToColorCount engine primitives | ✓ SATISFIED (engine portion) | Per phase scope, UI wiring is Phase 23 by design; engine primitives landed + tested. Not failed for being unwired (explicit scope note). |

All three phase-owned requirement IDs (QUOTE-01/02/03) are SATISFIED and marked Complete in REQUIREMENTS.md. REFINE-04's engine support is delivered here; its UI wiring belongs to Phase 23 (REQUIREMENTS.md maps REFINE-04→Phase 23). No orphaned requirements for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No debt markers (TBD/FIXME/XXX) in phase-modified files | ℹ️ Info | Prior code review CR-01/WR-01/WR-02/IN-01 all resolved in commit fc5a2bf; IN-02 accepted with rationale |

### Human Verification Required

None. Every behavior-dependent truth (reducer determinism, guard veto, chain-bound original→final shift, detectedColorCount stability under post-process) is exercised by a passing behavioral test in the green suite — no invariant rests on symbol presence alone.

### Gaps Summary

No gaps. The phase goal is achieved: a single reconciled density source (QUOTE-01), one integer-cents quote selector whose line items sum to the total by construction (QUOTE-02), tax/shipping labeled estimates with dated provenance (QUOTE-03), and the deterministic Delta-E-guarded reducer + raw-keyed detectedColorCount engine support (SC4). The strangler discipline holds (SC5): additive engine-only commits, quote.ts unwired, reduce a no-op on the default path with App.tsx byte-identical, zero new dependencies, tsc 0, and 325 tests green. The one code-review Critical (CR-01 chain displacement) is genuinely fixed with a cluster-based whole-chain guard and a real chaining regression test that fails without the fix.

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_
