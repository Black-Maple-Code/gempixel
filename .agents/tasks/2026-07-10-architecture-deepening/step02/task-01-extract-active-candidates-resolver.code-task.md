# Task: Extract the active-candidates resolver (`candidates.ts`)

## Description
Name the "which colors are in play" concept as a pure `resolveActiveCandidates(kit, excluded)` in a new `src/engine/candidates.ts`, and memoize it at its `App.tsx` call site. This is the single task for **Step 2 (Candidate 4)** of the GemPixel Architecture Deepening effort. It's small but load-bearing: `activeCandidates` currently recomputes on **every render** with a fresh allocation, and it feeds the matcher, the `matchResult`/`symbolMap` memos, and the legend split. Naming + memoizing removes a per-render allocation and gives the pipeline a stable identity.

## Background
Today `App.tsx` computes candidates inline (`research/current-state.md` §Candidate 4, `~:563-567`):
```
baseCandidates = selectedBaseKit === 'all' ? DMC_PALETTE : DMC_PALETTE.filter(c => c.kits.includes(selectedBaseKit))
activeCandidates = baseCandidates.filter(c => !excludedColors.has(c.dmc))
```
This runs unmemoized every render. Inputs are `selectedBaseKit: 'all'|'100'|'200'` (`~:302`) and `excludedColors: Set<string>` (`~:304`). The kit-membership field is `kits: ("100"|"200")[]` on `DmcColor`; the exclusion/identity field is `dmc: string` — **not** `code`. Consumers of `activeCandidates`: the matcher trigger (`~:893` region), the `matchResult` memo (`~:569`), `symbolMap` (`~:584`), the legend split (`~:592`), the viewer-feed effect's colorMap builders (`~:654`, `~:1077`, `~:1099`), and the legend render (`~:3303`).

**`baseCandidates` is NOT dead code — do not delete it.** Beyond feeding `activeCandidates`, it is independently consumed by `toggleColorExclusion`'s "keep at least one active" guard (`~:917`), `handleDeselectAll` (`~:932-933`), and two kit-browser render blocks (`~:1824`, `~:2763`). Only `activeCandidates`'s definition is being replaced; `baseCandidates` stays as the existing inline (unmemoized) expression.

Per design §4 Candidate 4 / R4: extract a pure resolver into the `src/engine/` logic layer and wrap the call site in `useMemo` keyed on `[selectedBaseKit, excludedColors]`. No behavior change (design N1) — the same colors are in play; only allocation churn is removed. The static catalog `src/engine/palette.ts` (`DMC_PALETTE`, 4058 lines) is **data — DO NOT TOUCH**; read from it only.

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 4, §5 Data Models, §6 Error Handling C4)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 2)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 4 — anchors `:302`, `:304`, `:563-567`, consumer list)

**Note:** You MUST read design §4 Candidate 4 before implementing. The anchors above are `master`-as-of-2026-07-10 and **will have drifted** (Step 1 landed edits in `App.tsx` already) — re-grep `selectedBaseKit`, `excludedColors`, `baseCandidates`, `activeCandidates` before editing.

## Technical Requirements
1. Create `src/engine/candidates.ts` exporting exactly (design §4 Candidate 4):
   `export function resolveActiveCandidates(kit: 'all' | '100' | '200', excluded: Set<string>): DmcColor[]`
   — pure: `DMC_PALETTE` filtered by kit, minus any code in `excluded`. Import `DmcColor` from `./types` and `DMC_PALETTE` from `./palette` (re-grep exact names/exports). No Preact, no DOM, no side effects.
2. The resolver MUST reproduce the current inline semantics exactly: `kit === 'all'` returns the full palette (minus exclusions); `'100'`/`'200'` apply the same kit filter used inline today (re-grep the exact predicate — do not guess the kit-membership field).
3. In `App.tsx`, replace only the `activeCandidates` assignment with:
   `const activeCandidates = useMemo(() => resolveActiveCandidates(selectedBaseKit, excludedColors), [selectedBaseKit, excludedColors]);`
   **Leave the `baseCandidates` local exactly as-is** (`selectedBaseKit === 'all' ? DMC_PALETTE : DMC_PALETTE.filter(c => c.kits.includes(selectedBaseKit))`) — it is still read directly by `toggleColorExclusion` (`~:917`), `handleDeselectAll` (`~:932-933`), and two kit-browser render blocks (`~:1824`, `~:2763`); deleting it will break the build. Do not change any consumer of `activeCandidates`.
4. Empty-exclusion identity (design §6 C4): with an empty `excluded` set the result is the kit's full list; the function has no error modes (pure).

## Dependencies
- `src/engine/palette.ts` — `DMC_PALETTE` (read-only; do not modify).
- `src/engine/types.ts` — `DmcColor`.
- No new npm dependencies (design §8A).

## Implementation Approach
1. Re-grep the drifted anchors: the inline `baseCandidates`/`activeCandidates` block and the kit-filter predicate in `App.tsx`; confirm `DmcColor`'s identity field is `dmc` (not `code`) and `DMC_PALETTE`'s kit-membership shape (`kits: ("100"|"200")[]`).
2. **Write the failing tests first (TDD, RED→GREEN per behavior):** create `src/engine/__tests__/candidates.test.ts`, one behavior at a time:
   - kit filters — `'all'` returns the full palette; `'100'` and `'200'` return the correct kit subsets.
   - exclusion removal — codes in `excluded` are absent from the result.
   - empty-set identity — empty `excluded` yields the kit's full list unchanged.
3. Implement `resolveActiveCandidates` to satisfy each behavior.
4. Swap the `App.tsx` call site to the memoized resolver; **keep `baseCandidates` untouched** (it is not dead — see Background/Requirement 3). Verify all consumers of `activeCandidates` (matcher trigger, `matchResult`, `symbolMap`, legend split, the viewer-feed colorMap builders at `~:654/1077/1099`, and the legend render at `~:3303`) compile and read the memoized value unchanged — do **not** mirror it into local state.
5. **Guardrail:** keep referential stability — the `useMemo` deps are exactly `[selectedBaseKit, excludedColors]`; do not add inputs that would defeat the memo. If `excludedColors` is a `Set` whose identity changes each render upstream, re-grep how it's set — the memo only helps if the `Set` reference is stable across unrelated renders (it is today; preserve that).
6. **Verify gate (Cardinal Rule 4):** `npx tsc --noEmit` && `npm test` (all green, ≥99 incl. the new file) && `npm run build`. Commit only when green: `refactor(palette): extract active-candidates resolver`.

## Acceptance Criteria

1. **Kit filtering correct**
   - Given `kit = 'all'`, then `'100'`, then `'200'` with an empty exclusion set
   - When `resolveActiveCandidates(kit, new Set())` runs
   - Then it returns the full palette for `'all'` and the correct kit subsets for `'100'`/`'200'`, matching the previous inline behavior.

2. **Exclusions removed**
   - Given a `kit` and an `excluded` set containing specific DMC codes
   - When the resolver runs
   - Then none of the excluded codes appear in the result and all other kit colors remain.

3. **Empty-exclusion identity**
   - Given any `kit` and `excluded = new Set()`
   - When the resolver runs
   - Then the result equals the kit's full color list.

4. **Memoized call site, no behavior change**
   - Given `App.tsx` after the swap
   - When the app renders and the user switches kit / excludes a color
   - Then the grid, matcher, `symbolMap`, and legend update exactly as before, `activeCandidates` comes from a `useMemo` keyed on `[selectedBaseKit, excludedColors]`, and `baseCandidates` remains intact and unchanged (still consumed by the exclusion guard, `handleDeselectAll`, and the two kit-browser render blocks).

5. **Suite + build green**
   - Given the completed change
   - When `npx tsc --noEmit`, `npm test` (≥99), and `npm run build` run
   - Then all tests (incl. `candidates.test.ts`) pass and the build compiles.

## Metadata
- **Complexity**: Low
- **Labels**: engine, palette, perf, candidate-4
- **Required Skills**: TypeScript, Preact hooks (`useMemo`), Vitest (TDD)
