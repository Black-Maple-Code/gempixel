---
phase: 15-trustworthy-pricing-data-foundation
plan: 01
subsystem: payments
tags: [pricing, vendor, canvas, typescript, migration, preact]

# Dependency graph
requires:
  - phase: 05-supply-partnerships-checkout
    provides: VENDOR_REGISTRY, calculateCanvasCost, Step3Canvas vendor dropdown
  - phase: 11-storage-robustness
    provides: projectStore ProjectData persisted shape (frozen/additive discipline)
provides:
  - Narrowed CanvasVendor union ('lumaprints' | 'finerworks'), Prodigi removed
  - normalizeVendor(raw) load-time migration for legacy/tampered persisted vendors
  - calculateCanvasCost guarded to number | null (unknown vendor -> null, never $0)
  - ProjectData.selectedVendor optional persisted field
affects: [15-02 pricing accuracy, 16 optimized supply plan, 17 order packet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Narrow string-literal vendor union kept exhaustive (never widened to string) so tsc guards every consumer"
    - "Null-guard on money math: unknown/removed keys return null and callers skip the setter rather than writing $0"
    - "Read-time normalize-on-load migration for persisted enums (additive optional field, non-destructive)"

key-files:
  created:
    - .planning/phases/15-trustworthy-pricing-data-foundation/15-01-SUMMARY.md
  modified:
    - src/engine/checkout.ts
    - src/engine/__tests__/checkout.test.ts
    - src/engine/projectStore.ts
    - src/App.tsx
    - src/features/wizard/steps/Step3Canvas.tsx

key-decisions:
  - "Removed Prodigi as a canvas vendor; CanvasVendor union narrowed to 'lumaprints' | 'finerworks'"
  - "calculateCanvasCost returns number | null; unknown vendor -> null (never 0.0) so a removed/tampered vendor cannot yield a free $0 canvas"
  - "normalizeVendor maps any non-{lumaprints,finerworks} value (legacy 'prodigi', undefined, tampered) to 'lumaprints' at load time"
  - "selectedVendor persisted as an OPTIONAL ProjectData field so existing saved blobs keep loading (frozen-shape discipline)"

patterns-established:
  - "Exhaustive narrow-union enum: type CanvasVendor drives Record<CanvasVendor, VendorConfig>, function params, and props so tsc surfaces every stray reference"
  - "Money null-guard: pricing engine returns null for out-of-domain input; UI effect skips the state setter on null"

requirements-completed: [VENDOR-02]

coverage:
  - id: D1
    description: "Only Lumaprints and FinerWorks are selectable canvas vendors (Prodigi option removed from the dropdown)"
    requirement: VENDOR-02
    verification:
      - kind: unit
        ref: "src/engine/__tests__/checkout.test.ts#passes valid vendors through unchanged"
        status: pass
      - kind: manual_procedural
        ref: "Step3Canvas.tsx canvas-print-partner <select> now renders only lumaprints + finerworks <option>s"
        status: pass
    human_judgment: false
  - id: D2
    description: "calculateCanvasCost returns null (not 0.0) for any vendor outside the narrowed union"
    requirement: VENDOR-02
    verification:
      - kind: unit
        ref: "src/engine/__tests__/checkout.test.ts#returns null (never 0) for a vendor outside the narrowed union"
        status: pass
    human_judgment: false
  - id: D3
    description: "A restored/tampered project carrying selectedVendor:'prodigi' (or any unknown string) opens on 'lumaprints' via normalizeVendor and shows a real non-$0 canvas price"
    requirement: VENDOR-02
    verification:
      - kind: unit
        ref: "src/engine/__tests__/checkout.test.ts#migrates legacy and tampered vendor values to lumaprints"
        status: pass
      - kind: integration
        ref: "App.tsx loadProject runs restored vendor through normalizeVendor before setSelectedVendor; canvas-cost effect skips setCanvasBaseCost on null — covered by npm test (181 passing)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The vendor type union is CanvasVendor everywhere (checkout.ts, App.tsx, Step3Canvas.tsx, projectStore.ts) and tsc is clean"
    requirement: VENDOR-02
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-12
status: complete
---

# Phase 15 Plan 01: Vendor Cleanup & Null-Guarded Canvas Cost Summary

**Removed Prodigi as a canvas vendor, narrowed the vendor type to `CanvasVendor = 'lumaprints' | 'finerworks'` everywhere, guarded `calculateCanvasCost` to `number | null` so a removed/tampered vendor can never yield a free $0 canvas, and added a `normalizeVendor` load-time migration that remaps any persisted legacy/unknown vendor to `lumaprints`.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-12T17:52:00Z (approx)
- **Completed:** 2026-07-12T17:55:00Z (approx)
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `CanvasVendor` union (`'lumaprints' | 'finerworks'`) exported from checkout.ts; Prodigi removed from `VENDOR_REGISTRY` (now `Record<CanvasVendor, VendorConfig>`).
- `calculateCanvasCost` retyped to `number | null`; the unknown-vendor branch returns `null` instead of `0.0` (Pitfall 7 / threat T-15-01 fix).
- `normalizeVendor(raw: unknown): CanvasVendor` added — maps `'lumaprints'`/`'finerworks'` through unchanged and every other value (legacy `'prodigi'`, `undefined`, tampered strings) to `'lumaprints'` (threat T-15-02).
- `ProjectData.selectedVendor?: CanvasVendor` added as an additive optional field; save assembly persists it; load path runs the restored value through `normalizeVendor` before `setSelectedVendor`.
- App.tsx canvas-cost effect now skips `setCanvasBaseCost` when the cost is `null` (never writes a $0 base cost on the guard).
- Step3Canvas dropdown offers only Lumaprints + FinerWorks (Prodigi `<option>` deleted); props retyped to `CanvasVendor`.
- checkout tests updated: prodigi assertions replaced with finerworks equivalents; new describe block asserts the null guard + the `normalizeVendor` migration mapping.

## Task Commits

Each task was committed atomically:

1. **Task 1: Narrow the vendor union, add CanvasVendor + normalizeVendor, null-guard calculateCanvasCost** - `98e1255` (feat)
2. **Task 2: Persist + migrate selectedVendor and consume the narrowed union in App.tsx and Step3Canvas** - `45c39e1` (feat)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md (docs).

## Files Created/Modified
- `src/engine/checkout.ts` - `CanvasVendor` type, Prodigi removed from `VENDOR_REGISTRY`, `calculateCanvasCost` -> `number | null` with null guard, new `normalizeVendor`.
- `src/engine/__tests__/checkout.test.ts` - prodigi cases converted to finerworks; new null-guard + normalizeVendor migration tests.
- `src/engine/projectStore.ts` - `ProjectData` gains optional `selectedVendor?: CanvasVendor` (imports `CanvasVendor`).
- `src/App.tsx` - `selectedVendor` state typed `CanvasVendor`; canvas-cost effect skips setter on null; load path normalizes restored vendor; save assembly persists `selectedVendor`.
- `src/features/wizard/steps/Step3Canvas.tsx` - props typed `CanvasVendor`; Prodigi `<option>` removed.

## Verification Results
- `npx tsc --noEmit` — clean, exit 0 (union narrowed to `CanvasVendor`, no widening to `string`).
- `npx vitest run src/engine/__tests__/checkout.test.ts` — 16 tests pass (null guard + migration proven).
- `npm test` — 181 tests pass across 20 files (baseline was 178).
- Grep confidence: zero `prodigi`/`Prodigi` literal in production code (checkout.ts, App.tsx, Step3Canvas.tsx). The only remaining `'prodigi'` literals live in checkout.test.ts migration assertions (see Deviations).

## Decisions Made
- Removed Prodigi entirely rather than repricing it — it was the source of an inaccurate tier and a $0-hole risk; VENDOR-02 mandates the narrowed set.
- `calculateCanvasCost` returns `null` (not `0.0`) for an out-of-union vendor so the guard is unambiguous and the App effect can skip the setter.
- `selectedVendor` is an OPTIONAL persisted field (additive/frozen-shape) so pre-VENDOR-02 saved blobs keep loading; the migration is read-only (save re-persists the normalized value).

## Deviations from Plan

### Prohibition reconciliation (documented, not an auto-fix)

**1. [Rule 1 - Bug adjacent / plan internal contradiction] `prodigi` literal retained ONLY in migration-test assertions**
- **Found during:** Task 1 (checkout.test.ts update)
- **Issue:** The plan's frontmatter prohibition says "No `prodigi` literal remains ... in checkout.test.ts," but the same plan's Task 1 `<action>` and `<acceptance_criteria>` explicitly require asserting `calculateCanvasCost(12,16,'inch','prodigi' as any) === null` and `normalizeVendor('prodigi') === 'lumaprints'`. A migration test cannot prove that the legacy value migrates without naming the legacy value — the two directives are mutually exclusive.
- **Resolution:** Honored the more specific, operational directive (the Task 1 action's explicit assertions). The `'prodigi'` literal is fully removed from all production code (checkout.ts, App.tsx, Step3Canvas.tsx) and from checkout.ts comments; it survives only inside the three checkout.test.ts assertions that verify the removal/migration. The prohibition's real intent — prodigi is no longer a functional/selectable vendor — is fully satisfied.
- **Files:** src/engine/__tests__/checkout.test.ts (test assertions only)
- **Verification:** `npx vitest run src/engine/__tests__/checkout.test.ts` (16 pass); `npx tsc --noEmit` clean; grep shows zero prodigi in production sources.
- **Committed in:** 98e1255 (Task 1)

---

**Total deviations:** 1 documented reconciliation of a plan-internal contradiction. No functional scope creep.
**Impact on plan:** All must-have truths, artifacts, key-links, and the two safety prohibitions (`calculateCanvasCost` never returns 0.0 for unknown; union not widened to string) are satisfied.

## Threat Flags

None — no new security surface introduced beyond the planned trust-boundary mitigations (T-15-01 null guard, T-15-02 normalizeVendor migration), both implemented.

## Known Stubs

None — no placeholder/empty-value stubs introduced.

## Issues Encountered
None — planned work executed cleanly. Interpolation/sqInchRate test values were recomputed from the FinerWorks pricingPoints when replacing the Prodigi cases (18x24 finerworks = 16.57; 50x60 finerworks = 174.00; 12x16 finerworks = 11.00).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 15-02 (pricing accuracy: 500-tier fix, hasUnpricedSize $0-as-free guard, integer-cents money helper + reconciliation) is unblocked — it builds on the now-guarded `calculateCanvasCost`.
- The narrowed `CanvasVendor` union and the null-guard pattern are the trusted foundation the rest of Phase 15 (and the downstream fee/order-packet phases) rely on.

## Self-Check: PASSED

- FOUND: `.planning/phases/15-trustworthy-pricing-data-foundation/15-01-SUMMARY.md`
- FOUND: commit `98e1255` (Task 1)
- FOUND: commit `45c39e1` (Task 2)

---
*Phase: 15-trustworthy-pricing-data-foundation*
*Completed: 2026-07-12*
