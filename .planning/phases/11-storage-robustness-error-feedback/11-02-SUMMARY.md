---
phase: 11-storage-robustness-error-feedback
plan: 02
subsystem: app-shell
tags: [localStorage, preact, hooks, persistence, codecs, vitest, jsdom, migration]

# Dependency graph
requires:
  - phase: 11-01
    provides: safeStorage guard + usePersistentState hook + format-preserving codecs (consumed here)
provides:
  - App.tsx 7 persisted settings migrated onto usePersistentState (boilerplate removed, IN-01)
  - customTemplateCodec preserving the heartfuldiamonds→adiamondpainting normalization (Pitfall 4)
  - Step3Canvas clear-log routed through safeStorage.removeItem (STORE-01)
  - Blocked-storage <App/> mount regression test (STORE-01)
affects: [11-03 (actionError banner + guarded checkout log — same file, builds on this migration)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy-init useState + write-effect pairs collapsed to single usePersistentState calls"
    - "Per-setting custom Codec for format-preserving migration (canvasTemplate legacy-host normalization)"
    - "Storage.prototype spy (throw-on-access) to simulate private/blocked storage in a mount test"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/features/wizard/steps/Step3Canvas.tsx
    - src/__tests__/App.test.tsx

key-decisions:
  - "safeStorage NOT imported into App.tsx this wave: it would be a dead import (noUnusedLocals fails tsc) because the only remaining raw localStorage calls (checkout log, App.tsx:981/984) are explicitly deferred to Plan 11-03. All Wave-2 truths are satisfied via usePersistentState, which routes through safeStorage internally."
  - "canvasTemplate uses a custom Codec<string> (parse normalizes legacy heartfuldiamonds host → adiamondpainting default, serialize is identity) instead of codecs.string, preserving the L198-201 migration (Pitfall 4)."
  - "theme migrated onto usePersistentState but its document.documentElement.dataset.theme DOM side-effect kept as a separate one-line useEffect (Note A) — not folded into the generic hook."
  - "unmappedLog lazy-init read migrated onto usePersistentState (Note B); its imperative checkout writes at App.tsx:981/984 left untouched for Plan 11-03. Consequence: an empty log now persists as '[]' (was removeItem→null) — format-consistent JSON, reads back as []."

patterns-established:
  - "Migrating an existing lazy-init/write-effect pair to usePersistentState is a drop-in that preserves setter names and on-disk formats"

requirements-completed: [STORE-01, STORE-02]

coverage:
  - id: D3
    description: "<App/> mounts and renders its shell under fully-blocked storage (Storage.prototype throwing) without throwing"
    requirement: "STORE-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#mounts under blocked storage without throwing"
        status: pass
    human_judgment: false
  - id: D4
    description: "All 7 App.tsx persisted settings read/write exclusively through usePersistentState; keys and on-disk formats unchanged"
    requirement: "STORE-02"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx (existing seeded-key/format assertions still green after migration)"
        status: pass
      - kind: static
        ref: "grep: no localStorage.setItem/getItem for the 7 migrated keys remains in App.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-12
status: complete
---

# Phase 11 Plan 02: App.tsx Storage Migration Summary

**Migrated the 7 unguarded persisted settings in `App.tsx` onto the Wave-1 `usePersistentState` hook (deleting the duplicated lazy-init + write-effect boilerplate), guarded the `Step3Canvas` clear-log through `safeStorage`, and added a blocked-storage `<App/>` mount regression test — keys and on-disk formats frozen.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-12
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- The 7 persisted settings (`theme`, `enableSubstitution`, `substitutionThreshold`, `enableSmoothing`, `smoothingStrength`, `affiliateTag`, `affiliateApp`, `canvasTemplate`) plus the `unmappedLog` lazy-init read now flow through the guarded `usePersistentState` hook — no inline `localStorage.getItem` init or `localStorage.setItem` write-effect remains for those keys (STORE-02, IN-01).
- `canvasTemplate` migration preserved via a custom `Codec<string>` (`customTemplateCodec`) that normalizes the legacy `heartfuldiamonds` host to the current `adiamondpainting` default on read; serialize is identity (Pitfall 4).
- `theme` DOM side-effect (`document.documentElement.dataset.theme = theme`) retained as its own one-line effect, decoupled from persistence (Note A).
- `Step3Canvas` "Clear Log" button routes through `safeStorage.removeItem` — no unguarded throw on a blocked store (STORE-01, T-11-05).
- New `App.test.tsx` case mounts `<App/>` with `Storage.prototype.getItem`/`setItem` spied to throw a `SecurityError` and asserts the `h1` 'GemPixel' shell renders with no exception (STORE-01, T-11-03); `vi.restoreAllMocks()` added to `afterEach` so the spies do not leak.
- `npx tsc --noEmit` clean; full `npm test` green at **167/167** (166 Wave-1 baseline + 1 new blocked-storage case).

## Task Commits

1. **Task 1: Migrate the 7 persisted settings in App.tsx** — `cf39767` (refactor) — 51 insertions / 81 deletions; 7 lazy-init/write-effect pairs collapsed to `usePersistentState` one-liners, custom template codec added, theme DOM effect preserved.
2. **Task 2: Guard Step3Canvas clear-log + blocked-storage mount test** — `96f3fb1` (feat) — `safeStorage.removeItem` in the clear-log handler, new blocked-storage mount test, `vi.restoreAllMocks()` in `afterEach`, format-safe clear-log assertion.

## Files Modified
- `src/App.tsx` — 8 storage-backed states (7 settings + unmappedLog read) migrated to `usePersistentState`; `customTemplateCodec` + `DEFAULT_CANVAS_TEMPLATE` added at module scope; theme DOM effect kept standalone; 7 write-effects deleted.
- `src/features/wizard/steps/Step3Canvas.tsx` — imports `safeStorage`; clear-log `onClick` calls `safeStorage.removeItem('gempixel_unmapped_colors_log')`.
- `src/__tests__/App.test.tsx` — new blocked-storage mount case; `vi.restoreAllMocks()` in `afterEach`; clear-log assertion made format-safe.

## Decisions Made
- **`safeStorage` intentionally NOT imported into App.tsx this wave.** The plan/key_links called for it, but `tsconfig` sets `noUnusedLocals: true` and the only remaining raw `localStorage` calls in App.tsx (the checkout unmapped-log read/write at `App.tsx:981/984`) are explicitly deferred to Plan 11-03. Importing `safeStorage` now would be a dead import that fails the required `npx tsc --noEmit`. Plan 11-03 introduces the import naturally when it guards those two lines. All Wave-2 must-have truths are met via `usePersistentState` (which routes through `safeStorage` internally).
- **`canvasTemplate` custom codec, not `codecs.string`** — preserves the `heartfuldiamonds→adiamondpainting` normalization on read (Pitfall 4), which a plain string codec would drop.
- **`affiliateApp` uses `codecs.string as unknown as Codec<'ref'|'rfsn'|'none'>`** — the value is a raw-string union, so the string codec (not `json`) preserves the exact stored format.

## Deviations from Plan

### Auto-fixed / Blocking-issue resolutions

**1. [Rule 3 — Blocking issue] Omitted the `safeStorage` import in App.tsx**
- **Found during:** Task 1 typecheck planning.
- **Issue:** The plan's action/acceptance/key_links call for `import { safeStorage } from './engine/safeStorage'` in App.tsx, but `noUnusedLocals: true` makes an unused import fail the required `tsc --noEmit`. App.tsx's only remaining raw `localStorage` calls are the checkout log read/write, which the same plan (and Plan 11-03 key_links) explicitly reserve for Wave 3.
- **Fix:** Left `safeStorage` out of App.tsx; all persistence still routes through `usePersistentState` → `safeStorage`. Plan 11-03 will add the import when it guards `App.tsx:981/984`.
- **Files modified:** src/App.tsx
- **Commit:** cf39767

**2. [Rule 1 — Bug] Updated the clear-log test assertion for the migrated persistence**
- **Found during:** Task 2 full-suite run.
- **Issue:** The existing test `renders logged unmapped colors lists and handles clear action` asserted `localStorage.getItem('gempixel_unmapped_colors_log')` is `null` after "Clear Log". That was coupled to the old `removeItem`-only behavior. Now that `unmappedLog` is a `usePersistentState`, `setUnmappedLog([])` fires the hook's write-effect and re-persists `'[]'`, racing the `removeItem` — the assertion passed in isolation but failed under different timing in the full suite.
- **Fix:** Changed the assertion to `JSON.parse(localStorage.getItem(...) ?? '[]')` `toEqual([])` — order-independent and format-consistent (both `null` and `'[]'` denote an empty log). The user-visible assertion (`'No unmapped colors logged.'`) is unchanged.
- **Files modified:** src/__tests__/App.test.tsx
- **Commit:** 96f3fb1

## Issues Encountered
- The full-suite stderr shows a `Match failed: worker exploded` trace — this originates from a pre-existing intentional worker-failure test case, not a regression; the suite exits 0 at 167/167.

## User Setup Required
None — pure client-side code change, no new dependencies, no external configuration.

## Next Phase Readiness
- Plan 11-03 (Wave 3) can now build on the migrated App.tsx: it introduces the unified `actionError` banner, folds `saveErrorMsg` in, and guards the checkout unmapped-log read/write at `App.tsx:981/984` through `safeStorage` (adding the `safeStorage` import there). No same-file migration conflict remains.
- No blockers.

## Self-Check: PASSED

---
*Phase: 11-storage-robustness-error-feedback*
*Completed: 2026-07-12*
