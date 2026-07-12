---
phase: 13-performance-off-main-thread-decode
verified: 2026-07-12T00:00:00Z
status: human_needed
score: 9/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Load a large source image (~4000x3000) and run a match. Move the pointer / scroll while it runs."
    expected: "UI stays interactive (no main-thread freeze); overlay shows indeterminate 'Preparing image…' then flips to determinate 'Matching colors: {n}%'; spinner and error banner never appear together."
    why_human: "Main-thread responsiveness and the decode/resample interval only manifest in a real browser with OffscreenCanvas + a genuinely large decode — node/jsdom has no OffscreenCanvas and cannot exercise the decode path or observe paint blocking (D-11, PERF-01, D-09)."
  - test: "Pick ONE fixture image + fixed settings (cols/rows/kit/substitution/smoothing). Capture per-DMC supply counts and/or exported grid PNG on the CURRENT build, then build the pre-phase baseline (git worktree at the commit before phase 13) and capture the same surface at identical settings. Diff. Include an EXIF-rotated photo and a semi-transparent PNG."
    expected: "Per-DMC counts match exactly and the grid is pixel-for-pixel identical between new worker pipeline and pre-phase main-thread pipeline — including the EXIF-rotated fixture (the ME-01 fix target)."
    why_human: "OffscreenCanvas (worker) vs HTMLCanvasElement (old path) resample byte-parity is implementation-defined, not spec-guaranteed; jsdom cannot run the decode path. This is the D-11 one-time manual parity gate. The ME-01 srcWidth/srcHeight cap is wired in code but its byte-for-byte equivalence for EXIF-rotated inputs can only be confirmed in-browser."
  - test: "Force the capability probe false (call __setOffscreenSupportForTest(false) from a dev entry, or stub OffscreenCanvas.prototype.getContext to return null in DevTools), then trigger a match."
    expected: "Banner reads 'Couldn't process the image: … update your browser …', the spinner is NOT stuck, nothing crashes. Undo the override afterward."
    why_human: "The unsupported-browser hard-fail (D-07) is only observable in a real browser lacking OffscreenCanvas 2D; the reactive-error routing is unit-tested for match failures but the decode-capability short-circuit at runtime needs manual confirmation."
---

# Phase 13: Off-Main-Thread Decode Verification Report

**Phase Goal:** Move image decode/resample and box-sampling off the main thread so large images no longer jank the UI on every match trigger — while keeping matched-grid output bit-identical to the pre-phase main-thread pipeline.
**Verified:** 2026-07-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The relocation is implemented faithfully in live source and every automated gate is green. All nine code-verifiable must-haves are VERIFIED against the actual files (not SUMMARY claims). The three remaining truths are the D-11 manual in-browser gate (Plan 13-03, a `checkpoint:human-verify` task with no SUMMARY yet) — they are inherently non-automatable in node/jsdom and route to human verification.

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | drawImage resample + getImageData readback + boxSampleImage run INSIDE matcher.worker.ts, not on the main thread (D-01/D-02) | ✓ VERIFIED | `matcher.worker.ts:62-83` — `decodeToPixels` (OffscreenCanvas draw + getImageData) then `boxSampleImage` in the `'match'` branch; hook no longer contains `getImagePixels` |
| 2  | createImageBitmap runs on main thread with pinned parity options; bitmap transferred zero-copy (D-01/D-06) | ✓ VERIFIED | `useDiamondArtMatch.ts:149-153` pins `{imageOrientation:'from-image', premultiplyAlpha:'none', colorSpaceConversion:'default'}`; `worker-client.ts:35-48` posts with `[bitmap]` transfer list |
| 3  | Worker caps dims at maxDimension=2000 with removed getImagePixels math, no imageSmoothing overrides, boxSampleImage VERBATIM (D-02) | ✓ VERIFIED | `matcher.worker.ts:40-46` `capDims` = `Math.round(dim*scale)`; `MAX_DIMENSION=2000` (line 15); no `imageSmoothing*` set (lines 27-29); `boxSampleImage` imported from `./ingest` (line 2), unchanged in `ingest.ts:75` |
| 4  | Superseded in-flight createImageBitmap discarded via hook seq check; worker re-checks runId===currentRunId AFTER decode BEFORE box-sample; HI-01 catch guard; bitmap.close() on all superseded/orphan/throw paths | ✓ VERIFIED | Hook success-path guard `if (mySeq !== seqRef.current) { bitmap.close(); return; }` (156-159); HI-01 catch guard `if (mySeq !== seqRef.current) return;` (202); LO-02 orphan close `if (!client) { bitmap.close(); }` (163-167); worker guard `if (runId !== currentRunId || isAborted) return;` (81) BEFORE box-sample; LO-01 `try/finally` closes bitmap on decode throw (74-78). Worker-side B2 covered by passing test |
| 5  | Unsupported browser short-circuits to reactive error signal, never posts to worker (D-07/D-08) | ✓ VERIFIED (code) | `useDiamondArtMatch.ts:131-136` — `getOffscreenSupport()` false → `setError(...)`, `setLoading(false)`, `return` before any decode/post. Runtime hard-fail confirmation is human item #3 |
| 6  | worker.test.ts passes through injectable decode seam; all four prior behaviors green (result/abort/cache/B2) | ✓ VERIFIED | `worker.test.ts:117` injects `__setDecoderForTest((bitmap) => bitmap.__pixels)`; ran `npx vitest run` → 178/178 pass |
| 7  | loadingPhase overlay: indeterminate 'Preparing image…' → determinate 'Matching colors: {progress}%' (D-09) | ✓ VERIFIED (code) | `App.tsx:1649-1667` ternary on `loadingPhase` inside single `{loading && …}` gate; `useDiamondArtMatch.ts:181` flips to `'matching'` on first onProgress |
| 8  | Loading overlay never co-displays with matchError banner; loading cleared on error (D-09) | ✓ VERIFIED | Overlay gated `{loading && …}` (`App.tsx:1649`); every error path (`useDiamondArtMatch.ts:133,185,191,203`) calls `setLoading(false)` before/with `setError` |
| 9  | Stage-agnostic banner copy 'Couldn't process the image: {matchError}', plain JSX text child (D-10, ASVS V5) | ✓ VERIFIED | `App.tsx:1678` — literal copy present; `Color matching failed` absent; `{matchError}` is a text child, no `dangerouslySetInnerHTML` |
| 10 | Large image (~4000x3000) keeps UI responsive during match — no main-thread freeze (PERF-01, D-09) | ⏳ HUMAN | Requires real-browser large-image run; see Human Verification #1 |
| 11 | Matched grid bit-identical between new worker pipeline and pre-phase pipeline, incl. EXIF-rotated fixture (D-11, ME-01) | ⏳ HUMAN | OffscreenCanvas vs HTMLCanvas resample parity is implementation-defined; see Human Verification #2 |
| 12 | Unsupported-browser branch shows actionable banner, no crash, no stuck spinner (D-07) | ⏳ HUMAN | Runtime capability short-circuit; see Human Verification #3 |

**Score:** 9/12 truths verified (3 routed to human verification — the D-11/Plan 13-03 manual gate)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/engine/matcher.worker.ts` | Owns decode/resample/readback/box-sample behind injectable decoder | ✓ VERIFIED | `capDims`, `decodeToPixels`, `__setDecoderForTest`, `MAX_DIMENSION`, ME-01 srcWidth/srcHeight cap, LO-01 finally-close all present |
| `src/engine/worker-client.ts` | New match() signature + [bitmap] transfer | ✓ VERIFIED | `match(bitmap, cols, rows, candidates, onProgress, onComplete, onError?, srcWidth?, srcHeight?)`; `[bitmap]` transfer list; B1/B2 seams unchanged |
| `src/features/match/useDiamondArtMatch.ts` | createImageBitmap on main + seq-abort + capability probe + loadingPhase; getImagePixels removed | ✓ VERIFIED | `getImagePixels` gone, no `boxSampleImage` import; `detectOffscreenSupport`, memoized `getOffscreenSupport` (LO-03), `seqRef`, `loadingPhase`, HI-01/LO-02 guards present |
| `src/App.tsx` | Phase-branched overlay + stage-agnostic banner | ✓ VERIFIED | `loadingPhase` destructured (line 395); overlay ternary (1649-1667); banner copy (1678) |
| `src/engine/__tests__/worker.test.ts` | Routed through decode seam, 4 behaviors intact | ✓ VERIFIED | `__setDecoderForTest` injection; fake bitmaps carry `__pixels`; new match() call shape |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| worker-client.match | matcher.worker `'match'` branch | `{kind,bitmap,cols,rows,candidates,clearCache,runId,srcWidth,srcHeight}` + `[bitmap]` transfer | ✓ WIRED | Field names match on both sides (`matcher.worker.ts:60` destructure); transfer list present |
| hook match() call | worker-client.match signature | positional args (bitmap, cols, rows, candidates, onProgress, onComplete, onError, srcWidth, srcHeight) | ✓ WIRED | `useDiamondArtMatch.ts:175-195` matches signature; `tsc --noEmit` exit 0 keeps all callers in sync |
| worker decode throw | matchError banner | try/catch posts `{kind:'error'}` → onError → setError → App matchError | ✓ WIRED | `matcher.worker.ts:84-86` → `worker-client.ts:57-59` → `useDiamondArtMatch.ts:188-192` → `App.tsx:1676` |
| hook seqRef check | runSeq/currentRunId B2 scheme | reuse, no second abort channel | ✓ WIRED | `seqRef` guards both success (156) and catch (202) paths; worker `currentRunId` guard (81) unchanged |
| App overlay/banner | hook loadingPhase/error signals | destructure at ~line 395 | ✓ WIRED | `loadingPhase` and `error: matchError` consumed |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole-program contract agreement | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite (worker 4 behaviors + boxSampleImage math gate + hook + App) | `npx vitest run` | 178/178 pass, 20 files | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PERF-01 | 13-01/02/03 | Decode + box-sampling must not block the main thread | ✓ SATISFIED (code) / ⏳ HUMAN (runtime) | Relocation verified in source + tests; REQUIREMENTS.md marks Phase 13 Complete. Runtime responsiveness is human item #1 (D-11 gate) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER in modified source files | — | Clean |

Note: vitest stderr shows pre-existing jsdom warnings ("HTMLCanvasElement's getContext() … without installing the canvas npm package", blocked-storage DOMException) — these are baseline environment limitations in unrelated App tests, not phase regressions; suite exits 0.

### Code-Review Fixes (all 5 verified applied in live source)

| Finding | Fix | Status | Evidence |
| ------- | --- | ------ | -------- |
| HI-01 (HIGH) | Guard catch block on seqRef supersede | ✓ APPLIED | `useDiamondArtMatch.ts:202` |
| ME-01 (MEDIUM) | Cap on source natural dims for EXIF parity | ✓ APPLIED | hook passes `naturalWidth/Height` (173-174); worker `capW = srcWidth ?? bitmap.width` (68-70) |
| LO-01 (LOW) | try/finally close bitmap on decode throw | ✓ APPLIED | `matcher.worker.ts:74-78` |
| LO-02 (LOW) | Close orphan bitmap when clientRef null | ✓ APPLIED | `useDiamondArtMatch.ts:163-167` |
| LO-03 (LOW) | Memoize capability probe | ✓ APPLIED | `getOffscreenSupport()` cache (79-85) |

### Human Verification Required

These three ARE the Plan 13-03 manual checklist (D-11 one-time gate) — a `checkpoint:human-verify` blocking task with no SUMMARY yet. They cannot be exercised in node/jsdom (no OffscreenCanvas, no real decode/paint). See the `human_verification` frontmatter for full test/expected/why-human detail:

1. **Responsiveness on a large image** (PERF-01/D-09) — UI stays interactive; overlay label transitions.
2. **Bit-identical parity vs pre-phase baseline** (D-11/ME-01) — per-DMC counts + grid identical, including an EXIF-rotated fixture and a semi-transparent PNG.
3. **Unsupported-browser hard-fail** (D-07) — actionable banner, no crash, no stuck spinner.

### Gaps Summary

No code gaps. Every automated must-have is verified against live source, `tsc --noEmit` is clean, and the full suite is 178/178. The single remaining work is the in-browser manual gate (Plan 13-03) that the phase itself deliberately deferred as non-automatable (D-11). Status is `human_needed` — not `passed` — because the phase's own success criteria (responsiveness + bit-identical parity) can only be confirmed in a real browser, and Plan 13-03's blocking human-verify task has not yet been signed off.

---

_Verified: 2026-07-12_
_Verifier: Claude (gsd-verifier)_
