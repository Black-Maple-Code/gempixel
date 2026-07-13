# Milestones

## v3.0 Two-Mode Viewport Experience (partial — pricing & supply-plan foundation) (Shipped: 2026-07-13)

**Phases completed:** 2 phases, 7 plans, 18 tasks

**⚠ Override closeout (force-closed at 40%).** Only the correctness foundation shipped — Phases 15 (Trustworthy Pricing & Data) and 16 (Optimized Supply Plan & Savings). The milestone's two namesake capabilities (the viewport-native wizard and the Customer/Artist mode split) and the service-fee/order-packet flow were **never built**. 8 of 21 v3.0 requirements were satisfied; the remaining 13 are carried forward. Pre-existing verification gaps (Phases 07/08/09 UAT, `human_needed`) remain acknowledged from the v2.1 close.

### Known Gaps

Unbuilt phases and unsatisfied requirements at force-close (see `milestones/v3.0-ROADMAP.md` for full success criteria and `milestones/v3.0-REQUIREMENTS.md` for descriptions):

| Phase | Requirements | Status |
|-------|--------------|--------|
| 17 — Service Fee & Customer Order Packet | FEE-01, ORDER-01, ORDER-02, ORDER-03, ORDER-04, ORDER-05 | Not started — no plans |
| 18 — Viewport-Native Wizard | VIEWPORT-01, VIEWPORT-02, VIEWPORT-03 | Not started — no plans |
| 19 — Two-Mode Split (Customer / Artist) | MODE-01, MODE-02, MODE-03, MODE-04 | Not started — no plans |

**Key accomplishments:**

- Removed Prodigi as a canvas vendor, narrowed the vendor type to `CanvasVendor = 'lumaprints' | 'finerworks'` everywhere, guarded `calculateCanvasCost` to `number | null` so a removed/tampered vendor can never yield a free $0 canvas, and added a `normalizeVendor` load-time migration that remaps any persisted legacy/unknown vendor to `lumaprints`.
- Introduced `engine/money.ts` as the single canonical integer-cents money authority (EPSILON-safe round-half-up, fail-loud on non-finite input); fixed the missing 500 bag tier so a 500 bag prices at its own tier instead of the 5000 bulk tier; killed the `$0-as-free` bug so the cost minimizer treats a missing price as `Infinity` (never self-selected) and flags colors coverable only by an unpriced size (`hasUnpricedSize`), surfaced through the existing banner; and reconciled the displayed total to the sum of its itemized line items in integer cents.
- Shipped the DATA-01 automated integrity guard for the 5,107-line `DRILL_VARIANTS` SKU table (positive-integer SKUs, unique-or-allow-listed IDs, no empty reachable mappings beyond the allow-list, full palette coverage) plus an exported `hasVariantMapping` predicate that surfaces any grid color unmapped for the selected drill shape through the existing `actionError` banner — never silently dropping a color. A blocking data-owner checkpoint adjudicated the known holes: all three duplicate-ID pairs are confirmed intended aliases (kept allow-listed) and all four empty mappings are confirmed surfaced-as-unmapped (data left unchanged), finalizing the safe reversible defaults.
- minCostBulk now packs a bulk color into the FEWEST bags within a LOCKED overshoot cap (wasted drills <= one smallest bulk bag) via a total, deterministic order — the cost-min objective is retired, and the legend/cart shared primitive can never diverge on a tie.
- `naiveColorPack` gives the dye-lot-aware naive per-color baseline (smallest single covering bag; ceil-fill the largest on no-cover) and `planOrderSupply` aggregates the whole order into one shared plan — optimized rows + totals + naive baseline + a savings figure clamped >= 0, all reconciled in integer cents — so the legend, the cart, and the future order packet can never diverge.
- The optimized fewest-bags plan is now the SOLE displayed plan: `App.tsx` derives the legend rows, total bag count, drill cost and unpriced codes from the shared `planOrderSupply` engine (D-13) instead of an inline reduction, and the user-facing `optimizeBagsCost` toggle plus the fixed-size bag controls are fully retired across App/Step2Palette/Step3Canvas (D-11) — with a render test proving the visible "Drills ({n} bag(s))" count equals the aggregator's `totalPackets` (SC2/BAG-02).
- Always-on savings headline and an a11y-safe "Why these bags?" expander in the Step 3 Cost & Order panel, backed by an isolated print-only "GemPixel Supply Plan Report" that mirrors both statically — replacing a broken window.print() that had been printing the canvas grid.

---

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
