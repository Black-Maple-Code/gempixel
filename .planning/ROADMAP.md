# Roadmap: GemPixel

## Milestones

- ✅ **v2.0** — Phases 1–9 (shipped 2026-07-10): color engine → worker pipeline → canvas viewer → supply planning → partnerships → commission UX → symbols → multi-vendor export → viewport HUD.
- ✅ **v2.1 Post-Review Remediation** — Phases 10–14 (shipped 2026-07-12): active scope **Phases 11 + 13** (storage robustness + off-main-thread decode). Phases **10, 12, 14 deferred** — see Backlog.
- ⚠️ **v3.0 Two-Mode Viewport Experience (partial)** — Phases 15–19 (force-closed 2026-07-13 at 40%): shipped the correctness foundation only — **Phases 15 + 16** (trustworthy pricing/data + optimized supply plan & savings). Phases **17, 18, 19 never built** — the viewport-native wizard, the Customer/Artist mode split, and the service-fee/order-packet flow are deferred. See Backlog.
- 🔨 **v4.0 Canvas-First Redesign (active)** — Phases 20–25 (opened 2026-07-13): a **frontend-only, 100% client-side** rebuild of the customer experience — Atelier light design system + canvas-first 4-step shell → shared UI primitives → additive engine (density / color reducer / single-source quote) → the four screens (Upload → Refine → Supplies → Order) → mobile + touch → strangler cleanup. Fulfillment backend deferred to v5.0.

Full phase details for shipped milestones are archived in `milestones/v2.1-ROADMAP.md` and `milestones/v3.0-ROADMAP.md`.

## Phases

<details>
<summary>✅ v2.0 — Phases 1–9 (SHIPPED 2026-07-10)</summary>

- [x] Phase 1: Core Engine & Color Mathematics (2/2) — 2026-07-07
- [x] Phase 2: Client-side Engine & Worker Architecture (2/2) — 2026-07-07
- [x] Phase 3: Canvas Viewer & Zoom/Pan Interaction (2/2) — 2026-07-07
- [x] Phase 4: Supply Planning, Customization & Exports (3/3) — 2026-07-07
- [x] Phase 5: Supply Partnerships & Checkout Integration (2/2) — 2026-07-07
- [x] Phase 6: Commission Workspace & Streamlined Artist UX (2/2) — 2026-07-08
- [x] Phase 7: Symbol-Overlay Canvas & Margin Legends (2/2) — 2026-07-09 ⚠ UAT sign-off deferred (verification `human_needed`)
- [x] Phase 8: Custom Canvas Export & Multiple Vendor Integration (2/2) — 2026-07-09 ⚠ UAT sign-off deferred
- [x] Phase 9: Viewport HUD Overlay & Intuitive Wizard Navigation UX (2/2) — 2026-07-10 ⚠ UAT sign-off deferred

</details>

<details>
<summary>✅ v2.1 Post-Review Remediation — Phases 10–14 (SHIPPED 2026-07-12; active scope 11 + 13)</summary>

- [ ] Phase 10: Project Load Correctness — **deferred** (LOAD-01, LOAD-02)
- [x] Phase 11: Storage Robustness & Error Feedback (3/3) — 2026-07-12 (STORE-01, STORE-02, ERR-01)
- [ ] Phase 12: Supply Pricing Accuracy — **deferred** (PRICE-01, PRICE-02, DATA-01) — superseded by v3.0 Phase 15
- [x] Phase 13: Performance — Off-Main-Thread Decode (3/3) — 2026-07-12 (PERF-01)
- [ ] Phase 14: Security & Cleanup — **deferred** (SEC-01)

Pre-milestone: review blockers B1–B4 fixed via quick tasks (260711-wvv, 260711-x6p, 260712-05k, 260712-0io).

</details>

<details>
<summary>⚠️ v3.0 Two-Mode Viewport Experience — Phases 15–19 (FORCE-CLOSED 2026-07-13 at 40%; shipped 15 + 16 only)</summary>

**Shipped (the correctness foundation, all test-guarded):**

- [x] Phase 15: Trustworthy Pricing & Data Foundation (3/3) — 2026-07-13 (VENDOR-02, PRICE-01/02/03, DATA-01)
- [x] Phase 16: Optimized Supply Plan & Savings (4/4) — 2026-07-13 (BAG-01/02/03)

**Never built (force-closed as known gaps — carried to Backlog):**

- [ ] Phase 17: Service Fee & Customer Order Packet — **not started** (FEE-01, ORDER-01..05)
- [ ] Phase 18: Viewport-Native Wizard — **not started** (VIEWPORT-01..03)
- [ ] Phase 19: Two-Mode Split (Customer / Artist) — **not started** (MODE-01..04)

Full success criteria for all five phases preserved in `milestones/v3.0-ROADMAP.md`; requirements in `milestones/v3.0-REQUIREMENTS.md`.

</details>

### 🔨 v4.0 Canvas-First Redesign — Phases 20–25 (ACTIVE, opened 2026-07-13)

Frontend-only, 100% client-side. Strangler discipline: App.tsx stays the state owner, screen children stay pure/props-only, `engine/*` signatures change only inside the isolated engine phase (never in a UI phase), and the 240+ Vitest baseline stays green at every commit — the app ships green at every phase.

- [x] **Phase 20: Atelier Design System & Canvas-First Shell** - Light-only tokens + self-hosted fonts, dark mode fully retired, and a strangler shell where the horizontal 4-step bar is the only navigator (viewer mounted once). (completed 2026-07-14)
- [x] **Phase 21: Shared UI Primitives** - Hand-built StepNav / SegmentedControl / Slider / SizeCard / Pill / Button in `src/ui/` (browser-native + Tailwind, zero new deps) that every screen composes. (completed 2026-07-14)
- [x] **Phase 22: Additive Engine — Density, Color Reducer & Single-Source Quote** - One 2.5mm/dot density helper, `detectedColorCount` + target-N `reduceToColorCount`, and an integer-cents `engine/quote.ts` selector — landed in engine-only commits. (completed 2026-07-14)
- [x] **Phase 23: The Four Screens in Flow Order** - Upload → Refine (keystone) → Supplies → Order, each pure/props-only, swapped in one at a time behind the strangler flag. (completed 2026-07-15)
- [ ] **Phase 24: Mobile Responsive + Touch Pass** - The same 4-step journey in a single portrait column at ~300px via container queries, plus pinch-zoom + `touch-action: none` on the chart.
- [ ] **Phase 25: Retire Legacy Steps + Cleanup** - Final grep-clean of residual `Step1..4` component files, theme remnants, and leftover dead preset state. **Narrowed (2026-07-15, Phase 23 UAT Test 26 gap fix, Plans 06–08):** the legacy dark 3-column shell, the left "My Images" menu, and the right Color-Legend/DMC aside are ALREADY retired in Phase 23 — Phase 25 is no longer a from-scratch strangler close.

## Phase Details

### Phase 20: Atelier Design System & Canvas-First Shell

**Goal**: The app wears the Atelier light-only design system and is navigated solely by a horizontal 4-step bar, with the existing viewer/legend/supply UI wrapped unchanged inside the new shell — the strangler foundation that ships green.
**Depends on**: Nothing (first v4.0 phase; builds on the shipped v3.0 codebase)
**Requirements**: DESIGN-01, DESIGN-02, SHELL-01, SHELL-02
**Success Criteria** (what must be TRUE):

  1. A returning user always sees the Atelier light theme — no dark-mode toggle, no half-dark flash on reload (the persisted `gempixel_theme` key, the `[data-theme]` CSS, and the canvas viewer's theme dependency are all removed).
  2. The UI renders from Atelier design tokens (bg `#F4F1E9`, accent green `#0E6E5C`, 8px spacing, radii/shadows) with self-hosted Newsreader / Archivo / JetBrains Mono fonts and no external font request or visible font-swap layout shift (FOUT/CLS).
  3. A horizontal 4-step bar (Upload → Refine → Supplies → Order) is the *only* navigator — no sidebars, hamburger, or page-flip wizard; the user advances via the primary CTA and returns by tapping a completed step.
  4. The flow is validation-gated — Refine is unreachable without an uploaded image and Supplies without a computed match — and the canvas viewer is mounted once and never remounts on step changes.
  5. The existing viewer/legend/supply UI still functions inside the new shell and the full 240+ Vitest suite stays green.

**Plans**: 6/6 plans complete

Plans:
**Wave 1**

- [x] 20-01-PLAN.md — Atelier CSS tokens + self-hosted fonts + Fontaine no-CLS + engine font-literal repoint (DESIGN-01 CSS-side, DESIGN-02) [Wave 1]
- [x] 20-02-PLAN.md — Dark-mode rip in index.html + App.tsx (boot script, theme hook/effect/toggle, removeItem) (DESIGN-01) [Wave 1]
- [x] 20-03-PLAN.md — StepBar + AtelierShell + STEP_META pure chrome components with D-12 gating/a11y (SHELL-01, SHELL-02) [Wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-04-PLAN.md — Wire shell into App: delete both legacy navs, single navigator, CSS-toggle single-mount viewer (SHELL-01, SHELL-02) [Wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 20-05-PLAN.md — Soft-invalidate + "Recompute match" banner (SHELL-02) [Wave 3]

**Wave 4 — Gap closure** *(UAT Test 4 defects; run via `/gsd-execute-phase 20 --gaps-only`)*

- [x] 20-06-PLAN.md — Fix duplicate GemPixel wordmark (remove legacy sidebar brand cluster + retarget tests) & canvas-below-fold (definite viewport height on shell root) (SHELL-01, SHELL-02) [Wave 4]

**UI hint**: yes

### Phase 21: Shared UI Primitives

**Goal**: Every interactive control the redesign needs exists as a hand-built, Atelier-tokened, accessible primitive in `src/ui/`, ready to compose the four screens without Tailwind-soup duplication.
**Depends on**: Phase 20
**Requirements**: (none — shared UI infrastructure that unblocks every screen; carries no v4.0 REQ-ID by design)
**Success Criteria** (what must be TRUE):

  1. StepNav, SegmentedControl, Slider, SizeCard, Pill, and Button render consistently from Atelier tokens everywhere they appear.
  2. The interactive primitives are keyboard-operable and screen-reader-labeled (SegmentedControl as `role=radiogroup`, Slider as native `input[type=range]`).
  3. The primitives are built from browser-native elements + Tailwind only — no new UI/slider/util dependency enters `package.json`.
  4. The 240+ Vitest suite stays green with the new primitives covered by unit/render tests.

**Plans**: 3/3 plans complete

Plans:
**Wave 1**

- [x] 21-01-PLAN.md — `cn()` helper + Button (primary/save/ghost) + Pill (neutral/ok/tag) variant-map primitives + tests (D-01, D-02, D-03) [Wave 1]

**Wave 2** *(blocked on Wave 1 — imports `cn`)*

- [x] 21-02-PLAN.md — SegmentedControl (WAI-ARIA radiogroup, roving tabindex, arrow/Home/End) + Slider (native range, `onInput`, aria-valuetext) + tests (D-02, D-03, D-04, SC2) [Wave 2]
- [x] 21-03-PLAN.md — SizeCard (dumb selectable card, no engine import) + zero-dependency/green-suite gate + tests (D-02, D-03, D-04, D-05, SC3, SC4) [Wave 2]

**UI hint**: yes

### Phase 22: Additive Engine — Density, Color Reducer & Single-Source Quote

**Goal**: The engine exposes the real detected color count, a deterministic target-N color reducer, and one integer-cents quote selector — so every inch figure and every total in the app has a single, non-divergent source, landed in isolated engine-only commits.
**Depends on**: Phase 20 (can proceed in parallel with Phase 21)
**Requirements**: QUOTE-01, QUOTE-02, QUOTE-03 (also builds the engine support — `detectedColorCount` + `reduceToColorCount` — that REFINE-04 and SUPPLIES-02 consume in Phase 23)
**Success Criteria** (what must be TRUE):

  1. Every physical-size and inch figure shown anywhere in the app is derived from grid dimensions through one 2.5mm/dot density helper — no hard-coded mock inch labels remain.
  2. A single integer-cents quote selector (`engine/quote.ts`, drills + canvas + shipping + tax estimate via `money.ts`) produces one total, and the itemized line items always sum exactly to it.
  3. Tax and any curated canvas/shipping rate are labeled as **estimates** with a dated "rates as of" provenance; no figure reads as a finalized charge.
  4. `useDiamondArtMatch` exposes `detectedColorCount`, and a deterministic, Delta-E-guarded `reduceToColorCount` merges rare drills into the CIEDE2000-nearest already-used shade with a stable tie-break — feeding one merged count to viewer, legend, cart, and quote (this underpins REFINE-04, wired in Phase 23).
  5. `engine/*` signatures change ONLY in this phase's commits (never inside a UI phase) and the 240+ suite stays green, with new tests covering the reducer and the quote selector.

**Plans**: 4/4 plans complete

Plans:
**Wave 1** *(three file-disjoint, additive engine pieces — fully parallel)*

- [x] 22-01-PLAN.md — Single 2.5mm/dot density helper (engine/density.ts, reconciled with calculateCanvasCost /10) + stale engine theme-marker cleanup (QUOTE-01, SC5) [Wave 1]
- [x] 22-02-PLAN.md — Single-source integer-cents quote selector (engine/quote.ts + DRILLS_BASE_SHIPPING/RATES_AS_OF/TAX_RATE_ESTIMATE) — line items sum exactly to total; tax/shipping labeled estimates (QUOTE-02, QUOTE-03, D-06/07/08) [Wave 1]
- [x] 22-03-PLAN.md — Deterministic Delta-E-guarded target-N reduceToColorCount + MERGE_GUARD_DELTA_E + compareDmcCode in color.ts + reducer test suite (REFINE-04 engine support, D-01/02/03) [Wave 1]

**Wave 2** *(blocked on 22-03 — imports reduceToColorCount)*

- [x] 22-04-PLAN.md — Expose detectedColorCount (raw-keyed, stable) + gated no-op reduce step in useDiamondArtMatch (raw → smooth → reduce) + hook coverage (REFINE-04 engine support, D-04/05, SC5 additive) [Wave 2]

### Phase 23: The Four Screens in Flow Order

**Goal**: The complete customer journey works end-to-end inside the new shell — Upload, Refine (the keystone), Supplies, and Order — each screen pure/props-only and swapped in one at a time behind the strangler flag.
**Depends on**: Phase 21 (primitives), Phase 22 (engine + single-source quote)
**Requirements**: UPLOAD-01, REFINE-01, REFINE-02, REFINE-03, REFINE-04, REFINE-05, SUPPLIES-01, SUPPLIES-02, ORDER-01, ORDER-02
**Success Criteria** (what must be TRUE):

  1. **Upload** — the user starts a project by dragging/dropping or browsing for a photo and can reopen a recent project from an inline list; canvas-size selection has moved out of Upload into Refine.
  2. **Refine** — the user picks a canvas size from cards showing grid dimensions + true derived inches + a live drill count (or enters a **custom size** with sane clamps), and changing size re-renders the preview and counts live.
  3. **Refine** — an edge-cleanup 4-segment control (Off/Light/Med/Strong) and a color-count slider whose **max equals the real detected count** both re-render the chart live (lowering colors merges orphan drills with no visible change), with kit / color-exclude / drill-shape defaulting sensibly (kit = all, shape = square) under an "Advanced" disclosure.
  4. **Supplies** — the legend/supply table (symbol · swatch · DMC code + name · drills incl. +10% · bags + "why these bags?") and an inline itemized order-summary both read from the single-source quote, so Supplies and Order can never diverge.
  5. **Order** — an auto-filled, **locked** spec (Rolled Canvas, size from grid, finish) + finish selection + ship-to + the itemized quote, completed by downloading a versioned, self-contained order packet — no implied payment and no fake receipt.

**Plans**: 8/8 plans complete

Plans:
**Wave 1**

- [x] 23-01-PLAN.md — Strangler foundation: flags.ts (4 booleans, all off) + four pure screen shells + App data-step-panel ternaries; suite green, zero behavior change (D-01, D-02) [Wave 1]

**Wave 2** *(blocked on 23-01)*

- [x] 23-02-PLAN.md — Upload: dropzone + browse + inline recent-projects list (loadProject rehydrate); size removed from Upload; flip USE_NEW_UPLOAD (UPLOAD-01, D-10) [Wave 2]

**Wave 3** *(blocked on 23-02 — keystone)*

- [x] 23-03-PLAN.md — Refine keystone: SizeCards + custom size (worker tier via soft-invalidate/Recompute) + live edge-cleanup + color slider (post-process, max=detectedColorCount) + Advanced disclosure; flip USE_NEW_REFINE (REFINE-01..05, D-03/04/05/06) [Wave 3]

**Wave 4** *(blocked on 23-03)*

- [x] 23-04-PLAN.md — Supplies: legend/supply table + "why these bags?" + inline order-summary from single-source buildOrderQuote; honest est./unavailable; flip USE_NEW_SUPPLIES (SUPPLIES-01/02, D-07) [Wave 4]

**Wave 5** *(blocked on 23-04)*

- [x] 23-05-PLAN.md — Order: locked spec + finish + ship-to + itemized quote + versioned self-contained packet download; honest terminal (no payment/receipt); flip USE_NEW_ORDER (ORDER-01/02, D-08/09) [Wave 5]

**Gap Closure — UAT Test 26 (viewport-first hosting; retire the legacy left menu)**

- [x] 23-06-PLAN.md — Extract CanvasWorkspace (single-mount canvas + HUD/zoom/legends), delete the duplicate hero upload prompt, and re-point App/print test project-loads onto UploadScreen chips; legacy shell still renders, suite green (REFINE-01, UPLOAD-01) [Wave 1]
- [x] 23-07-PLAN.md — Sever test coupling to the legacy asides: re-point color-exclusion to RefineScreen Advanced; retire sidebar/legend-collapse, sortable-DMC, and highlight-on-legend tests as intentional strangler retirement (REFINE-01, SUPPLIES-01) [Wave 2]
- [x] 23-08-PLAN.md — Flip the shell: centered ~1180px cream frame hosts the four screens (Refine = canvas + rail), relocate recent/Save/New/Back-Next into the viewport, delete both asides + dead collapse state, add the integrated layout regression test, narrow ROADMAP Phase 25 to a grep-clean (UPLOAD-01, REFINE-01, SUPPLIES-01, ORDER-01) [Wave 3]

**UI hint**: yes

### Phase 24: Mobile Responsive + Touch Pass

**Goal**: The same 4-step journey works in a single portrait column on a ~300px-wide phone with every control inline, and the chart supports touch zoom/pan without the page scrolling.
**Depends on**: Phase 23
**Requirements**: MOBILE-01, MOBILE-02
**Success Criteria** (what must be TRUE):

  1. At ~300px wide, all four screens reflow to one portrait column via container queries — every control stays inline (never a drawer), and nothing overflows.
  2. On a touch device the user can pinch-to-zoom and pan the chart, aided by on-screen zoom buttons, with `touch-action: none` on the canvas so the page never scrolls under the gesture.
  3. Desktop layout is unregressed and the 240+ Vitest suite stays green.

**Plans**: TBD
**UI hint**: yes

### Phase 25: Retire Legacy Steps + Cleanup

> **Scope narrowed 2026-07-15 (Phase 23 UAT Test 26 gap fix, Plans 06–08).** The Phase 23
> gap closure already retired the load-bearing dual UI: the legacy dark 3-column shell
> (`bg-slate-950` wrapper), the left "My Images" menu + drawer, the right Color-Legend/DMC
> aside, the in-aside Back/Next, the bottom mobile tab bar, and the dead
> collapse/drawer state (`leftPanelCollapsed`/`rightPanelCollapsed`/`imagesDrawerOpen`/
> `supplyListOpen`) are all deleted, with the four Atelier screens now hosting the centered
> ~1180px viewport frame. Phase 25 is therefore a **final grep-clean**, not a from-scratch
> strangler close.

> **Scope added 2026-07-15 (Phase 23 Test 26 sign-off — UX refinements + code-review follow-up).**
> On accepting the viewport flip, the user raised four UX refinements and code review logged one
> regression. These join Phase 25 (the phase that already re-touches this journey and re-verifies
> the real-photo walk, UAT Test 29):
> 1. **Auto-advance to Refine on upload** — uploading a photo currently does not advance to step 2, so it reads as a no-op. Auto-advance Upload → Refine on a successful ingest. (Also unblocks UAT Test 29's first step.)
> 2. **Auto-recompute on dimension change** — the size/worker tier still requires an intermediate "Recompute" click; make a dimension change recompute automatically (revisits the D-03/D-04 soft-invalidate → manual-Recompute decision).
> 3. **Narrow the Refine rail** — the 360px rail has excess empty space on the right and eats into the viewport (the focus); tighten it so the canvas preview dominates.
> 4. **Clearer "Advanced" disclosure affordance** — the RefineScreen `<details>` doesn't read as clickable or signal that settings live inside; give it an explicit affordance.
> 5. **WR-01 (code review, `23-REVIEW.md`)** — the canvas `<main>` is `print:block` only on Refine (step 2); on Upload/Supplies/Order it is `display:none` with no print override, so a plain Ctrl+P of the raw canvas grid prints blank from those screens (the dedicated Print-Supply-Report and legend-print buttons are unaffected). Restore canvas-grid print from the other steps (needs fit-on-print for the hidden canvas), or make the intent explicit.

**Goal**: With the new journey validated in UAT, the remaining `Step1..4` component files, theme remnants, and any leftover dead preset state are grep-cleaned — the strangler is complete and the codebase carries no dual UI.
**Depends on**: Phase 24
**Requirements**: (none — strangler close; carries no v4.0 REQ-ID by design)
**Success Criteria** (what must be TRUE):

  1. The residual `Step1..4` component files and their now-dead ternary branches (the legacy shell chrome + both asides were already deleted in Phase 23), plus the dark-mode/theme remnants and any leftover dead preset state, are removed; only the new Atelier journey remains.
  2. No dead code path can resurrect dark mode or the old sidebar (grep-clean of `Step*` / theme / aside remnants).
  3. Any remaining open decisions (kit default, color-exclude placement, drillStyle default) are resolved into the Refine "Advanced" disclosure or sane defaults.
  4. The 240+ Vitest suite stays green after deletion and the app ships green with a single UI tree.
  5. **UX (from Test 26 sign-off):** a successful upload auto-advances Upload → Refine (no dead-end no-op); a dimension change recomputes automatically (no intermediate Recompute click); the Refine rail is tightened so the canvas preview dominates the viewport; and the "Advanced" disclosure reads as clickable and signals housed settings.
  6. **Print (WR-01):** a plain Ctrl+P produces the canvas grid from every step where it is meaningful — not just Refine — or the intent is made explicit; the dedicated Supply-Report/legend print paths remain intact.
  7. The real-photo end-to-end journey (UAT Test 29: Upload → Refine → Supplies → Order) is re-verified against the final in-viewport layout with the above UX fixes in place.

**Plans**: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1–9 (v2.0 suite) | v2.0 | 19/19 | Complete | 2026-07-07 → 07-10 |
| 11. Storage Robustness & Error Feedback | v2.1 | 3/3 | Complete | 2026-07-12 |
| 13. Performance — Off-Main-Thread Decode | v2.1 | 3/3 | Complete | 2026-07-12 |
| 10. Project Load Correctness | v2.1 | — | Deferred | — |
| 12. Supply Pricing Accuracy | v2.1 | — | Deferred (superseded by Phase 15) | — |
| 14. Security & Cleanup | v2.1 | — | Deferred | — |
| 15. Trustworthy Pricing & Data Foundation | v3.0 | 3/3 | Complete | 2026-07-13 |
| 16. Optimized Supply Plan & Savings | v3.0 | 4/4 | Complete | 2026-07-13 |
| 17. Service Fee & Customer Order Packet | v3.0 | — | Deferred (force-close gap) | — |
| 18. Viewport-Native Wizard | v3.0 | — | Deferred (force-close gap) | — |
| 19. Two-Mode Split (Customer / Artist) | v3.0 | — | Deferred (force-close gap) | — |
| 20. Atelier Design System & Canvas-First Shell | v4.0 | 6/6 | Complete    | 2026-07-14 |
| 21. Shared UI Primitives | v4.0 | 3/3 | Complete    | 2026-07-14 |
| 22. Additive Engine — Density, Color Reducer & Single-Source Quote | v4.0 | 4/4 | Complete    | 2026-07-14 |
| 23. The Four Screens in Flow Order | v4.0 | 8/8 | Complete   | 2026-07-15 |
| 24. Mobile Responsive + Touch Pass | v4.0 | TBD | Not started | — |
| 25. Retire Legacy Steps + Cleanup | v4.0 | TBD | Not started | — |

## Backlog

Deferred work to be re-scoped/rewritten in a future milestone (start with `/gsd-new-milestone`). Original success criteria are preserved in the milestone archives noted below.

**From v3.0 (force-closed 2026-07-13 — the milestone's headline scope, never built).** Success criteria in `milestones/v3.0-ROADMAP.md`; requirements in `milestones/v3.0-REQUIREMENTS.md`:

- **Phase 17 — Service Fee & Customer Order Packet:** % service fee as its own itemized line + a versioned, self-contained, JSON-round-trippable customer order packet (design PNG, canvas spec, optimized gem-bag list, itemized totals in integer cents, no PII) with review → confirmation (unique order ref) → threshold auto-flagging → client-side download/share handoff, schema designed to feed the v4.0 backend unchanged. (FEE-01, ORDER-01..05) — **Note:** the honest order-packet/handoff idea is partially revived under v4.0 ORDER-01/02 (Phase 23); the service-fee line and order-ref/threshold flagging remain deferred.
- **Phase 18 — Viewport-Native Wizard (UI rework #1, must ship green):** most-used controls as contextual in-viewport surfaces extending the Phase 9 HUD; sidebars + page-flip wizard progressively retired with no regression (178-test baseline + <1ms Grid/Symbol/Photo switcher preserved); first-run dismissible coach-mark tour via browser-native anchoring (no tour library). Strictly mode-agnostic. (VIEWPORT-01..03) — **Superseded by v4.0** (the canvas-first 4-step shell replaces the viewport-native wizard).
- **Phase 19 — Two-Mode Split (Customer / Artist) (UI rework #2, last):** thin capability-map layer over the stabilized wizard; persisted/reversible mode choice preserving the design; Artist sees cost table + affiliate links + drill cart, Customer sees guided buy flow + service fee + order packet and never the raw price table / affiliate params / drill-cart link (absence tests); URL param launches a mode directly; saved projects carry `mode` + `schemaVersion` with pre-v3.0 → Artist carry-over so artist economics never leak into a customer quote. (MODE-01..04) — **Superseded by v4.0** (customer-first redesign; a separate Artist mode is not part of v4.0).

**From v2.1 (still deferred).** Original success criteria in `milestones/v2.1-ROADMAP.md`; requirements in `milestones/v2.1-REQUIREMENTS.md`:

- **Phase 10 — Project Load Correctness:** a restored saved project keeps its saved canvas price (not the auto-recomputed vendor cost) and renders the exact saved grid regardless of current substitution/smoothing toggles. (LOAD-01 review W1, LOAD-02 review W2)
- **Phase 14 — Security & Cleanup:** validate compiled partner canvas URLs against an http/https allowlist (block `javascript:`/`data:`), and wire-up-or-remove the unfinished `compileCanvasPartnerUrl` path. (SEC-01 W10, IN-02)
