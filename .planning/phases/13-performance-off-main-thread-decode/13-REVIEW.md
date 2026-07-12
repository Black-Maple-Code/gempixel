---
phase: 13-performance-off-main-thread-decode
reviewed: 2026-07-12T00:00:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - src/engine/matcher.worker.ts
  - src/engine/worker-client.ts
  - src/features/match/useDiamondArtMatch.ts
  - src/App.tsx
findings:
  blocker: 0
  high: 1
  medium: 1
  low: 3
  total: 5
status: issues
---

# Phase 13: Code Review Report — Off-Main-Thread Decode Relocation

**Reviewed:** 2026-07-12
**Depth:** deep (cross-file: hook → worker-client → worker)
**Scope constraint:** pure relocation under a bit-identical-output contract
**Status:** issues (1 HIGH)

## Summary

The relocation is largely faithful. The resample-parity chain — the highest-priority
concern — checks out: `createImageBitmap` is pinned to exactly
`{imageOrientation:'from-image', premultiplyAlpha:'none', colorSpaceConversion:'default'}`
with no `resizeWidth/Height/Quality`; the worker performs a single `drawImage(bitmap, 0,0,w,h)`
downscale with default smoothing (no `imageSmoothingEnabled/Quality` overrides); `capDims`
is byte-for-byte the removed `Math.round(dim*scale)` math; and `boxSampleImage` is imported
verbatim from `ingest.ts` rather than reimplemented. The `premultiplyAlpha:'none'` choice is
specifically correct — it avoids a double-premultiply that the canvas roundtrip would
otherwise introduce. Transfer semantics are correct (`[bitmap]` transfer list, neutered
handle never reused). The `runId===currentRunId` guard sits before box-sample/match work.

One real defect breaks the abort/error contract: the hook's `catch` block is **not** guarded
by the `seqRef` supersede check, so a superseded/stale `createImageBitmap` rejection leaks a
spurious error banner and clears `loading` while a newer decode is still in flight. Remaining
items are resource-leak and parity-edge nits.

## Narrative Findings (AI reviewer)

### HIGH

#### HI-01: `catch` block is unguarded by `seqRef` — a stale decode rejection corrupts the live run's UI state

**File:** `src/features/match/useDiamondArtMatch.ts:167-172`
**Issue:** The success path correctly discards a superseded decode
(`if (mySeq !== seqRef.current) { bitmap.close(); return; }`, lines 144-147), but the
`catch` block has no equivalent guard. `mySeq` is in scope there yet unused. When an earlier,
now-superseded `createImageBitmap` **rejects** after a newer trigger has already started, the
catch runs unconditionally:

```
} catch (err) {
  console.error(err);
  setLoading(false);
  setError(err instanceof Error ? err.message : String(err));
}
```

Failure scenario (rapid re-trigger, e.g. dragging the size sliders or swapping images while a
decode is slow):
1. Run 1 starts decode (`mySeq=1`, `seqRef=1`), `loading=true`.
2. Run 2 starts (`seqRef=2`), sets `setError(null); setLoading(true); loadingPhase='preparing'`,
   begins its own decode.
3. Run 1's `createImageBitmap` promise rejects late (corrupt/oversized source, transient
   decode failure).
4. Run 1's catch fires with no `seqRef` check → `setLoading(false)` (spinner vanishes
   mid-flight) and `setError('…')` (banner appears) — even though Run 2 is still validly
   decoding.
5. Run 2 resolves and completes successfully → `setRawMatchResult(result)` renders the grid,
   but the stale Run-1 error banner is never cleared (`setError(null)` only runs at the *start*
   of an effect, not on completion). The user sees a rendered result **with** a
   "Couldn't process the image: …" banner overlaid.

This violates the phase's stated invariants directly (focus items 2 and 3: "Any way a stale
run's result reaches the UI?" and the loading/banner mutual-exclusion contract) and produces
exactly the overlapping/confusing-state UX the developer profile flags as a regression
concern.

**Fix:** Guard the catch on the same supersede sequence before touching shared state:

```ts
} catch (err) {
  console.error(err);
  if (mySeq !== seqRef.current) return; // a newer run owns loading/error now
  setLoading(false);
  setError(err instanceof Error ? err.message : String(err));
}
```

### MEDIUM

#### ME-01: Strict bit-identical parity is not guaranteed for EXIF-oriented source images

**File:** `src/engine/matcher.worker.ts:64` (`capDims(bitmap.width, bitmap.height, …)`) vs the
removed `getImagePixels` which capped from `img.naturalWidth/naturalHeight`
**Issue:** The old path sized the resample canvas from `img.naturalWidth || img.width` and
drew the `HTMLImageElement` directly. The new path sizes from `bitmap.width/height`, where the
bitmap was produced with `imageOrientation:'from-image'`. For images carrying a rotating EXIF
orientation (6/8, 90°/270°), the oriented bitmap dimensions can differ from the raw
`naturalWidth/Height`, so the capped target dims — and therefore the box-sampled bytes — can
diverge between old and new pipelines. This is arguably a *fix* (the old direct-draw path had
its own orientation ambiguity), but under a declared bit-identical constraint it is the one
input class where output can legitimately differ.
**Fix:** No code change required if EXIF-rotated inputs are accepted as out-of-scope for the
parity claim — but note it explicitly in the phase verification so a later regression check
against rotated photos isn't mistaken for a bug. If strict parity is required, snapshot-test a
known EXIF-orientation-6 JPEG old vs new.

### LOW

#### LO-01: Transferred `ImageBitmap` leaks in the worker when `decodeToPixels` throws

**File:** `src/engine/matcher.worker.ts:65-66`
**Issue:** `bitmap.close()` runs *after* `decodeToPixels(bitmap, w, h)`. If the decode throws
(e.g. `getImageData` OOM on a large canvas, or the `'OffscreenCanvas 2D context unavailable'`
throw at line 26), control jumps to the catch at line 72 and `close()` is skipped. The worker
is long-lived, so each such failure orphans one `ImageBitmap` until GC.
**Fix:** Close in a `finally`, or close immediately after reading dims and before decode is
not possible (decode needs it) — so wrap:

```ts
const { w, h } = capDims(bitmap.width, bitmap.height, MAX_DIMENSION);
let pixels: Uint8ClampedArray;
try {
  pixels = decodeToPixels(bitmap, w, h);
} finally {
  bitmap.close();
}
```

#### LO-02: In-flight bitmap leaks if `createImageBitmap` resolves after unmount

**File:** `src/features/match/useDiamondArtMatch.ts:148`
**Issue:** On unmount the worker effect cleanup sets `clientRef.current = null`. A decode that
resolves afterward passes the `mySeq` check (seqRef isn't bumped on unmount), reaches
`clientRef.current?.match(bitmap, …)` which no-ops, so the bitmap is neither transferred nor
`close()`d — a one-off leak per unmount-during-decode.
**Fix:** In the else/no-op path, close the orphan: capture `const client = clientRef.current;`
and `if (!client) { bitmap.close(); return; }` before calling `client.match(...)`.

#### LO-03: `detectOffscreenSupport` JSDoc says "Runs once at hook init" but it runs per match trigger

**File:** `src/features/match/useDiamondArtMatch.ts:58` (doc) vs `:119` (call site)
**Issue:** The probe is invoked inside the match effect (`offscreenSupportOverride ?? detectOffscreenSupport()`),
so it constructs a throwaway `new OffscreenCanvas(1,1).getContext('2d')` on every
image/cols/rows/palette change, not once. Harmless but the comment is misleading and the
allocation is needless churn.
**Fix:** Either memoize the probe result once per hook instance (e.g. a `useMemo`/`useRef`
computed on first run) or correct the comment to "runs per match trigger."

## Parity Verification Notes (confirmed correct — no action)

- `createImageBitmap` options exactly `{imageOrientation:'from-image', premultiplyAlpha:'none',
  colorSpaceConversion:'default'}`, no resize options — matches contract (hook:137-141).
- `premultiplyAlpha:'none'` is the correct choice: source → bitmap (raw) → one canvas
  premult/unpremult roundtrip mirrors the old single-canvas roundtrip; `'default'`/`'premultiply'`
  would have double-premultiplied.
- `capDims` (worker:40-46) is identical to the removed `Math.round(dim*scale)` math.
- No `imageSmoothingEnabled/imageSmoothingQuality` set on either canvas — defaults preserved.
- `boxSampleImage` imported verbatim from `ingest.ts` (worker:2), not reimplemented.
- `runId !== currentRunId` guard (worker:69) precedes box-sample/match work.
- `[bitmap]` transfer list present (worker-client:40); neutered handle never reused.
- `getImagePixels` fully removed; `boxSampleImage` import dropped from the hook — no dead code.
- The worker `'abort'` branch being production-dead is pre-existing (baseline worker-client
  also never posted abort) — out of scope for this phase.

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
