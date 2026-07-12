# Codebase Concerns

**Analysis Date:** 2026-07-12

## Tech Debt

**`App.tsx` God component:**
- Issue: A single 2,250-line component holds the entire UI: the 4-step wizard, supply checklist, viewport HUD, project save/load modals, theme toggle, and all cross-cutting state. It declares **52 `useState`** hooks and **18 `useEffect`** hooks in one function body.
- Files: `src/App.tsx`
- Impact: Extremely hard to reason about, review, or safely modify. State-coupling bugs are easy to introduce; re-render performance is opaque; the file is a merge-conflict magnet. A partial extraction into `src/features/wizard/steps/*` and `src/features/match/useDiamondArtMatch.ts` has begun, but the orchestrating shell remains monolithic.
- Fix approach: Continue the feature-slice extraction. Move persisted-setting state (theme, substitution, smoothing, unmapped log — each with its own `localStorage` effect) into dedicated `useLocalStorageState`-style hooks. Lift supply-checklist and HUD state into their own hooks/components. Target: `App.tsx` as a thin composition root.

**Duplicated persisted-setting `useEffect` boilerplate:**
- Issue: Each localStorage-backed setting repeats the same lazy-init `useState(() => localStorage.getItem(...))` + `useEffect(() => localStorage.setItem(...))` pattern (substitution enable/threshold, smoothing enable/strength, theme, unmapped log). At least 5 near-identical pairs.
- Files: `src/App.tsx` (approx. lines 95-171)
- Impact: Copy-paste drift; a serialization/parse bug fixed in one place is easily missed in the others.
- Fix approach: Extract a single `usePersistentState(key, default, serde)` hook.

**Large hand-maintained data tables:**
- Issue: `variants.ts` (5,106 lines) maps DMC codes to Shopify variant IDs; `palette.ts` (4,058 lines) holds the DMC / Art Dot catalogs. These are effectively generated data checked in as source.
- Files: `src/engine/variants.ts`, `src/engine/palette.ts`
- Impact: Impossible to review by hand; a single wrong variant ID silently produces a broken cart line. No provenance/generation script is evident, so the data cannot be regenerated or diffed against a source of truth.
- Fix approach: Introduce a generation pipeline (source CSV/JSON → generated `.ts`) and a validation test that asserts every `DRILL_VARIANTS` entry references a known DMC code and has all expected bag sizes.

## Known Bugs

**Worker errors leave the UI stuck in "loading":**
- Symptoms: If the matching Web Worker throws, the client logs to console but the progress/loading spinner never clears and no result ever arrives.
- Files: `src/engine/worker-client.ts` (the `onmessage` handler treats `kind: 'error'` as `console.error` only), `src/features/match/useDiamondArtMatch.ts` (its `setLoading(false)` only runs inside `onComplete`)
- Trigger: Any exception inside `runMatching` in `src/engine/matcher.worker.ts` — e.g. a malformed candidate list or an out-of-memory condition on a very large grid.
- Workaround: None in-app; the user must reload. Fix: propagate an `onError` callback from `MatcherClient.match` up to the hook and have it call `setLoading(false)` and surface a message.

**`onmessage` reassigned per `match()` call (concurrency hazard):**
- Symptoms: `MatcherClient.match` overwrites `this.worker.onmessage` on every invocation and posts an `abort` immediately before the new `match`. Overlapping calls share one handler; a late `result`/`progress` message from a superseded run can invoke the newest call's callbacks.
- Files: `src/engine/worker-client.ts`
- Trigger: Rapid successive parameter changes (dimensions, palette) that each start a match before the prior one drains.
- Workaround: The row-loop `isAborted` check mitigates most stale results, but progress messages can still cross wires. Fix: attach `onmessage` once in the constructor and route by a per-request id.

## Security Considerations

**Non-cryptographic UUID generation:**
- Risk: `generateUUID` uses `Math.random()`, not `crypto.randomUUID()`. Collisions are improbable but possible, and IDs are predictable.
- Files: `src/engine/projectStore.ts`
- Current mitigation: None; IDs are only local project keys, so blast radius is limited to a single browser.
- Recommendations: Use `crypto.randomUUID()` with the current `Math.random` implementation as a fallback.

**Affiliate tag / partner URL templating:**
- Risk: `compileShopifyCartLink` writes `affiliateTag` into query params, and `compileCanvasPartnerUrl` interpolates a user/project-controlled `baseUrlTemplate`. Values originate from persisted project data.
- Files: `src/engine/checkout.ts`
- Current mitigation: `URLSearchParams` and `encodeURIComponent` encode the injected values, and `compileCanvasPartnerUrl` validates with `new URL(...)` (though it only logs on failure and still returns the string).
- Recommendations: Reject/blank the compiled partner URL when `new URL()` throws instead of returning an invalid string; consider whitelisting allowed partner hosts.

**Client-only privacy guarantee is undocumented in code:**
- Risk: The product promise ("no image ever leaves the client") is architectural, not enforced. A future `fetch`/analytics addition could silently break it.
- Files: `src/engine/ingest.ts`, `src/features/match/useDiamondArtMatch.ts`, `src/App.tsx`
- Current mitigation: No network calls exist today for image data.
- Recommendations: Add a test/lint guard that fails if `fetch`/`XMLHttpRequest`/`navigator.sendBeacon` appear in the image pipeline modules.

## Performance Bottlenecks

**Image decode + box-sampling run on the main thread:**
- Problem: `getImagePixels` (canvas draw + `getImageData`) and `boxSampleImage` execute synchronously on the UI thread before the worker is invoked. Only the CIEDE2000 matching is offloaded.
- Files: `src/features/match/useDiamondArtMatch.ts` (`getImagePixels`), `src/engine/ingest.ts` (`boxSampleImage`)
- Cause: Full-resolution `getImageData` on up-to-2000px images plus a nested per-cell averaging loop can block paint for large source images.
- Improvement path: Move decode/downsample into the worker via `createImageBitmap` + `OffscreenCanvas`, transferring the bitmap instead of a pixel array.

**Non-transferred pixel buffers:**
- Problem: `postMessage({ pixels, ... })` clones the `Uint8ClampedArray` rather than transferring it.
- Files: `src/engine/worker-client.ts`
- Cause: No transfer list passed to `postMessage`.
- Improvement path: Pass the underlying `ArrayBuffer` as a transferable (note: this consumes the buffer, so re-derive it per match).

## Fragile Areas

**`useDiamondArtMatch` dependency management:**
- Files: `src/features/match/useDiamondArtMatch.ts`
- Why fragile: The match-trigger effect uses a manually derived `candidatesKey` string and an `// eslint-disable-next-line react-hooks/exhaustive-deps` to avoid re-running on the fresh `activeCandidates` array reference. Any new dependency added to this effect will be silently omitted from the stale dep array.
- Safe modification: When adding inputs that should re-trigger matching, fold them into a derived key exactly like `candidatesKey`, and add a comment. Prefer memoizing `activeCandidates` upstream so the disable can eventually be removed.
- Test coverage: `src/features/match/__tests__/useDiamondArtMatch.test.tsx` exists but cannot catch the error path (worker error → stuck loading) described above.

**Checkout / pricing hardcoded tables:**
- Files: `src/engine/checkout.ts` (`VENDOR_REGISTRY`, `DEFAULT_PRICE_DB`, per-vendor `pricingPoints`, `uploadUrl`s)
- Why fragile: Vendor prices, shipping, square-inch rates, and upload URLs are baked into source. When a vendor changes pricing or a Shopify variant ID rotates, cart totals and links break with no runtime signal.
- Safe modification: Treat these as data with an owner and a "last verified" date; add tests asserting interpolation monotonicity and that `uploadUrl`s parse as URLs.

## Scaling Limits

**localStorage as the only persistence tier:**
- Current capacity: Browser localStorage (~5-10 MB per origin). Projects store full `gridData` arrays and recents store base64 image `dataUrl`s.
- Limit: A handful of projects plus recent images can exhaust quota quickly because base64 images and per-cell grids are large.
- Scaling path: Move image/grid blobs to IndexedDB (async, far higher quota); keep only lightweight summaries in localStorage.

## Dependencies at Risk

**Silent quota eviction destroys user data:**
- Risk: `projectStore.save` and `recents.save` silently evict the oldest project / recent image on `QuotaExceededError`, retrying in a loop, and only `console.error` if nothing can be freed.
- Impact: A user can lose a saved project with no warning or undo the moment storage fills.
- Migration plan: Surface an in-UI warning before eviction, or move to IndexedDB (see Scaling Limits) to make eviction unnecessary.

## Missing Critical Features

**No user-facing error surface / observability:**
- Problem: Every failure path in the codebase resolves to `console.error` (worker errors, thumbnail generation, project load/save, invalid partner URL). There is no error boundary, toast, or telemetry.
- Blocks: Users cannot tell when a match failed, a project failed to save, or a cart link is malformed; maintainers get no signal from the field.

**No linting / formatting configuration:**
- Problem: The code contains `eslint-disable` comments referencing `react-hooks/exhaustive-deps`, but no `.eslintrc*`, `eslint.config.*`, or `.prettierrc*` exists in the repo. TypeScript `strict` + `noUnused*` in `tsconfig.json` is the only static gate.
- Blocks: React-hooks lint rules that would have flagged the fragile dependency arrays are not actually enforced; style is unenforced.

## Test Coverage Gaps

**Worker error / loading-stuck path:**
- What's not tested: The worker `kind: 'error'` path and its effect on `useDiamondArtMatch` loading state.
- Files: `src/engine/worker-client.ts`, `src/engine/matcher.worker.ts`, `src/features/match/useDiamondArtMatch.ts`
- Risk: The stuck-spinner bug above can regress undetected.
- Priority: High

**`App.tsx` orchestration logic:**
- What's not tested: With 52 pieces of state and 18 effects concentrated in one component, only `src/__tests__/App.test.tsx` and `integration.test.tsx` exercise it at a coarse level. State interactions (persisted-setting effects, quota eviction feedback, HUD/viewport modes) are largely uncovered.
- Files: `src/App.tsx`
- Risk: Refactors and feature additions can break state coupling silently.
- Priority: Medium

**Vendor/variant data integrity:**
- What's not tested: No assertion that `DRILL_VARIANTS` entries reference valid DMC codes or have complete bag-size mappings, nor that `pricingPoints` are monotonic and `uploadUrl`s are valid URLs.
- Files: `src/engine/variants.ts`, `src/engine/palette.ts`, `src/engine/checkout.ts`
- Risk: A single bad ID or price silently corrupts a cart or estimate.
- Priority: Medium

---

*Concerns audit: 2026-07-12*
