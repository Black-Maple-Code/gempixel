---
review: worker/persistence/commerce cluster
reviewed: 2026-07-11T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - src/engine/matcher.worker.ts
  - src/engine/worker-client.ts
  - src/engine/projectStore.ts
  - src/engine/checkout.ts
  - src/engine/types.ts
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Cluster Review: Worker / Persistence / Commerce

**Reviewed:** 2026-07-11
**Depth:** deep (cross-file: worker ↔ worker-client ↔ useDiamondArtMatch ↔ App.tsx; checkout ↔ App.tsx; projectStore ↔ App.tsx)
**Status:** issues_found

## Summary

All five files were read in full and traced across their call sites. The four known
concerns are **confirmed** with exact mechanisms below, and the concurrency concern (#2)
is worse than stated: the per-row `isAborted` check does **not** mitigate overlapping
calls, and the compounded effect can deliver a stale, wrong-dimensioned `matches` array
into `smoothMatches(matches, cols, rows)` — an incorrect-behavior / data-integrity bug,
not merely a cosmetic race. The `compileCanvasPartnerUrl` concern is real but currently
**latent** (the function is exported and unit-tested but never invoked by the UI —
`canvasTemplate` is collected and persisted but never compiled into an openable link).

Integrity spot-check of the two generated data files found no duplicate keys and good
palette validation coverage; details in the last section.

## Critical Issues

### CR-01: Abort flag is reset by the next match, so an in-flight run cannot be aborted — stale/wrong-dimension result delivered to newest callback

**Files:** `src/engine/matcher.worker.ts:10,17-18,50-52,91-95` + `src/engine/worker-client.ts:22-39` (consumer `src/features/match/useDiamondArtMatch.ts:100-128`)

**Issue:** Abort is a single module-level boolean with no per-run token. `match()` posts
`{kind:'abort'}` then `{kind:'match'}` (worker-client.ts:22-23). In the worker, `abort`
sets `isAborted=true` (line 16), but the next `match` immediately sets `isAborted=false`
(line 18) and starts a second `runMatching`. Because the worker is single-threaded and
`runMatching` #1 is only suspended at `await yieldToEventLoop()` (line 87), when it resumes
its next-row check `if (isAborted) return` (line 50) reads **false** (reset by the new
match). Tracing the event-loop ordering for every interleaving of the resume-timer vs the
`abort`/`match` message tasks, the reset always wins: **the prior run never aborts and runs
to completion, posting its own `{kind:'result'}` (line 95)** alongside the new run. The
shared `rgbaCache` (line 8) is also mutated by both runs concurrently.

On the client, `this.worker.onmessage` is reassigned on every `match()` call
(worker-client.ts:31), so the stale run's `result` is handled by the **newest** closure and
invokes the **newest** `onComplete` (worker-client.ts:34-35). That calls
`setRawMatchResult(staleResult)` in the hook (useDiamondArtMatch.ts:115-117). The stale
`matches` array length corresponds to the *previous* cols/rows, but `matchResult` then feeds
it into `smoothMatches(matches, cols, rows, …)` with the *current* dimensions
(useDiamondArtMatch.ts:146) — index/dimension mismatch producing a corrupted grid, wrong
supply counts, and possible out-of-range access.

**Failure scenario:** User drags the grid-size (cols) slider or rapidly toggles the active
palette. Effect fires match A, then match B before A finishes. A is not aborted, finishes
last, and its result (sized for the old grid) is written as the current grid, which is then
smoothed against the new dimensions. The preview and legend silently show the wrong output.

**Fix:** Give each match a monotonic run id; stamp it on every posted message and ignore
stale ones on both sides. Do not reset a shared flag mid-run.

```ts
// worker: track the active run id; abort by id, ignore superseded runs
let currentRunId = 0;
ctx.onmessage = async (e) => {
  const { kind } = e.data;
  if (kind === 'match') {
    const myRun = ++currentRunId;           // supersedes any prior run
    const { pixels, candidates, clearCache, cols } = e.data;
    try { await runMatching(myRun, pixels, candidates, cols, clearCache); }
    catch (err) { ctx.postMessage({ kind: 'error', runId: myRun, error: String(err?.message ?? err) }); }
  }
};
// inside runMatching loop: if (runId !== currentRunId) return;  // superseded
// post progress/result with { runId }

// client: capture the run id for this call and drop messages that don't match
public match(...) {
  const runId = ++this.runSeq;
  this.worker.postMessage({ kind: 'match', runId, pixels, candidates, clearCache, cols });
  this.worker.onmessage = (e) => {
    if (e.data.runId !== runId) return;      // stale run, ignore
    ...
  };
}
```

### CR-02: `projectStore.save()` silently deletes the user's oldest project on quota — unannounced data loss

**File:** `src/engine/projectStore.ts:107-133`

**Issue:** On `QuotaExceededError`, `save()` picks the oldest *other* registry entry
(`registry.findIndex(p => p.id !== summary.id)`, line 120), `removeItem`s its project blob
(line 127) **and drops it from the registry**, then retries — looping until the write
succeeds or nothing is left to evict (line 121). This permanently destroys a previously
saved project with **no return value, no thrown error, and no user warning** — the caller
in App.tsx (`projectStore.save(...)` around line 362-368) has no way to know a project was
deleted. Because grids are large (`gridData: number[]`), quota is realistically reached, so
this is a live data-loss path, not a theoretical one.

**Failure scenario:** Artist has several saved commissions. Saving a new large-grid project
exceeds localStorage quota; their earliest commission (with its own gridData) is silently
removed. On next visit it is simply gone.

**Fix:** Never evict another project implicitly. Surface the quota failure to the caller
(return a status or throw) so the UI can prompt the user to delete something explicitly.

```ts
save(summary, data): { ok: true } | { ok: false; reason: 'quota' } {
  ...
  try {
    localStorage.setItem(projectKey(data.id), JSON.stringify(data));
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    return { ok: true };
  } catch (err) {
    console.error('Project save failed (quota)', err);
    return { ok: false, reason: 'quota' };   // let the UI decide what to delete
  }
}
```

## Warnings

### WR-01: Worker `kind:'error'` is only `console.error`'d — loading state never clears (UI stuck forever)

**Files:** `src/engine/worker-client.ts:36-38` (error origin `src/engine/matcher.worker.ts:22-24`; consumer `src/features/match/useDiamondArtMatch.ts:104,111-120`)

**Issue:** The hook sets `setLoading(true)` (useDiamondArtMatch.ts:104) and only clears it in
the `onComplete` result callback (line 116) or in the synchronous `catch` around
`getImagePixels`/`match` (line 123). If `runMatching` throws inside the worker (e.g.
`matchColor` failure on a malformed candidate), the worker posts `{kind:'error'}`
(matcher.worker.ts:23), but worker-client's handler only logs it (worker-client.ts:37) and
never invokes any callback. There is no `onError` in the `match()` signature at all, so the
hook never learns of the failure: `loading` stays `true`, `progress` stays wherever it
stalled, and the spinner spins forever with no recovery path.

**Failure scenario:** A single worker-side exception during matching leaves the app in a
permanent "loading" state until full page reload; the user sees no error and no result.

**Fix:** Add an `onError` callback to `match()` and route `kind:'error'` to it; in the hook,
`setLoading(false)` (and expose an error state) on error.

```ts
// worker-client match(): add onError param
} else if (e.data.kind === 'error') {
  onError?.(e.data.error);
}
// hook: pass err => { console.error(err); setLoading(false); setError(err); }
```

### WR-02: `generateUUID` uses `Math.random()` — collision overwrites an existing project

**File:** `src/engine/projectStore.ts:53-59`

**Issue:** IDs are generated from `Math.random()` (line 55), not `crypto.randomUUID()`.
Beyond being non-cryptographic, the id is used directly as the localStorage key
(`projectKey(id)`, line 13) and as the registry primary key (`save` upsert keys on
`summary.id`, line 109). A collision (or a weak/patched `Math.random` in some embedded
webviews) silently overwrites another project's blob and registry row — data loss with no
detection.

**Failure scenario:** Two generated ids collide (or a low-entropy RNG environment); saving
the second project overwrites the first project's stored grid.

**Fix:** Use the platform CSPRNG with a graceful fallback.

```ts
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // fallback: crypto.getRandomValues-based v4 (still avoid Math.random)
  ...
}
```

### WR-03: `compileCanvasPartnerUrl` treats a bad template as "just log it" and returns the string anyway; `new URL()` does not reject `javascript:`/`data:` schemes

**File:** `src/engine/checkout.ts:86-103`

**Issue:** `baseUrlTemplate` originates from user-editable, persisted state
(`canvasTemplate`, App.tsx:194-199,211 → localStorage `gempixel_canvas_template`, and
`project.canvasTemplate` on load, App.tsx:268). The function validates with `new URL(compiled)`
but **only logs on failure and still returns `compiled`** (checkout.ts:97-102). Two problems:
(1) an invalid URL is returned and would be handed to a consumer as if valid; (2)
`new URL('javascript:alert(1)')` and `new URL('data:text/html,...')` **do not throw** —
`URL` accepts those schemes — so the guard would pass a script/redirect URL. Values are
correctly `encodeURIComponent`-escaped for the token substitutions (lines 91-94), so the
*injected* width/height/shape are safe; the risk is the **template scheme itself**. This is
currently **latent**: `compileCanvasPartnerUrl` is only referenced by `checkout.test.ts` —
it is **not invoked anywhere in the app** (see IN-02), so `canvasTemplate` never actually
opens a link today. If/when it is wired to `window.open`/an `href` it becomes an
open-redirect / `javascript:`-scheme hazard.

**Failure scenario (once wired):** A pasted/imported template of `javascript:...` passes the
`new URL()` check and, in an anchor `href`, executes on click.

**Fix:** Reject on failure (don't return the bad string) and allowlist the scheme.

```ts
try {
  const u = new URL(compiled);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('scheme');
} catch {
  console.error('Invalid/unsafe canvas partner URL:', compiled);
  return '';               // do not hand back an unsafe/invalid URL
}
return compiled;
```

## Info

### IN-01: `clearCache` name shadowed in the worker message handler

**File:** `src/engine/matcher.worker.ts:1,19`

**Issue:** The imported function `clearCache` (line 1) is shadowed by the destructured
boolean `clearCache` from `e.data` (line 19). It works only because `runMatching` (module
scope) still sees the import, but the collision is a readability trap. Rename the payload
field to `clearCacheOption` (as the parameter already is) at the boundary.

### IN-02: `compileCanvasPartnerUrl` is dead in production; `canvasTemplate` is collected but never consumed into a link

**Files:** `src/engine/checkout.ts:86-103`, `src/App.tsx:194-212,268,365`

**Issue:** Cross-file trace: `compileCanvasPartnerUrl` is referenced only by
`checkout.test.ts`; no `.ts/.tsx` under `src/` outside tests calls it, and `canvasTemplate`
appears in App.tsx only as state/persistence and in `projectStore` serialization — it is
never turned into an openable URL. Either the "order custom canvas" partner flow is
unfinished (feature gap) or the compiler is orphaned code. Wire it up (with WR-03's fix) or
remove it and stop persisting `canvasTemplate`.

### IN-03: Data-file integrity spot-check — variants.ts & palette.ts

**Files:** `src/engine/variants.ts` (5106 lines, generated), `src/engine/palette.ts` (4058 lines, generated)

Checked via structural grep (not line-by-line):
- **variants.ts:** 449 top-level DMC keys, **no duplicate keys**. No `null`/`undefined`/`0`
  variant IDs. **4 entries have an empty `"round": {}`** (round shape with no bag sizes);
  `compileShopifyCartLink` handles these correctly via the `Object.keys(mapping).length === 0`
  guard (checkout.ts:46-50), routing them to the manual-search fallback handle — acceptable,
  but those 4 DMC round drills silently never produce a cart line.
- **palette.ts:** 250 entries, **no duplicate `dmc` codes**; no empty `kits`.
- **Validation coverage:** `palette.test.ts` asserts code-uniqueness, kit-100=100,
  kit-200=200, 50-overlap, and black/white Lab anchors — good. **There is no structural test
  for variants.ts** (nothing asserts variant-ID uniqueness, shape completeness, or that every
  palette DMC has a variant mapping). Recommend adding a variants integrity test mirroring the
  palette one, including a flag for the 4 empty-`round` entries.

---

_Reviewed: 2026-07-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
