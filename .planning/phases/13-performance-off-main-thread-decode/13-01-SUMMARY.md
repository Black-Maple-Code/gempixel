---
phase: 13-performance-off-main-thread-decode
plan: 01
subsystem: performance
tags: [web-worker, offscreencanvas, createimagebitmap, transferable, preact-hooks, vitest]

# Dependency graph
requires:
  - phase: 11-storage-robustness-error-feedback
    provides: reactive error banner (hook `error` signal → App matchError) + B1/B2 worker abort seams reused for decode failures/supersede
provides:
  - Decode + resample + getImageData readback + boxSampleImage relocated off the main thread into matcher.worker.ts (PERF-01)
  - New atomic match() contract transferring a zero-copy ImageBitmap (worker + client + hook + tests moved together)
  - Injectable worker decode seam (__setDecoderForTest) making the OffscreenCanvas path node-testable
  - Main-thread OffscreenCanvas capability probe (detectOffscreenSupport + __setOffscreenSupportForTest) hard-failing into the reactive error banner
  - loadingPhase ('preparing' | 'matching') signal on MatchState for the Plan 13-02 overlay copy
affects: [13-02 loading overlay copy, 13-03 manual parity/UX gate]

# Tech tracking
tech-stack:
  added: []   # zero new npm deps — browser-native createImageBitmap + OffscreenCanvas only (GEMINI.md §5)
  patterns:
    - "Zero-copy ImageBitmap transfer (postMessage transfer list) for off-thread decode"
    - "Injectable module-level seam (decoder / capability flag) as the node/jsdom Vitest test seam"
    - "Reuse of the monotonic runSeq/currentRunId (B2) supersede scheme across the whole decode+sample+match pipeline — no second abort channel"

key-files:
  created: []
  modified:
    - src/engine/matcher.worker.ts
    - src/engine/worker-client.ts
    - src/features/match/useDiamondArtMatch.ts
    - src/engine/__tests__/worker.test.ts
    - src/features/match/__tests__/useDiamondArtMatch.test.tsx
    - src/__tests__/integration.test.tsx

key-decisions:
  - "Fake bitmap width/height = grid dims in worker.test.ts so capDims + boxSampleImage are identity and the four prior assertions hold byte-for-byte"
  - "Force the capability probe via __setOffscreenSupportForTest + stub createImageBitmap in the hook/integration jsdom tests (node has neither API)"
  - "Preserve the pre-existing Image/FileReader stub-leak in integration.test.tsx (no vi.unstubAllGlobals in afterEach) — a downstream test depends on it"

patterns-established:
  - "Off-thread decode via transferred ImageBitmap → OffscreenCanvas draw → getImageData in the worker (D-01/D-02)"
  - "Capability probe + reactive-error hard-fail instead of a main-thread fallback (D-07)"

requirements-completed: [PERF-01]

coverage:
  - id: D1
    description: "drawImage resample + getImageData readback + boxSampleImage run inside matcher.worker.ts behind an injectable decoder; the client posts a transferred ImageBitmap under the new match() contract"
    requirement: PERF-01
    verification:
      - kind: integration
        ref: "src/engine/__tests__/worker.test.ts#executes color matching successfully via match() and returns result"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit (whole-program contract agreement across worker/client/hook/tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Worker re-checks runId===currentRunId after decode/before box-sample; hook seqRef check after await createImageBitmap closes a superseded orphan bitmap (D-05, no second abort channel)"
    requirement: PERF-01
    verification:
      - kind: integration
        ref: "src/engine/__tests__/worker.test.ts#ignores a superseded run's result when an overlapping match arrives (B2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unsupported browser (no worker-side OffscreenCanvas 2D ctx) short-circuits to the reactive error banner and never posts to the worker (D-07/D-08)"
    verification:
      - kind: unit
        ref: "src/features/match/__tests__/useDiamondArtMatch.test.tsx#clears loading and exposes the error string when the worker match fails"
        status: pass
    human_judgment: true
    rationale: "The unsupported-browser branch and bit-identical decode parity are only observable in a real Safari < 16.4 / real-browser run — the D-11 manual gate (Plan 13-03), not automatable in the node Vitest env."
  - id: D4
    description: "loadingPhase ('preparing'|'matching') exposed on MatchState and flipped to 'matching' on the first worker onProgress"
    verification:
      - kind: unit
        ref: "src/features/match/__tests__/useDiamondArtMatch.test.tsx#dispatches a match and flows progress -> result -> loading false"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-07-12
status: complete
---

# Phase 13 Plan 01: Off-Main-Thread Decode Contract Summary

**Relocated the drawImage resample + getImageData readback + boxSampleImage averaging off the main thread into matcher.worker.ts behind a zero-copy ImageBitmap transfer, with an injectable decode/capability seam keeping the node Vitest suite green.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-12T18:03Z (approx)
- **Completed:** 2026-07-12T18:19Z
- **Tasks:** 3
- **Files modified:** 6 (4 planned + 2 deviation caller-tests)

## Accomplishments
- Worker now owns decode → resample (OffscreenCanvas, maxDimension=2000 via `capDims`, no imageSmoothing overrides) → `getImageData` → `boxSampleImage` (imported verbatim), behind an injectable `decodeToPixels` swapped by `__setDecoderForTest` (PERF-01, D-01/D-02).
- `MatcherClient.match()` signature changed to `(bitmap, cols, rows, candidates, onProgress, onComplete, onError?)` and posts `{kind:'match', bitmap, cols, rows, …}` with a `[bitmap]` zero-copy transfer list; B1 `onerror` / B2 stale-drop seams untouched (D-06).
- Hook creates the bitmap on the main thread with the pinned parity options `{imageOrientation:'from-image', premultiplyAlpha:'none', colorSpaceConversion:'default'}`, aborts a superseded in-flight decode via a `seqRef` check + `bitmap.close()`, hard-fails unsupported browsers into the reactive error banner (`detectOffscreenSupport`), and exposes `loadingPhase` (D-05/D-07/D-09).
- `worker.test.ts` routed through the decode seam (fake bitmap carrying `__pixels`, identity `capDims`/`boxSampleImage`) — all four prior behaviors (result / abort / cache clear-on-palette-change / B2 supersede) preserved byte-for-byte.

## Task Commits

Each task was committed atomically:

1. **Task 1: Worker decode preamble + injectable seam; client match() signature + transfer** - `8a5ca4f` (feat)
2. **Task 2: Hook createImageBitmap + seq-abort + capability probe + loadingPhase; remove getImagePixels** - `e4cb651` (feat)
3. **Task 3: Route worker + hook + integration tests through the new match contract** - `30ffc51` (test)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified
- `src/engine/matcher.worker.ts` - Added `boxSampleImage` import, `MAX_DIMENSION`, `capDims`, injectable `decodeToPixels` + `__setDecoderForTest`; rewrote the `'match'` branch (capDims → decode → close → D-05 guard → box-sample → runMatching). `runMatching`/cache unchanged.
- `src/engine/worker-client.ts` - `match(bitmap, cols, rows, candidates, …)` with `[bitmap]` transfer list; B1/B2 seams unchanged.
- `src/features/match/useDiamondArtMatch.ts` - Removed `getImagePixels` + `boxSampleImage` import; added `detectOffscreenSupport` + `__setOffscreenSupportForTest`, `seqRef`, `loadingPhase`; async `createImageBitmap` decode with supersede-abort and reactive-error hard-fail.
- `src/engine/__tests__/worker.test.ts` - Inject stub decoder; new match() call shape with fake bitmaps; four assertions intact.
- `src/features/match/__tests__/useDiamondArtMatch.test.tsx` - (deviation) new mock signature, forced capability probe + stubbed createImageBitmap, poll-until-settled for the async hop.
- `src/__tests__/integration.test.tsx` - (deviation) forced capability + stubbed createImageBitmap; candidates at arg index 3, onComplete at index 5; preserved prior global-stub leak.

## Decisions Made
- Fake bitmaps in `worker.test.ts` use width/height = grid dims so `capDims` and `boxSampleImage(pixels, cols, rows, cols, rows)` are both identity — the pre-sampled pixels reach `runMatching` unchanged and every prior assertion holds without editing the assertion blocks.
- Used the purpose-built `__setOffscreenSupportForTest` seam (rather than trying to polyfill OffscreenCanvas) to drive the hook/integration tests in the node/jsdom env.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two additional match() caller-tests broke and had to move with the atomic contract**
- **Found during:** Task 3 (closing `npx vitest run` gate)
- **Issue:** The plan's `files_modified` listed only `worker.test.ts`, but `src/features/match/__tests__/useDiamondArtMatch.test.tsx` and `src/__tests__/integration.test.tsx` are also `match()` callers exercised in jsdom. After the contract change they failed: (a) the hook now hard-fails on the absent `createImageBitmap`/`OffscreenCanvas` in the test env, and (b) they read positional args from the old signature (`mock.calls[…][1]` as candidates; a positional `onSuccess` mock impl). The plan's own critical constraint requires "the test suite end GREEN" and that the contract move atomically across all callers.
- **Fix:** In both files forced the capability probe via `__setOffscreenSupportForTest(true)` and stubbed a resolved `createImageBitmap`; updated the hook mock's `match` signature; updated integration positional reads (candidates → index 3, onComplete → index 5). Replaced fragile fixed-tick waits in the hook test with a poll-until-settled helper to absorb the new async decode hop.
- **Files modified:** src/features/match/__tests__/useDiamondArtMatch.test.tsx, src/__tests__/integration.test.tsx
- **Verification:** `npx vitest run` 178/178 pass on two consecutive runs (no flake); `npx tsc --noEmit` clean; `npm run build` succeeds.
- **Committed in:** `30ffc51` (Task 3 commit)

**2. [Rule 1 - Bug] Pre-existing test-isolation leak surfaced by an over-eager cleanup**
- **Found during:** Task 3 (full-suite run)
- **Issue:** Adding `vi.unstubAllGlobals()` to the integration `afterEach` (to clean up my new createImageBitmap stub) broke the unrelated "updates dimensions and units when preset canvas size changes" test — it silently depends on `Image`/`FileReader` global stubs *leaking* from an earlier test to load an image and enable the wizard Next button.
- **Fix:** Dropped `vi.unstubAllGlobals()` from `afterEach` (kept only the `__setOffscreenSupportForTest(null)` reset), preserving the pre-existing leak the downstream test relies on, and documented the constraint with a NOTE comment. Left the deeper isolation smell untouched (out of scope for this plan).
- **Files modified:** src/__tests__/integration.test.tsx
- **Verification:** Full suite 178/178 green twice.
- **Committed in:** `30ffc51` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) — both confined to test files; zero production-source changes beyond the three planned tasks.
**Impact on plan:** Necessary to satisfy the plan's "test suite end GREEN" gate. No scope creep in shipped source; the atomic contract change simply rippled to two more caller-tests the plan under-enumerated.

## Issues Encountered
- First-in-file async hook test was flaky under fixed `setTimeout(0)` ticks because the effect now awaits `createImageBitmap` before dispatching `match()`. Resolved by polling (rerender each tick until the predicate holds) rather than counting ticks.

## User Setup Required
None - no external service configuration required. Zero new npm dependencies (browser-native `createImageBitmap` + `OffscreenCanvas` only).

## Next Phase Readiness
- `loadingPhase` signal is live for **Plan 13-02** to wire the "Preparing image…" indeterminate overlay + stage-agnostic banner copy (`App.tsx` copy edits were intentionally left to 13-02 per the plan split).
- Bit-identical decode parity (D-11) remains the **Plan 13-03** manual in-browser fixture gate — not automatable in the node Vitest env.

## Self-Check: PASSED

- All modified source files present on disk.
- All three task commits (`8a5ca4f`, `e4cb651`, `30ffc51`) present in git history.
- Closing gate: `npx tsc --noEmit` clean, `npx vitest run` 178/178 (twice, no flake), `npm run build` succeeds.

---
*Phase: 13-performance-off-main-thread-decode*
*Completed: 2026-07-12*
