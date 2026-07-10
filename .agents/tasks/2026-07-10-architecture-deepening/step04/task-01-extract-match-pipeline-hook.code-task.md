# Task: Extract the match pipeline into `useDiamondArtMatch`

## Description
Move the image→grid pipeline (Web Worker match → substitution → symbol allocation) and its worker lifecycle out of `App.tsx` into a `src/features/match/useDiamondArtMatch.ts` hook exposing a small read-only signal surface `{ matchResult, symbolMap, loading, progress }`. This is the single task for **Step 4 (Candidate 2)**. It is the **first hook** in the new `src/features/` slice layer, so it also establishes that structural split (design §3 note).

## Background
`App.tsx` currently orchestrates the matcher directly (`research/current-state.md` §Candidate 2):
- imports `substituteLowCountColors` from `./engine/color`, `MatcherClient` from `./engine/worker-client`.
- `~:558` `clientRef = useRef<MatcherClient>`; `~:618-625` init effect (`new MatcherClient(new URL('./engine/matcher.worker.ts', import.meta.url))`) + `terminate` on unmount; `~:893` `clientRef.current?.match(...)` inside the match-trigger effect keyed on `image,cols,rows,selectedBaseKit,excludedColors`.
- `~:310` `rawMatchResult` state + `loading`/`progress` state.
- Derived memos: `~:569` `matchResult` (applies `substituteLowCountColors` when `enableSubstitution`), `~:584` `symbolMap` (`generateSymbolAllocation`), `~:592` `leftLegendColors/rightLegendColors`.
- Downstream: an effect feeds `viewerRef.current.setData(...)` (`~:651-669`).

Per design §4 Candidate 2 / R2: the hook owns worker construction/teardown, `abort`, cache-hash reuse, `rawMatchResult`, `loading`/`progress`, and the derived `matchResult` + `symbolMap`. App consumes the four signals and keeps only the viewer-feed effect and the legend split (which depend on `matchResult`/`activeCandidates`, not on worker internals). The repo currently has no `src/features/` dir — create it here (hooks/components under `src/features/<slice>/`, pure logic stays in `src/engine/`).

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§3 structure note, §4 Candidate 2, §6 Error Handling C2)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 4)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 2 anchors + engine seam signatures; §Test inventory — `App.test.tsx` already mocks `MatcherClient` directly via `vi.mock('../engine/worker-client', () => ({ MatcherClient: class MockMatcherClient { match = vi.fn(); terminate = vi.fn(); } }))`, alongside a separate `vi.mock('../engine/viewer', ...)` for `CanvasViewer`)

**Note:** You MUST read design §4 Candidate 2 + §3 structure note before implementing. Anchors are pre-drift (Steps 1–3 edited `App.tsx`) — re-grep `clientRef`, `MatcherClient`, `rawMatchResult`, `matchResult`, `symbolMap`, the `~:893` match dispatch, and the `~:651-669` viewer-feed effect before moving code.

## Technical Requirements
1. Create `src/features/match/useDiamondArtMatch.ts` exporting (design §4 Candidate 2):
   - `interface MatchInputs { image: HTMLImageElement | null; cols: number; rows: number; activeCandidates: DmcColor[]; enableSubstitution: boolean; substitutionThreshold: number; }`
   - `interface MatchState { matchResult: { matches: string[]; counts: Record<string, number> } | null; symbolMap: ColorSymbolMap; loading: boolean; progress: number; }`
   - `function useDiamondArtMatch(inputs: MatchInputs): MatchState`
2. The hook owns: `MatcherClient` init/teardown (construct with `new URL('../../engine/matcher.worker.ts', import.meta.url)` from the new location — re-grep and adjust the relative path), `terminate` on unmount, the `match(...)` dispatch, `rawMatchResult`, `loading`/`progress`, abort-on-new-input, and cache-hash reuse. It derives `matchResult` via `color.substituteLowCountColors(gridCodes, counts, activeCandidates, threshold)` and `symbolMap` via `symbols.generateSymbolAllocation(matchResult.matches, activeCandidates.map(c => c.dmc))` — both params of `generateSymbolAllocation` are `string[]` (grid codes and active DMC *code strings*, not `DmcColor[]`); do not pass `activeCandidates` directly.
3. Error handling (design §6 C2): on a worker `error` the hook surfaces `loading=false` and leaves `matchResult` unchanged (no partial state); it aborts the previous run before dispatching new inputs.
4. `App.tsx` renders from the hook's four signals; keep the viewer-feed effect (`~:651-669`) and the legend split (`leftLegendColors/rightLegendColors`) in App. Remove App's now-dead `clientRef`, worker effects, `rawMatchResult` state, and the two derived memos. Do not mirror hook signals into local `useState`.

## Dependencies
- `src/engine/worker-client.ts` (`MatcherClient.match(pixels, candidates, onProgress, onComplete, cols?)`), `src/engine/matcher.worker.ts`.
- `src/engine/color.ts` (`substituteLowCountColors`), `src/engine/symbols.ts` (`generateSymbolAllocation`, `ColorSymbolMap`), `src/engine/types.ts` (`DmcColor`). Note: `ColorSymbolMap` is exported from `symbols.ts`, NOT from `types.ts` — import it accordingly.
- **Candidate 4** `activeCandidates` (Step 2) is an input to the hook.
- `src/__tests__/App.test.tsx` + `integration.test.tsx` — must stay green.

## Implementation Approach
1. Re-grep the Candidate 2 anchors and confirm the engine seam signatures. Decide the `src/features/` layout (design §3): `src/features/match/useDiamondArtMatch.ts` + `src/features/match/__tests__/`.
2. **Write the failing test first (TDD, RED→GREEN per behavior):** create `src/features/match/__tests__/useDiamondArtMatch.test.ts`; mock `MatcherClient` — `App.test.tsx` already has this exact mock (`vi.mock('../engine/worker-client', () => ({ MatcherClient: class MockMatcherClient { match = vi.fn(); terminate = vi.fn(); } }))`), mirror it verbatim for the new test (adjusting the relative import path). Add behaviors one at a time: progress→result flow, `enableSubstitution` toggle changes `matchResult`, `symbolMap` regenerates when the match changes, unmount calls `terminate`.
3. Move the worker lifecycle + derivations into the hook; fix the `import.meta.url` relative path for the new file location. Wire `App.tsx` to call the hook and consume `{ matchResult, symbolMap, loading, progress }`.
4. Delete App's dead worker plumbing; keep the viewer-feed effect + legend split in App. Preserve abort-on-new-input and cache-hash reuse exactly (design §4/§6).
5. **Guardrail — UI-touching step:** run `npm run dev` (http://localhost:5173) — load an image, watch progress advance and the grid render; toggle "reduce colors" substitution and confirm the grid + counts update; navigate away/back to confirm no worker leak (unmount `terminate`). Verify the `new URL(...)` worker path resolves under Vite from `src/features/match/` (a wrong relative path silently breaks the worker).
6. **Verify gate (Cardinal Rule 4):** `npx tsc --noEmit` && `npm test` (all green, ≥99) && `npm run build` && `npm run dev` visual pass. Commit only when green: `refactor(match): extract diamond-art match pipeline hook`.

## Acceptance Criteria

1. **Progress → result flow**
   - Given a mocked `MatcherClient` and valid `MatchInputs`
   - When the hook dispatches a match and the worker reports progress then completion
   - Then `progress` advances 0→100, `loading` goes true→false, and `matchResult` populates.

2. **Substitution toggle**
   - Given a completed match
   - When `enableSubstitution` flips
   - Then `matchResult` reflects `substituteLowCountColors` (below-threshold colors substituted) and `symbolMap` regenerates.

3. **Worker teardown**
   - Given the hook is mounted with an active `MatcherClient`
   - When the consuming component unmounts
   - Then `terminate` is called (no leaked worker), verified by the mock.

4. **App renders from signals, no behavior change**
   - Given `App.tsx` after extraction
   - When the app runs (`npm run dev`)
   - Then image→grid, progress, substitution, and the viewer feed behave exactly as before; App holds no worker `useRef`/effect and no `rawMatchResult`/derived-memo duplication.

5. **Suite + build green**
   - Given the completed extraction
   - When `npx tsc --noEmit`, `npm test` (≥99, incl. new hook test + `App.test.tsx`/`integration.test.tsx`), `npm run build` run
   - Then all pass and the build compiles.

## Metadata
- **Complexity**: High
- **Labels**: features, match-pipeline, web-worker, hooks, candidate-2
- **Required Skills**: Preact hooks, Web Workers + Vite `import.meta.url`, Vitest (mocking), TypeScript
