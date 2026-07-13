---
phase: 15-trustworthy-pricing-data-foundation
plan: 03
subsystem: data-integrity
tags: [data-integrity, drill-variants, integrity-test, allow-list, adjudication, surfacing, preact]

# Dependency graph
requires:
  - phase: 15-trustworthy-pricing-data-foundation
    plan: 02
    provides: hasUnpricedSize surfacing effect + actionError banner pattern in App.tsx (reused for unmapped-color surfacing)
  - phase: 04-supply-planning-customization-exports
    provides: DRILL_VARIANTS SKU table + DMC_PALETTE catalog
provides:
  - engine/__tests__/variants.integrity.test.ts DATA-01 drill-variant integrity guard (5 tests)
  - engine/variants.ts hasVariantMapping(dmcCode, shape) exported pure predicate
  - ALLOWLISTED_SHARED_ID_CODES + ALLOWLISTED_EMPTY_MAPPINGS allow-list constants with adjudicate-TODO notes
  - App.tsx runtime surfacing of grid colors unmapped for the selected drillStyle via the existing actionError banner
affects: [16 optimized supply plan, 17 customer order packet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-drift ratchet test: variantId -> set(dmcCodes) scan asserts unique-or-allow-listed IDs, no empty reachable mappings beyond the allow-list, and full palette coverage — PASSES today and FAILS on any NEW hole"
    - "Safe-reversible-default allow-lists: known holes are explicitly allow-listed with an inline adjudicate-TODO rather than deleted/merged/guessed, so a domain decision can flip them without touching the data"
    - "Surface-never-drop: a grid color with no drills for the selected shape is named in the existing actionError banner (plain JSX text child) instead of silently vanishing from the supply plan"

key-files:
  created:
    - src/engine/__tests__/variants.integrity.test.ts
    - .planning/phases/15-trustworthy-pricing-data-foundation/15-03-SUMMARY.md
  modified:
    - src/engine/variants.ts
    - src/App.tsx

key-decisions:
  - "DATA-01 integrity test allow-lists exactly the three shared-ID pairs (731/732, 781/782, 776/3326) and four empty pairs (471/square, 798/round, BLANC/round, ECRU/round) — a plan-time variantId->set(dmcCodes) scan confirmed these are the complete set (no ID shared by 3+ codes), so the test exits 0 on first run and fails on any new drift"
  - "hasVariantMapping(dmcCode, shape) is a pure predicate returning true only when DRILL_VARIANTS[code]?.[shape] exists and has >=1 key; used to surface unmapped grid colors without touching the data"
  - "DATA-01 checkpoint adjudicated by the data owner (Task 3): both dup-ID pairs KEPT AS INTENDED ALIASES (stay allow-listed, not flagged as bugs); all four empty mappings KEPT SURFACED-AS-UNMAPPED (DRILL_VARIANTS unchanged, no real SKUs supplied) — the safe reversible defaults already in the committed test/code are the finalized decision"
  - "DRILL_VARIANTS data is left unchanged: empty mappings are surfaced to the user, never guessed (locked prohibition honored)"

requirements-completed: [DATA-01]

coverage:
  - id: D1
    description: "Every value in every DRILL_VARIANTS[code][shape] mapping is a positive integer SKU"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "src/engine/__tests__/variants.integrity.test.ts#every drill-variant ID is a positive integer"
        status: pass
    human_judgment: false
  - id: D2
    description: "Variant IDs are unique across DMC codes EXCEPT the allow-listed shared pairs; any NEW duplicate fails the test (data-drift ratchet)"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "src/engine/__tests__/variants.integrity.test.ts#variant IDs are unique except allow-listed shared pairs"
        status: pass
    human_judgment: false
  - id: D3
    description: "No palette color+shape has an empty reachable mapping EXCEPT the allow-listed surfaced-unmapped pairs; any NEW empty mapping fails"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "src/engine/__tests__/variants.integrity.test.ts#no empty reachable mapping beyond the allow-list"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every DMC_PALETTE code has a DRILL_VARIANTS entry with at least one non-empty shape (full palette coverage)"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "src/engine/__tests__/variants.integrity.test.ts#every palette color has a non-empty mapping in at least one shape"
        status: pass
    human_judgment: false
  - id: D5
    description: "A grid color unmapped for the selected drill shape is surfaced via the existing actionError banner (plain text), never silently dropped"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "src/engine/__tests__/variants.integrity.test.ts#hasVariantMapping predicate (471/square=false, 471/round=true, 150/square=true)"
        status: pass
      - kind: integration
        ref: "src/App.tsx effect extends the 15-02 surfacing to flag shape-unmapped grid colors via setActionError — covered by npx tsc --noEmit + npm test"
        status: pass
    human_judgment: false
  - id: D6
    description: "Data-owner adjudication of the allow-listed holes (dup-ID pairs + empty mappings)"
    requirement: DATA-01
    verification:
      - kind: human
        ref: "Task 3 checkpoint:human-verify — data owner confirmed safe reversible defaults (aliases kept allow-listed, empty pairs kept surfaced-as-unmapped)"
        status: pass
    human_judgment: true

# Metrics
duration: 8min
completed: 2026-07-12
status: complete
---

# Phase 15 Plan 03: Drill-Variant Data Integrity & Adjudication Summary

**Shipped the DATA-01 automated integrity guard for the 5,107-line `DRILL_VARIANTS` SKU table (positive-integer SKUs, unique-or-allow-listed IDs, no empty reachable mappings beyond the allow-list, full palette coverage) plus an exported `hasVariantMapping` predicate that surfaces any grid color unmapped for the selected drill shape through the existing `actionError` banner — never silently dropping a color. A blocking data-owner checkpoint adjudicated the known holes: all three duplicate-ID pairs are confirmed intended aliases (kept allow-listed) and all four empty mappings are confirmed surfaced-as-unmapped (data left unchanged), finalizing the safe reversible defaults.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3 (Task 1 test-first guard, Task 2 predicate + surfacing, Task 3 blocking data-owner adjudication)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

### Task 1 — DATA-01 variant-integrity test with grounded allow-lists
- Created `src/engine/__tests__/variants.integrity.test.ts` (5 tests) iterating `DRILL_VARIANTS` against `DMC_PALETTE`. It asserts four properties: (1) every `DRILL_VARIANTS[code][shape]` value is a positive integer (`Number.isInteger(id) && id > 0`); (2) building `variantId -> set(dmcCodes)`, any ID owned by >1 code fails UNLESS the sharing set matches an allow-listed pair (fails on any NEW duplicate); (3) every palette code+shape mapping is non-empty UNLESS the (code, shape) is allow-listed (fails on any NEW empty mapping); (4) every `DMC_PALETTE` code has a `DRILL_VARIANTS` entry with at least one non-empty shape.
- Two allow-list constants, each with the inline `// TODO adjudicate: intended alias vs data bug — confirm with data owner` note: `ALLOWLISTED_SHARED_ID_CODES = [['731','732'], ['781','782'], ['776','3326']]` and `ALLOWLISTED_EMPTY_MAPPINGS = [['471','square'], ['798','round'], ['BLANC','round'], ['ECRU','round']]`. A plan-time scan confirmed these are the complete set (no ID shared by 3+ codes), so the test exits 0 on first run and acts as a forward drift ratchet.
- **Commit `2e800d8`** (test).

### Task 2 — `hasVariantMapping` predicate + unmapped-color surfacing in App.tsx
- Added and exported `hasVariantMapping(dmcCode, shape): boolean` in `src/engine/variants.ts` — returns true only when `DRILL_VARIANTS[dmcCode]?.[shape]` exists and has at least one key (`!!mapping && Object.keys(mapping).length > 0`).
- Extended the 15-02 surfacing effect in `App.tsx` so it also detects grid colors (present in `matchResult.counts`) that are unmapped for the currently selected `drillStyle` via `hasVariantMapping(code, drillStyle) === false`, and names those DMC codes in the existing `actionError` banner as a plain JSX text child (T-15-08 / T-11-07 — never `dangerouslySetInnerHTML`). The `DRILL_VARIANTS` data itself was left unchanged — empty mappings stay surfaced, not guessed (locked decision).
- **Commit `f4a2e7f`** (feat).

### Task 3 — Data-owner adjudication (checkpoint:human-verify, RESOLVED)
- The blocking checkpoint routed the allow-listed holes to the data owner. **Outcome — the SAFE REVERSIBLE DEFAULTS were confirmed for both items:**
  1. **Duplicate variant IDs (731/732, 781/782, 776/3326):** KEPT AS INTENDED ALIASES — they remain in `ALLOWLISTED_SHARED_ID_CODES`, are NOT flagged as data bugs, and require no follow-up data-fix TODO beyond the existing inline adjudicate note.
  2. **Empty shape mappings (471/square, 798/round, BLANC/round, ECRU/round):** KEPT SURFACED-AS-UNMAPPED — `DRILL_VARIANTS` is left UNCHANGED (no real SKUs were supplied), they remain in `ALLOWLISTED_EMPTY_MAPPINGS`, and are surfaced at runtime via the banner.
- **No code or data changes were required for Task 3** — the safe defaults already committed in Tasks 1 & 2 ARE the finalized decision. `variants.ts`, the integrity test, and `App.tsx` were deliberately left untouched.

## Task Commits

1. **Task 1: DATA-01 variant-integrity guard with grounded allow-lists** — `2e800d8` (test)
2. **Task 2: hasVariantMapping predicate; surface shape-unmapped grid colors** — `f4a2e7f` (feat)
3. **Task 3: data-owner adjudication** — no commit (RESOLVED to safe defaults; no code/data change)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md (docs).

## Files Created/Modified

- `src/engine/__tests__/variants.integrity.test.ts` — **created.** 5 tests: positive-integer SKUs, allow-listed-only duplicate IDs, allow-listed-only empty mappings, full palette coverage, plus the `hasVariantMapping` predicate assertions. Two allow-list constants with inline adjudicate-TODO notes.
- `src/engine/variants.ts` — added the exported `hasVariantMapping(dmcCode, shape)` pure predicate. `DRILL_VARIANTS` data unchanged.
- `src/App.tsx` — extended the 15-02 surfacing effect to flag grid colors unmapped for the current `drillStyle` in the existing `actionError` banner (plain text). No second banner added.

## Verification Results

- `npx vitest run src/engine/__tests__/variants.integrity.test.ts` — 5 tests pass (positive-integer SKUs, allow-listed-only dup IDs, allow-listed-only empty mappings, full palette coverage, predicate). Confirmed green on this finalization run.
- `npx tsc --noEmit` — clean, exit 0 (confirmed by the orchestrator at Task 2).
- `npm test` — full suite green at ~203 tests; the variant-integrity file contributes 5 (baseline was 198 after 15-02; +5 = 203). Confirmed by the orchestrator before the checkpoint.
- Regression-guard behavior: temporarily removing one allow-list entry makes the test fail (the drift ratchet), per the plan's acceptance criteria.

## Decisions Made

- The known variant-table holes are handled by explicit allow-listing with safe reversible defaults, never by deleting/merging codes or guessing a mapping — so a domain decision can flip any entry without touching the 5,107-line data table.
- The DATA-01 checkpoint was adjudicated to KEEP the defaults: dup-ID pairs are intended aliases (allow-listed), empty mappings stay surfaced-as-unmapped (data unchanged). No follow-up data-fix TODO is owed.
- Unmapped grid colors are surfaced from the existing effect/banner rather than adding new UI — a minimal wiring change reusing the 15-02 pattern.

## Deviations from Plan

None — plan executed as written. Task 3 was a blocking human-verify checkpoint; the data owner confirmed the safe reversible defaults, so no code or data changes were needed to finalize it.

## Threat Flags

None — no new security surface beyond the planned trust-boundary mitigations: T-15-06 (integrity test allow-lists only known holes and fails on drift; checkpoint routed the holes to the data owner — adjudicated), T-15-07 (unmapped-color label renders as a plain JSX text child, never `dangerouslySetInnerHTML`), T-15-08 (unmapped color surfaced via the banner, never silently dropped). All implemented. No new packages (T-15-SC accept holds).

## Known Stubs

None — the four empty mappings are a deliberate, adjudicated surfaced-as-unmapped condition (a fail-safe signal shown to the user), not a placeholder stub. The data owner confirmed keeping them surfaced.

## Issues Encountered

None during finalization. Tasks 1 & 2 were completed and verified green before the blocking checkpoint; the checkpoint resolved to the safe defaults with no rework.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 15 is complete (3/3 plans): vendor cleanup (15-01), pricing accuracy + integer-cents money (15-02), and drill-variant data integrity (15-03) are all test-guarded before any UI churn.
- The `DRILL_VARIANTS` table is now ratcheted against future drift, and `hasVariantMapping` gives the downstream optimizer (Phase 16) and order packet (Phase 17) a trusted way to detect a color that cannot be physically ordered for a given shape.
- Phase-level verification and `phase.complete` are handled by the orchestrator, not this plan.

## Self-Check: PASSED

- FOUND: `src/engine/__tests__/variants.integrity.test.ts`
- FOUND: `src/engine/variants.ts` (hasVariantMapping exported at L5114)
- FOUND: `src/App.tsx`
- FOUND: `.planning/phases/15-trustworthy-pricing-data-foundation/15-03-SUMMARY.md`
- FOUND: commit `2e800d8` (Task 1 — test)
- FOUND: commit `f4a2e7f` (Task 2 — feat)
- Task 3: RESOLVED to safe defaults — no commit expected (no code/data change)

---
*Phase: 15-trustworthy-pricing-data-foundation*
*Completed: 2026-07-12*
