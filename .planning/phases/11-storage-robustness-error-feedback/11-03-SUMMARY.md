---
phase: 11-storage-robustness-error-feedback
plan: 03
subsystem: app-shell
tags: [error-feedback, banner, localStorage, safeStorage, preact, vitest, jsdom, ERR-01]

# Dependency graph
requires:
  - phase: 11-01
    provides: safeStorage guard (guarded getItem/setItem for the checkout unmapped-log read/write)
  - phase: 11-02
    provides: App.tsx storage migration already applied (avoids a same-file conflict; deferred the safeStorage import to this wave)
provides:
  - Unified actionError/setActionError banner in App.tsx (single text-only surface for save/download/checkout failures, ERR-01)
  - Guarded checkout unmapped-colors-log parse (corrupt value -> [] + banner, checkout proceeds; W4/T-11-06)
  - safeStorage import + guarded read/write in handleShopifyCheckout (no raw localStorage remains there)
  - Three ERR-01 integration cases in App.test.tsx (download failure, corrupt-log checkout, save-quota regression)
affects: [ERR-01 requirement closed; Phase 11 complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One generic one-shot actionError banner (useState<string|null>) folding a prior single-purpose error state, with clear-then-act discipline at each handler start"
    - "Guarded inline JSON.parse via an IIFE: safeStorage.getItem -> try/parse -> catch sets banner + returns [] fallback so the flow proceeds"
    - "vitest module mock with importOriginal to override a single named export (triggerCanvasDownload throws; compileShopifyCartLink returns unmapped items) while preserving the rest"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/__tests__/App.test.tsx

key-decisions:
  - "Adopted RESEARCH Option B: one generic actionError/setActionError replaces saveErrorMsg entirely; the two download catches, the checkout parse-failure catch, and the folded save-quota path all set it via setActionError."
  - "Banner placed at top-16 (distinct from the matchError banner at top-4) with a dismiss x (aria-label 'Dismiss error'); renders {actionError} as a plain JSX text child (never dangerouslySetInnerHTML) per ASVS output-encoding (T-11-07)."
  - "checkout unmapped-log read/write routed through safeStorage; the previously unguarded JSON.parse wrapped in try/catch -> [] fallback so a corrupt value can no longer silently kill checkout (W4/T-11-06)."
  - "In tests, the corrupt log is seeded AFTER mount because usePersistentState's write-effect rewrites the key to '[]' on mount; compileShopifyCartLink is mocked to guarantee an unmapped item so the guarded-parse branch is exercised deterministically."

patterns-established:
  - "Unified action-error banner surface: imperative one-shot failures set a single actionError state instead of ad-hoc per-feature error states or silent console.error-only no-ops"

requirements-completed: [ERR-01]

coverage:
  - id: W5-download
    description: "A failed canvas download surfaces the actionError banner instead of a silent console.error-only no-op"
    requirement: "ERR-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#shows the actionError banner when a canvas download fails (W5)"
        status: pass
    human_judgment: false
  - id: W4-checkout-parse
    description: "A corrupt gempixel_unmapped_colors_log no longer aborts checkout; the parse is guarded (-> [] + banner) and checkout proceeds"
    requirement: "ERR-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#guards a corrupt unmapped-colors log during checkout and still proceeds (W4)"
        status: pass
    human_judgment: false
  - id: B3-save-quota
    description: "Save-quota failure still surfaces a message after folding saveErrorMsg into the unified actionError state"
    requirement: "ERR-01"
    verification:
      - kind: integration
        ref: "src/__tests__/App.test.tsx#surfaces the banner when a save hits the storage quota (B3 regression, folded into actionError)"
        status: pass
    human_judgment: false
  - id: banner-visual
    description: "The actionError banner is fixed, centered, at top-16, non-overlapping with matchError (top-4), readable rose contrast, z-[60] above the save modal, with a working x dismiss"
    requirement: "ERR-01"
    verification:
      - kind: manual
        ref: "human-verify checkpoint (Task 3) in the running dev app"
        status: pass
    human_judgment: true

# Metrics
duration: 30min
completed: 2026-07-12
status: complete
---

# Phase 11 Plan 03: Unified Action-Error Banner Summary

**Introduced one generic text-only `actionError` banner in `App.tsx` (folding the former `saveErrorMsg`), wired the two download catches and the checkout unmapped-log parse-failure into it, and guarded the previously unguarded checkout `JSON.parse` through `safeStorage` so a corrupt stored value can no longer silently kill checkout — closing ERR-01 (W4/W5).**

## Performance

- **Duration:** ~30 min (including the human-verify checkpoint)
- **Completed:** 2026-07-12
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 2

## Accomplishments
- Replaced the single-purpose `saveErrorMsg`/`setSaveErrorMsg` with one generic `const [actionError, setActionError] = useState<string | null>(null)`; no `saveErrorMsg` identifier remains in source (only a comment reference).
- Folded the save-quota path into the unified surface: `handleSaveProject` clears `setActionError(null)` at start and sets the exact "Storage is full…" message on `{ok:false}` (B3 behavior preserved).
- Wired both download catches (`handleDownloadCanvasOnly`, `handleDownloadCombinedCanvasSheet`): each clears `setActionError(null)` at handler start and, in `catch`, keeps `console.error` AND sets `setActionError('Could not generate the download. Please try again.')` (W5).
- Guarded the checkout unmapped-colors-log read (W4/T-11-06): `handleShopifyCheckout` clears at start; the read is an IIFE over `safeStorage.getItem` wrapped in try/catch — on parse failure it sets the banner and returns `[]`, and checkout still proceeds; the write goes through `safeStorage.setItem`. No raw `localStorage` remains in the handler. Added the `import { safeStorage }` that Wave 2 deliberately deferred; `tsc` stays clean (no unused import).
- Rendered ONE rose banner (reusing the existing markup) at `top-16` (distinct from `matchError` at `top-4`, so they never overlap), rendering `{actionError}` as a plain JSX text child (never `dangerouslySetInnerHTML`, T-11-07), with a dismiss `×` (`aria-label="Dismiss error"`), `z-[60]` above the save modal.
- Added three ERR-01 integration cases to `App.test.tsx` (download failure, corrupt-log checkout, save-quota regression). Full `npm test` green at **170/170** (167 Wave-2 baseline + 3 new); `npx tsc --noEmit` clean.
- Human-verify checkpoint approved: banner fixed/centered at top-16 (64px), 10px gap below the matchError banner (overlap: false), rose-950/95 bg + rose-100 text (high contrast), `z-[60]` above the modal, `×` dismiss removes it. No issues found.

## Task Commits

1. **Task 1: Unify actionError banner, wire download + checkout failures, guard checkout parse** — `65200d4` (feat) — single `actionError` state, folded `saveErrorMsg`, both download catches wired, guarded checkout parse via `safeStorage`, `top-16` dismissible banner, `safeStorage` import added.
2. **Task 2: ERR-01 integration cases** — `db91ac6` (test) — download-failure, corrupt-log-checkout, and save-quota-regression cases; module mocks for `triggerCanvasDownload` (throws) and `compileShopifyCartLink` (unmapped item); full suite 170/170.
3. **Task 3: Human-verify banner visual** — checkpoint, **approved** (no code change).

## Files Modified
- `src/App.tsx` — added `import { safeStorage }`; replaced `saveErrorMsg` state with `actionError`; `handleSaveProject` clear + quota message folded onto `setActionError`; both download handlers clear-at-start + set banner in catch; `handleShopifyCheckout` clears at start, guards the unmapped-log read/write via `safeStorage` (try/catch -> [] fallback + banner); replaced the `saveErrorMsg` banner block with the unified `top-16` dismissible `actionError` banner.
- `src/__tests__/App.test.tsx` — imported `projectStore`; added module mocks for `../engine/export` (`triggerCanvasDownload` throws) and `../engine/checkout` (`compileShopifyCartLink` returns an unmapped item, other exports preserved); new `ERR-01 unified action-error banner` describe with three cases and shared `seedProject` / `loadProjectToStep` helpers.

## Decisions Made
- **RESEARCH Option B (one generic banner).** `actionError` fully absorbs `saveErrorMsg` so there are exactly two banner regions total (`matchError` hook-owned + `actionError`), not three ad-hoc ones. `checkoutWarning` (informational) and `matchError` (hook-owned auto-clear lifecycle) were left untouched.
- **Guarded parse as an IIFE.** The corrupt-value path returns `[]` and sets the banner but does not `return` out of `handleShopifyCheckout`, so checkout proceeds with the empty-log fallback (W4). Read and write both route through `safeStorage`, so a blocked/private-mode store also cannot throw here.
- **Banner offset `top-16` + dismiss.** Chosen so the one-shot `actionError` never visually overlaps the `matchError` banner at `top-4` (developer UX directive), and a stale one-shot error can be dismissed rather than lingering.

## Deviations from Plan

None — the plan executed as written (unified banner, folded save-quota, wired downloads, guarded checkout parse, three integration tests, human-verify approved). Two implementation nuances worth recording (neither changes plan intent):

- **Corrupt log seeded AFTER mount in the test.** `usePersistentState`'s write-effect rewrites `gempixel_unmapped_colors_log` to `'[]'` on mount, so seeding `'{not json'` before render would be overwritten before checkout reads it. The test therefore corrupts the key at Step 3, immediately before the checkout click, so the guarded-parse path is genuinely exercised.
- **Download test's throw originates in `drawCanvasOnly` (jsdom has no 2D context) before `triggerCanvasDownload` is reached.** Either throw lands in the same `catch`, so the banner surfaces regardless; the `triggerCanvasDownload` mock remains as a deterministic guarantee of the failure path.

## Issues Encountered
- Expected jsdom stderr noise (`HTMLCanvasElement's getContext() ... without installing the canvas npm package`, and the intentional `Failed to download canvas grid` trace) appears during the run; no test fails — suite exits 0 at 170/170.

## User Setup Required
None — pure client-side code change, no new dependencies, no external configuration.

## Next Phase Readiness
- ERR-01 is closed; Phase 11 (storage robustness + error feedback) plans 11-01/02/03 are all complete. No blockers.
- Note (out of scope, tracked elsewhere): `canvasTemplate` scheme validation (`javascript:`/`data:`) is Phase 14, not here.

## Self-Check: PASSED

---
*Phase: 11-storage-robustness-error-feedback*
*Completed: 2026-07-12*
