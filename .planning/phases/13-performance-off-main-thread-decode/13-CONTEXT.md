# Phase 13: Performance — Off-Main-Thread Decode - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Move image **resample + box-sampling (downsample)** — and the `getImageData` readback that feeds them — **off the main thread**, so loading or re-matching a large source image (e.g. 4000×3000) no longer janks the UI on every match trigger.

Today the jank lives in `src/features/match/useDiamondArtMatch.ts:112-113`: `getImagePixels()` (`canvas.drawImage` resample to the 2000px cap + `getImageData` readback) and `boxSampleImage()` (a ~millions-of-pixels averaging loop) both run **synchronously on the main thread** before the already-off-thread matcher worker is invoked. This phase relocates that work into the worker.

**Locked by ROADMAP success criteria (not re-litigated):**
1. Loading/re-matching a large image keeps the UI responsive; decode/downsample no longer block paint.
2. Matching output is **bit-identical** to the current main-thread pipeline (parity test on a fixture image).

**Strictly out of scope:** changing the box-sample algorithm, the `maxDimension = 2000` cap, caching, worker pools, or any output-affecting change. This is a pure relocation of existing work.
</domain>

<decisions>
## Implementation Decisions

### Decode boundary & transfer
- **D-01:** Adopt boundary option **(b)** — fully evict the resample + readback from the main thread. The `HTMLImageElement` is *already decoded* when `img.onload` fires, so what moves off-thread is the **`drawImage` resample + `getImageData` readback**, not the initial browser decode. Mechanism: on the main thread create an `ImageBitmap` from the loaded image (`createImageBitmap`), **transfer it (zero-copy Transferable)** into the worker; the worker draws it to an **OffscreenCanvas**, resamples to the ≤2000px cap, calls `getImageData`, then box-samples.
- **D-02:** The worker must replicate `getImagePixels()`'s draw path exactly — same `maxDimension = 2000` cap and same canvas/`imageSmoothing` defaults — because parity depends on the **resample bytes**, not just the averaging math. `boxSampleImage` from `src/engine/ingest.ts` is reused **verbatim** (pure integer math, no reimplementation).
- **D-03:** Rejected (a) "raw Blob → decode entirely in worker": higher parity risk and Firefox blocks on `createImageBitmap(blob)` inside a worker (defeats the responsiveness goal). Rejected (c) "box-sample only, decode stays on main": guaranteed parity but leaves the resample/readback hitch on main — user chose fuller de-jank.

### Worker topology
- **D-04:** Adopt topology option **A** — fold decode+resample+box-sample **into the existing `src/engine/matcher.worker.ts`** as one step of the match request. A single `postMessage` carries the transferred `ImageBitmap` (+ rows/cols) into the worker → resample → box-sample → match → single round-trip back.
- **D-05:** Reuse the **existing monotonic `currentRunId` / `runSeq` abort scheme** (the B2 fix) to cancel the *entire* pipeline (decode + sample + match) atomically when a new image/dimension/palette supersedes an in-flight run. Add a `runId === currentRunId` guard **before** the box-sample/match work so a superseded decode bails at the existing boundary. Do **not** introduce a second worker or a second abort channel — keeping abort unified is the whole point (avoids re-splitting what B2 fixed). The palette-hash cache in the worker stays as-is.
- **D-06:** `MatcherClient` (`src/engine/worker-client.ts`) `match()` signature changes to accept the source (`ImageBitmap` + dims) instead of a pre-sampled `Uint8ClampedArray`, and transfers the `ImageBitmap`. The hook's public input surface (`image: HTMLImageElement`) is **unchanged** — the `createImageBitmap(image)` call is added inside the hook.

### Browser fallback
- **D-07:** **Hard-fail, single worker-only decode path.** If worker-side OffscreenCanvas / `createImageBitmap` is unavailable (Safari < 16.4 — low single-digit share in 2026), surface a clear, actionable "update your browser" message through **Phase 11's existing error banner** (the reactive `error`/`actionError` seam). No permanent main-thread fallback path — keeps one implementation to hold bit-identical and matches the anti-legacy lean.
- **D-08:** Detect capability via an **init-time probe exposed as an injectable flag** (checked once at worker/hook init, not per-image). This flag is also the **jsdom/Vitest test seam** — tests inject the flag deterministically since jsdom has no OffscreenCanvas.

### Loading / progress UX
- **D-09:** **Phase-labeled single overlay.** Reuse the one existing loading overlay: show an **indeterminate** bar labeled **"Preparing image…"** during the async decode/resample interval, then flip to the **determinate** "Matching colors: {progress}%" the moment the worker's match `onProgress` fires. No new visual surface; preserves the existing invariant that the spinner never co-displays with the error banner (`loading` cleared on error).
- **D-10:** Worker-side **decode failures route through the same reactive `error` signal as match failures** (the hook's `error`, surfaced in the `matchError` banner) — **not** the imperative `actionError` seam — because decode is part of the reactive image→grid pipeline and must auto-clear on the next match. Generalize the banner copy from "Color matching failed:" to a stage-agnostic form (e.g. "Couldn't process the image:") so a decode-stage message reads correctly.

### Parity verification
- **D-11:** Verify bit-identical output via a **manual in-browser fixture check at phase-verification time** (run one fixture image through the old vs new pipeline in a real browser and diff the matched grid) — **not** a permanent automated real-browser harness. jsdom cannot test the moved decode path, so the existing pure-integer `boxSampleImage` unit test remains the CI gate for the math; the decode/resample parity is a **one-time manual gate**, not a regression guard. (If a regression later appears here, revisit adding vitest browser mode / Playwright.)

### Claude's Discretion
- Exact message-shape additions to the `{kind:'match'}` payload, the OffscreenCanvas creation details in the worker, and how `createImageBitmap` is awaited within the hook's effect (including abort of a superseded in-flight `createImageBitmap`) are implementation details for research/planning, provided D-01…D-11 hold.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec & requirements
- `.planning/ROADMAP.md` § "Phase 13: Performance — Off-Main-Thread Decode" — goal, success criteria (UI responsive + bit-identical parity), depends-on Phase 11.
- `.planning/REQUIREMENTS.md` — **PERF-01** (review W8): decode + box-sampling must not block the main thread.

### Prior-phase dependency (error surface)
- `.planning/phases/11-storage-robustness-error-feedback/11-CONTEXT.md` — Phase 11's unified error banner (`actionError` seam) that D-07/D-10 route decode failures through. Confirm the exact `error` vs `actionError` wiring in code before implementing.

### Code the phase modifies (verify against live source)
- `src/features/match/useDiamondArtMatch.ts` — the match hook; owns `getImagePixels()` + `boxSampleImage()` today and the `{loading, progress, error}` surface (D-01, D-06, D-09, D-10).
- `src/engine/matcher.worker.ts` — target for folded decode step; owns the `currentRunId` abort + palette cache (D-04, D-05).
- `src/engine/worker-client.ts` — `MatcherClient.match()` signature/transfer change (D-06).
- `src/engine/ingest.ts` — `boxSampleImage()` reused verbatim; `calculateCropBounds` (D-02).
- `src/App.tsx` — loading overlay + `matchError` banner copy (D-09, D-10).

No external ADRs — implementation decisions fully captured in D-01…D-11 above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`boxSampleImage(srcPixels, srcW, srcH, cols, rows)`** (`src/engine/ingest.ts:75`) — pure, deterministic, integer averaging; move the *call site* into the worker unchanged. Its jsdom unit test stays the CI parity gate for the math.
- **`MatcherClient` runId/`runSeq` abort** (`src/engine/worker-client.ts`) + **worker `currentRunId`** (`matcher.worker.ts`) — the B2 supersede scheme; extend to cover decode, don't replace.
- **Worker `onError` + `worker.onerror` seams** (B1 fix, `worker-client.ts`) — already surface worker failures to the hook's `error`; decode errors reuse this path (D-10).
- **Phase 11 error banner** — reactive `error` → `matchError` banner in `App.tsx`; decode failures surface here.

### Established Patterns
- Module worker instantiated via `new Worker(new URL('./x.worker.ts', import.meta.url), {type:'module'})` — Vite bundles it natively; a folded decode step needs **no new worker file** (D-04).
- Hook returns a read-only signal surface `{matchResult, symbolMap, loading, progress, error, restore}`; App composes it and never touches the worker directly — keep this boundary.
- `loading` is always cleared on error so spinner and error banner never co-display — D-09 must preserve this.

### Integration Points
- Main→worker payload: extend the `{kind:'match', pixels, candidates, clearCache, cols, runId}` message to carry a transferred `ImageBitmap` + dims instead of a pre-sampled `pixels` buffer (D-06).
- jsdom test seam: the injectable capability flag (D-08) lets existing Vitest tests force the supported/unsupported branch without OffscreenCanvas.
</code_context>

<specifics>
## Specific Ideas

- Capability detection is a **single init-time probe surfaced as an injectable flag** (not per-image, not a scattered `typeof` check) — explicitly chosen so it doubles as the jsdom test seam.
- Banner copy should be **stage-agnostic** ("Couldn't process the image:") so one message reads correctly for both decode-stage and match-stage failures.
</specifics>

<deferred>
## Deferred Ideas

- **Automated real-browser parity gate** (vitest browser mode / Playwright) — considered for D-11 and deferred; revisit only if a resample-parity regression actually surfaces. Adds a browser test-runner dev-dependency, heavier than this phase warrants.
- Phases 10, 12, 14 remain deferred to a later milestone (unchanged by this discussion).

None of the above are in scope for Phase 13. Discussion stayed within phase scope.
</deferred>

---

*Phase: 13-performance-off-main-thread-decode*
*Context gathered: 2026-07-12*
