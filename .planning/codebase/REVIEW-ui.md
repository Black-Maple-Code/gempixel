---
cluster: UI/features (App.tsx orchestrator, entry, match hook, wizard hook + 4 wizard steps)
reviewed: 2026-07-11
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/App.tsx
  - src/main.tsx
  - src/features/match/useDiamondArtMatch.ts
  - src/features/wizard/useWizard.ts
  - src/features/wizard/steps/Step1Ingest.tsx
  - src/features/wizard/steps/Step2Palette.tsx
  - src/features/wizard/steps/Step3Canvas.tsx
  - src/features/wizard/steps/Step4Export.tsx
cross_referenced:
  - src/engine/worker-client.ts (to confirm worker error path)
findings:
  critical: 1
  warning: 5
  info: 9
  total: 15
status: issues_found
---

# UI/Features Cluster — Code Review (deep)

**Reviewed:** 2026-07-11
**Depth:** deep
**Files Reviewed:** 8 (+1 cross-referenced)
**Status:** issues_found

## Summary

Deep review of the wizard/orchestrator cluster. The known suspected stuck-loading bug is
**CONFIRMED** at file:line and elevated to BLOCKER — a worker error permanently strands the
loading overlay with no in-session recovery. Two additional real correctness bugs were found
in the project load path (saved canvas price is silently clobbered on load; saved grids are
re-processed through substitution+smoothing on load using the *current* global toggles, not
the saved ones). A cluster-wide robustness gap: only `theme`/`unmappedLog` guard their
localStorage access — every other persisted setting reads and writes storage unguarded, so a
privacy-mode / quota-blocked browser (exactly this app's target audience) crashes on mount.
No user-facing error surface exists; every failure is `console.error`.

The suspected "leaked ObjectURLs from ingest" concern is **REFUTED**: ingest uses
`FileReader.readAsDataURL` (data URLs), never `URL.createObjectURL`, so there is nothing to
revoke. The worker IS terminated on unmount (`useDiamondArtMatch.ts:89-92`). The
`candidatesKey` eslint-disable is **correct** — adding the raw `activeCandidates` array would
re-run the match every render; keying on joined dmc codes is the right stabilization (latent
risk only, noted in IN-04).

---

## Critical Issues

### CR-01: Worker error permanently strands the loading overlay (setLoading(false) unreachable on failure)

**File:** `src/features/match/useDiamondArtMatch.ts:100-128` + `src/engine/worker-client.ts:31-39`
**Issue:** `setLoading(true)` is set on every match trigger (`useDiamondArtMatch.ts:104`), but
`setLoading(false)` runs in only two places: the synchronous `catch` (line 123) and the
worker `onComplete` callback (line 116). If the worker fails *after* it starts — it posts
`{ kind: 'error' }` or throws uncaught — neither path fires:

- `worker-client.ts:36-38` handles `e.data.kind === 'error'` by calling **only**
  `console.error(...)`; it never invokes `onComplete` (or any error callback — none exists in
  the `match()` signature).
- There is **no `worker.onerror` handler at all**, so an uncaught worker exception is dropped
  entirely.

Result: `loading` stays `true` forever. The loading overlay (`App.tsx:1629-1636`) covers the
entire canvas viewport (`absolute inset-0`) and never clears for the rest of the session; the
core function (viewing the chart) is blocked with no recovery except a full page reload.

**Failure scenario:** User loads an image whose match run trips any worker-side error (bad
pixel buffer, OOM on a large grid, a throw inside `matcher.worker.ts`). The progress bar
freezes at its last percent and "Matching colors: N%" stays on screen indefinitely.

**Fix:** Add an error callback to the worker-client contract and clear loading on both the
error message and `worker.onerror`:

```ts
// worker-client.ts — thread an onError through match(...)
public match(pixels, candidates, onProgress, onComplete, cols?, onError?) {
  // ...
  this.worker.onmessage = (e) => {
    if (e.data.kind === 'progress') onProgress(e.data.percent);
    else if (e.data.kind === 'result') onComplete({ matches: e.data.matches, counts: e.data.counts });
    else if (e.data.kind === 'error') { console.error('Worker error:', e.data.error); onError?.(e.data.error); }
  };
  this.worker.onerror = (ev) => { console.error('Worker crashed:', ev); onError?.(ev.message); };
}
```
```ts
// useDiamondArtMatch.ts — clear loading (and surface it) on failure
clientRef.current?.match(downsampled, activeCandidates,
  pct => setProgress(pct),
  result => { setLoading(false); setRawMatchResult(result); },
  cols,
  () => { setLoading(false); /* + set a user-visible error state, see WR-05 */ }
);
```

---

## Warnings

### WR-01: Restored canvas price is immediately overwritten on project load (saved value lost)

**File:** `src/App.tsx:266` vs `src/App.tsx:214-227`
**Issue:** `loadProject` restores the user's saved canvas price via
`setCanvasBaseCost(project.kitBaseCost ?? 15.0)` (line 266). But `loadProject` also sets
`activeProjectId`, `widthInput`, `heightInput`, and `unit`, which are dependencies of the
cost-recompute effect at 214-227. That effect runs right after load, hits the
`activeProjectId` guard (now truthy), recomputes `calculateCanvasCost(w, h, unit, vendor)`,
and calls `setCanvasBaseCost(cost)` — **overwriting** the just-restored `kitBaseCost`. The
user's saved custom canvas price never survives a reload.

**Failure scenario:** User overrides the canvas price to $25, saves, reloads the project → the
price shows the auto-computed vendor cost instead of $25, silently changing the cost estimate.

**Fix:** Guard the recompute effect so it does not run on the render that restores a project
(e.g., track a `justLoadedRef` set in `loadProject` and skipped once in the effect), or only
auto-recompute cost when the user actually changes dimensions/vendor rather than on
`activeProjectId` transitions.

### WR-02: Saved grids are re-processed through substitution + smoothing on load, using current global toggles

**File:** `src/App.tsx:280-292` (loadProject) → `src/features/match/useDiamondArtMatch.ts:130-162`
**Issue:** A saved project's `gridData` is the **final** (already substituted + smoothed) grid.
On load, `loadProject` feeds it into `restore({ matches, counts })`, which sets
`rawMatchResult`. The `matchResult` useMemo then re-applies `substituteLowCountColors` and
`smoothMatches` to it (lines 136-149) — treating the finished grid as a raw grid. Worse, it
uses the **current** `enableSubstitution`/`substitutionThreshold`/`enableSmoothing`/
`smoothingStrength` values, which `loadProject` does **not** restore. So the reloaded chart
can differ from what was saved depending on the session's global toggle state (e.g. smoothing
runs a second pass over an already-smoothed grid, reshaping fine detail).

**Failure scenario:** User saves a project with smoothing off; later, with smoothing on
globally, they reload it → the grid is smoothed on load and no longer matches the saved image.

**Fix:** Bypass the post-processing pipeline for restored grids (e.g. have `restore()` set a
"pre-processed" flag that short-circuits the useMemo to return the raw restored grid), and/or
persist and restore the four processing toggles alongside `gridData`.

### WR-03: localStorage reads/writes are unguarded across the cluster — blocked/full storage crashes the app

**File:** `src/App.tsx:129, 134, 139, 144, 157, 161, 165, 169, 189, 192, 195, 203, 207, 211`
**Issue:** Only `theme` (95-109) and `unmappedLog` (147-153) wrap localStorage access in
try/catch. Every other persisted setting reads storage in a lazy `useState` initializer
(`enableSubstitution` 129, `substitutionThreshold` 134, `enableSmoothing` 139,
`smoothingStrength` 144, `affiliateTag` 189, `affiliateApp` 192, `canvasTemplate` 195) and
writes it in an unguarded effect (157, 161, 165, 169, 203, 207, 211). In browsers where
`localStorage` throws on access (Safari private mode historically, storage disabled, quota
exceeded on write), the unguarded **read in a render-phase initializer throws and the whole
App fails to mount** — a blank screen. This is especially likely for a "privacy-first" app
whose users disable storage.

**Failure scenario:** User has site storage blocked → `localStorage.getItem(...)` throws during
`useState(() => ...)` → React never renders the app.

**Fix:** Wrap every read/write in try/catch (mirror the `theme` pattern), or centralize into a
`safeStorage` helper with get/set fallbacks. This also removes the duplicated boilerplate
(see IN-01).

### WR-04: handleShopifyCheckout parses stored log unguarded — corrupted value throws and checkout silently dies

**File:** `src/App.tsx:999`
**Issue:** `JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') || '[]')` runs
inside the checkout click handler with no try/catch. If that key holds corrupted JSON (partial
write, manual tampering, another tab), `JSON.parse` throws, the handler aborts before opening
the cart, and — with no error surface (WR-05) — the "Buy Supplies" button appears to do
nothing.

**Failure scenario:** Corrupted `gempixel_unmapped_colors_log` → clicking checkout throws
silently → user cannot order and gets no feedback.

**Fix:** Wrap the parse in try/catch defaulting to `[]` (the lazy initializer at 147-153
already does exactly this — reuse that pattern here).

### WR-05: No user-facing error surface — all failures are silent console.error

**File:** `src/App.tsx:867, 892`; `src/features/match/useDiamondArtMatch.ts:122-123`
**Issue:** Every failure path terminates in `console.error` with no UI feedback:
`handleDownloadCanvasOnly` (867), `handleDownloadCombinedCanvasSheet` (892), and the match
`try/catch` (getImagePixels context failure / box-sample failure) at 122-123. Combined with
CR-01 (stuck loading) and WR-04, a user hitting any of these sees either nothing or a frozen
spinner and cannot tell whether the app is working.

**Failure scenario:** A download fails (e.g. canvas too large / tainted) → the button click
produces no download and no message; the user retries indefinitely.

**Fix:** Add a lightweight toast/inline error state (a single `error: string | null` state +
banner) and set it in these catch blocks and in the CR-01 worker error path.

---

## Info

### IN-01: Duplicated persisted-setting effect boilerplate (~7 near-identical read/write pairs)
**File:** `src/App.tsx:156-170, 202-212` (+ lazy initializers 127-146, 188-200)
**Issue:** Seven `useEffect(() => localStorage.setItem(key, value.toString()), [value])` blocks
plus matching lazy initializers repeat the same pattern. Confirms the known concern.
**Fix:** Extract a `usePersistentState(key, default, codec)` hook (also fixes WR-03 centrally).

### IN-02: loadProject leaves several settings stale from the previous project/session
**File:** `src/App.tsx:251-293`
**Issue:** `loadProject` restores many fields but not `canvasShippingEstimate`, `drillBagSize`,
`optimizeBagsCost`, `selectedVendor`, or the four processing toggles (WR-02). Loading a
project inherits those from whatever was on screen, so cost/estimate can be inconsistent with
the saved project.
**Fix:** Restore the full persisted set, or route load through a reset-then-apply that clears
non-persisted UI state first.

### IN-03: gridData round-trip can silently turn unknown colors black
**File:** `src/App.tsx:337-339` (save) and `src/App.tsx:281` (load)
**Issue:** Save maps codes to `DMC_PALETTE.findIndex(...)`; an unknown code yields `-1`. Load
reads `DMC_PALETTE[idx]?.dmc || '310'`, so `idx === -1` → `undefined` → falls back to `'310'`
(black). Currently unreachable because all match codes originate from `DMC_PALETTE`, but it is
a latent silent-corruption path with no guard/warning.
**Fix:** On save, drop/patch codes whose `findIndex` is `-1` and log; on load, validate indices.

### IN-04: candidatesKey is keyed on dmc only — latent stale-match if candidate attributes ever change without dmc changing
**File:** `src/features/match/useDiamondArtMatch.ts:97, 125-128`
**Issue:** The match re-trigger key is `activeCandidates.map(c => c.dmc).join(',')`. If a
candidate's `hex`/Lab ever changed while its `dmc` stayed the same (e.g. a future editable
palette), the match would not re-run. Safe today (palette is a static catalog) — the
eslint-disable is correct — but worth a comment/guard if the palette ever becomes mutable.
**Fix:** Include a hash of the relevant candidate fields in the key if candidates become editable.

### IN-05: substitutionThreshold lazy-init can produce NaN from a corrupted stored value
**File:** `src/App.tsx:132-136`
**Issue:** `parseInt(saved, 10)` with no NaN guard (unlike the slider inputs which use `|| 1`).
A corrupted `gempixel_substitution_threshold` yields `NaN`, which then flows into
`substituteLowCountColors` as the threshold.
**Fix:** `const n = parseInt(saved ?? '', 10); return Number.isFinite(n) ? n : 15;`

### IN-06: printLegendSheetOnly can leak an afterprint listener and leave the print-only class applied
**File:** `src/App.tsx:896-904`
**Issue:** The cleanup that removes `print-only-legend-mode` and the `afterprint` listener runs
**only** when `afterprint` fires. Some browsers do not fire `afterprint` on a cancelled print
dialog, leaving the class on `document.body` and the listener attached (accumulating on repeat
use).
**Fix:** Also remove the class on a timeout / on the next `focus`, and guard against
double-registration.

### IN-07: App.tsx God component (confirmed)
**File:** `src/App.tsx` (2251 lines, 52 `useState`, 18 `useEffect`)
**Issue:** Confirms the known concern. Beyond size, it concentrates the cross-cutting bugs
above (load path, persistence, cost recompute) in one place, making the coupling in WR-01/WR-02
hard to see. Out of scope to fix here; flagged for the maintenance backlog.
**Fix:** Continue the extraction already begun (hooks/step components); pull the load/save and
persistence concerns into dedicated hooks.

### IN-08: Test bypass via user-agent sniffing in production code
**File:** `src/App.tsx:66`
**Issue:** `isTestEnv = navigator.userAgent.includes('jsdom')` ships in production and drives
wizard-navigation bypass logic (`useWizard.goTo`). Harmless today but couples prod behavior to
a UA string.
**Fix:** Inject test-env via a build flag / prop rather than UA sniffing.

### IN-09: Dimension-sync effect double-source-of-truth clobber (documented latent fragility)
**File:** `src/App.tsx:540-555` (and the explanatory note at 395-401)
**Issue:** The `[cols, rows, unit]` effect rewrites `widthInput`/`heightInput` from `cols`/`rows`
while the `handleWidthChange`/`handleHeightChange` handlers also write them, using
`document.activeElement` focus detection to arbitrate. In cm/inch mode this can overwrite a
handler's `toFixed(1)` value with a round-tripped grid value, causing minor input drift, and
is the reason `resolveActiveCandidates` cannot be memoized (per the code comment). Known,
documented; noting for the record.
**Fix:** Make grid size the single source of truth and derive the display inputs purely, or
debounce/decouple the sync effect from the handlers.

---

_Reviewed: 2026-07-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
