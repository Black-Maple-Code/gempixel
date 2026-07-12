# Milestones

## v2.1 Post-Review Remediation (Shipped: 2026-07-12)

**Phases completed:** 11 phases, 25 plans, 49 tasks

**Scope note:** This is the first milestone archived for the repo, so the counts/accomplishments snapshot the **full shipped state (Phases 1–13)**. v2.1's own *active scope* was **Phases 11 + 13**; **Phases 10, 12, 14 were deferred** (requirements LOAD-01/02, PRICE-01/02, DATA-01, SEC-01 preserved in `milestones/v2.1-REQUIREMENTS.md` for a future rewrite). **Override closeout** — known tech debt carried: Phases 07/08/09 UAT never formally signed off (`human_needed`). See STATE.md → Continuity & Handoff.

**Key accomplishments:**

- Scaffolded typescript and vitest, implemented CIELAB converter, alpha blending, CIEDE2000 matcher with 24-bit integer caching and stable tie resolution, and flat grid matching pipeline
- Generated a unified static reference catalog for Art Dot 100-color and 200-color kits with pre-calculated CIELAB coordinates, and implemented automated integrity tests.
- Verified that safety margin calculations, packet rounding, CSS print layout queries, and native print handlers are fully functional and tested.
- Canvas partner redirect URL compiler with custom token replacement and native URL validation, integrated into Quote sidebar tab with persistent local storage setting.
- Diamond Drills USA shopping cart link compiler with affiliate referral tracking, static variant lookup table, package optimization rules to prevent mixing dye lots, and UI controls for affiliate integration.
- Local storage database registry, portfolio switcher drawer, and save dialog overlay for managing multiple custom commission layouts locally without exceeding storage limits.
- Simplified 4-step wizard workflow layout for Left Sidebar controls, adding progress headers, back/next footer buttons, and validation checks.
- Curated symbol database, dynamic frequency allocation, contrast-adaptive luminance calculations, and CanvasViewer overlay rendering implemented and verified.
- Three-way viewport switcher UI controls, print hooks for automatic symbol canvas scaling, print-only margin legends sidebar layouts, and landscape CSS page overrides implemented and verified.
- Exposed programmatic CanvasViewer zoom control APIs with a scale change callback, and established global CSS rules for the glassmorphic viewport HUD, hover tooltips, and summary accordion caret animations.
- Pure `safeStorage` localStorage guard + `usePersistentState` Preact hook with format-preserving bool/int/string/json codecs, both unit-tested in isolation before any App.tsx wiring.
- Migrated the 7 unguarded persisted settings in `App.tsx` onto the Wave-1 `usePersistentState` hook (deleting the duplicated lazy-init + write-effect boilerplate), guarded the `Step3Canvas` clear-log through `safeStorage`, and added a blocked-storage `<App/>` mount regression test — keys and on-disk formats frozen.
- Introduced one generic text-only `actionError` banner in `App.tsx` (folding the former `saveErrorMsg`), wired the two download catches and the checkout unmapped-log parse-failure into it, and guarded the previously unguarded checkout `JSON.parse` through `safeStorage` so a corrupt stored value can no longer silently kill checkout — closing ERR-01 (W4/W5).
- Relocated the drawImage resample + getImageData readback + boxSampleImage averaging off the main thread into matcher.worker.ts behind a zero-copy ImageBitmap transfer, with an injectable decode/capability seam keeping the node Vitest suite green.
- Wired the D-09 phase-labeled single loading overlay ('Preparing image…' indeterminate during off-thread decode → 'Matching colors: {progress}%' determinate on first worker progress) and the D-10 stage-agnostic error-banner copy in App.tsx, consuming the loadingPhase signal from Plan 13-01 — with the spinner-never-co-displays-with-banner invariant intact.

---
