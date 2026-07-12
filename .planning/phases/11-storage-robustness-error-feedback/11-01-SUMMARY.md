---
phase: 11-storage-robustness-error-feedback
plan: 01
subsystem: infra
tags: [localStorage, preact, hooks, persistence, codecs, vitest, jsdom]

# Dependency graph
requires:
  - phase: 10 (prior App.tsx settings persistence via inline lazy-useState)
    provides: the 7 unguarded localStorage read/write pairs this foundation will replace
provides:
  - src/engine/safeStorage.ts — pure, throw-proof localStorage guard (getItem/setItem/removeItem/isAvailable)
  - src/hooks/usePersistentState.ts — Preact hook + format-preserving codecs (bool/int/string/json)
  - Unit test coverage for both storage-safety layers
affects: [11-02 (App.tsx migration consumes this hook), 11-03 (actionError banner), ERR-01, projectStore reuse]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-audit-point storage guard (safeStorage) replacing ad-hoc try/catch at every call site"
    - "Format-preserving per-type codecs (never a blanket JSON codec) to avoid wiping raw-string settings"
    - "preact/test-utils act() to flush hook renders + effects synchronously in unit tests"

key-files:
  created:
    - src/engine/safeStorage.ts
    - src/hooks/usePersistentState.ts
    - src/engine/__tests__/safeStorage.test.ts
    - src/hooks/__tests__/usePersistentState.test.ts
  modified: []

key-decisions:
  - "Codecs preserve legacy on-disk formats (bool 'true'/'false', int decimal + Number.isFinite NaN guard, string raw, json JSON.stringify) — a blanket JSON codec would throw on raw-string settings and silently reset them (Pitfall 1)"
  - "usePersistentState returns a [value, setValue] tuple as const — deliberate exception to the repo object-return convention, mirroring native useState for drop-in replacement"
  - "safeStorage catch blocks are silent (no console.*) per CONVENTIONS.md logging rule, unlike checkout.ts"
  - "Test harness uses act() from preact/test-utils instead of useEffect out-params, because Preact schedules effects asynchronously"

patterns-established:
  - "Guarded storage access: all localStorage reads/writes flow through safeStorage — a single try/catch audit point"
  - "Persistence lifecycle: usePersistentState collapses a lazy-init useState + write-effect pair into one call"

requirements-completed: [STORE-01, STORE-02]

coverage:
  - id: D1
    description: "safeStorage never throws on blocked/private-mode storage — returns null/false/void instead"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/safeStorage.test.ts#getItem returns null (never throws) when access throws"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/safeStorage.test.ts#setItem returns false (never throws) when access throws"
        status: pass
    human_judgment: false
  - id: D2
    description: "usePersistentState + codecs fall back to initial on blocked/corrupt storage and preserve legacy on-disk formats"
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/hooks/__tests__/usePersistentState.test.ts#falls back to initial when the stored int value is corrupt (NaN guard)"
        status: pass
      - kind: unit
        ref: "src/hooks/__tests__/usePersistentState.test.ts#round-trips bool to exactly \"true\" on disk"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-12
status: complete
---

# Phase 11 Plan 01: Storage-Safety Foundation Summary

**Pure `safeStorage` localStorage guard + `usePersistentState` Preact hook with format-preserving bool/int/string/json codecs, both unit-tested in isolation before any App.tsx wiring.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-12T15:19:00Z
- **Completed:** 2026-07-12T15:25:00Z
- **Tasks:** 2 (both TDD)
- **Files created:** 4

## Accomplishments
- `safeStorage` guards both localStorage failure surfaces (throw-on-access → null/false/void), never throwing during render or write (STORE-01)
- `usePersistentState<T>` reads/writes exclusively through `safeStorage`, falling back to `initial` on blocked or corrupt storage without throwing (STORE-02)
- Format-preserving codecs (`bool`, `int` with `Number.isFinite` NaN guard, `string` identity, `json` factory) keep the exact legacy on-disk formats so existing settings and their tests never drift
- Two new Vitest unit suites (9 + 12 tests) green; full suite 166/166 green; `tsc --noEmit` clean

## Task Commits

Each task followed the TDD RED → GREEN discipline:

1. **Task 1: safeStorage guard module**
   - `d18fe12` (test) — failing tests for getItem/setItem/removeItem/isAvailable + throwing-access paths
   - `a983983` (feat) — pure safeStorage module (STORE-01)
2. **Task 2: usePersistentState hook + codecs**
   - `45895c9` (test) — failing tests for the hook + codecs
   - `71de17c` (feat) — hook + format-preserving codecs (STORE-02)

_TDD gate compliance: each task has a `test(...)` commit preceding its `feat(...)` commit._

## Files Created/Modified
- `src/engine/safeStorage.ts` — pure guarded localStorage wrapper; four silent-catch methods, no preact import
- `src/hooks/usePersistentState.ts` — `Codec<T>` interface, `codecs` object, and the `usePersistentState<T>` hook
- `src/engine/__tests__/safeStorage.test.ts` — 9 unit tests covering success + blocked-storage paths
- `src/hooks/__tests__/usePersistentState.test.ts` — 12 unit tests (pure codecs + hook fallback + round-trip fidelity)

## Decisions Made
- **Per-type codecs, not a blanket JSON codec** — a `JSON.parse` codec throws on already-stored raw strings (`affiliateTag`, `canvasTemplate`) and would silently reset them; typed codecs read the existing format losslessly (Pitfall 1).
- **`[value, setValue]` tuple return `as const`** — deliberate deviation from the repo's object-return convention, mirroring native `useState` so the hook is a drop-in replacement for the 7 inline pairs Plan 11-02 will migrate.
- **Silent catch blocks in safeStorage** — no `console.*` per CONVENTIONS.md, unlike `checkout.ts`.
- **`act()` from `preact/test-utils` in the hook test harness** — Preact schedules `useEffect` asynchronously, so the initial out-param approach captured `undefined`; wrapping render + setValue in `act()` flushes renders and write-effects synchronously.

## Deviations from Plan

None — plan executed exactly as written. The test filename stayed `usePersistentState.test.ts` (as specified) by rendering the probe component via `h(Probe, null)` instead of JSX, keeping it a valid `.ts` file.

## Issues Encountered
- **Hook test initially read `undefined`:** the first harness stored the hook value inside a `useEffect`, which Preact runs asynchronously, so assertions ran before effects flushed. Resolved by capturing the value synchronously in the render body and wrapping render + setter calls in `act()` from `preact/test-utils`. All 12 tests pass.
- A pre-existing async timer trace from `preact/hooks` appears on stderr during the full-suite run; it originates outside the two new files (they emit no such trace in isolation) and does not fail any test — 166/166 pass.

## User Setup Required
None — no external service configuration; pure client-side code change, no new dependencies.

## Next Phase Readiness
- Storage-safety foundation is ready for **Plan 11-02** (App.tsx migration): replace the 7 unguarded lazy-`useState`/`useEffect` pairs with `usePersistentState`, and route the imperative `unmappedLog` writes + `Step3Canvas` clear-log through `safeStorage`.
- `canvasTemplate` will need a **custom codec** carrying the `heartfuldiamonds→adiamondpainting` normalization (Pitfall 4) — noted for 11-02.
- No blockers.

## Self-Check: PASSED
- FOUND: src/engine/safeStorage.ts
- FOUND: src/hooks/usePersistentState.ts
- FOUND: src/engine/__tests__/safeStorage.test.ts
- FOUND: src/hooks/__tests__/usePersistentState.test.ts
- FOUND commit: d18fe12, a983983, 45895c9, 71de17c

---
*Phase: 11-storage-robustness-error-feedback*
*Completed: 2026-07-12*
