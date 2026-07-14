# Phase 23: The Four Screens in Flow Order - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 23 wires the **four real customer screens — Upload → Refine (the keystone) → Supplies → Order** — as pure/props-only components that App.tsx composes, each **swapped in one at a time behind a per-screen strangler flag** so the 240+ Vitest suite stays green at every commit. This is the UI-wiring phase that consumes everything built upstream: the Phase 21 `src/ui/` primitives (SegmentedControl, Slider, SizeCard, Pill, Button) and the Phase 22 engine additions (`density.ts`, `reduceToColorCount`/`detectedColorCount`, single-source `engine/quote.ts`).

App.tsx **stays the sole state owner** (Phase 20 D-01); the single `<CanvasViewer>` stays hoisted at shell scope and never remounts (Phase 20 D-14); the four screens read state and callbacks via props and make no engine-signature changes (strangler rule — engine froze in Phase 22).

Requirements delivered: **UPLOAD-01, REFINE-01, REFINE-02, REFINE-03, REFINE-05, SUPPLIES-01, ORDER-01, ORDER-02** (wiring), plus the UI consumption of already-complete **REFINE-04** and **SUPPLIES-02** engine support.

**Not in this phase:**
- Any `engine/*` signature change — engine is frozen (Phase 22 was the only engine phase).
- Mobile responsive / touch (single portrait column, pinch-zoom, `touch-action: none`) → **Phase 24**.
- Deleting legacy Step1..4 components, side asides, theme toggle, dead sidebar/preset state → **Phase 25** (strangler close). Legacy Step bodies stay live behind their flags this phase.
- Tunable Delta-E merge guard → **REFINE-06 (v4.x)**; real payment + lab submission → **v5.0**; service-fee line + order-ref/threshold flagging → deferred (per ROADMAP note).

</domain>

<decisions>
## Implementation Decisions

### Screen module structure & the strangler swap mechanism (SC1–SC5; "swapped in one at a time")
- **D-01:** **New `src/features/screens/` directory holding four pure/props-only components** — `UploadScreen.tsx`, `RefineScreen.tsx`, `SuppliesScreen.tsx`, `OrderScreen.tsx` — each mirroring the shipped `StepBar.tsx` pattern (props-only, Atelier-tokened, a11y-correct). They compose the `src/ui/` primitives; they own no state and make no engine calls beyond pure selectors fed data by App.
- **D-02:** **Per-screen strangler flags, not one global switch.** A single `src/features/screens/flags.ts` module exports four booleans (e.g. `USE_NEW_UPLOAD`, `USE_NEW_REFINE`, `USE_NEW_SUPPLIES`, `USE_NEW_ORDER`). App renders the new screen when its flag is `true`, otherwise the existing `StepNIngest/Palette/Canvas/Export` body — **in the same `data-step-panel` CSS-toggled sibling slot** (preserving Phase 20 D-14 single-mount viewer + `hidden` toggling). Each plan flips exactly one flag on, so one screen swaps per commit with the suite green. (Chosen over one global flag — forces all four to land together, no green mid-phase — and over deleting legacy now — that is Phase 25.)

### Refine keystone — live re-render & the re-match boundary (REFINE-01/03/04; honors Phase 22 D-04/D-05)
- **D-03:** **Two-tier reactivity.** **Canvas-size selection is a real re-match** — it re-runs the worker (a legitimate `detectedColorCount`/preview recompute) and moves size ownership **out of Upload into Refine** (SC1/REFINE-01). **Edge-cleanup (Off/Light/Med/Strong → 0–3) and the color-count slider are pure main-thread post-processes** over the unchanged raw grid via `useDiamondArtMatch`'s canonical `raw → smoothMatches → reduceToColorCount` pipeline — **no worker re-fire per tick**. The color slider's **max = `detectedColorCount`** (stable while dragging either control, Phase 22 D-04); lowering it merges orphan drills with no visible change (Phase 22 D-01/D-03).
- **D-04:** **Soft-invalidate (Phase 20 D-13) fires only on the re-match tier.** A size change marks downstream steps stale + surfaces the single "Recompute match" CTA; edge-cleanup/color-slider ticks are cheap post-processes and must **not** trigger staleness or a worker re-fire. This keeps the keystone feeling live without abort-race churn.

### Refine — custom size & the "Advanced" disclosure (REFINE-02/05)
- **D-05:** **Preset `SizeCard`s first, one custom-size entry second.** Preset cards show grid dims + **true derived inches from `gridToInches` (2.5mm/dot)** + a live drill count (never a mock label). Presets read as recommendations; a **custom canvas size** entry (cols/inches with sane clamps following the existing App canvas-clamp precedent) is available when no preset fits.
- **D-06:** **Kit / color-exclusion / drill-shape live under a single collapsible "Advanced" disclosure in Refine — not their own step.** Defaults: **kit = all, drill-shape = square** (REFINE-05). The disclosure is a controlled collapse (native `<details>` or a small controlled disclosure — planner's call); it is closed by default so the keystone stays uncluttered.

### Supplies & Order — single-source quote consumption (SUPPLIES-01/02, ORDER-01; honors Phase 22 D-06)
- **D-07:** **Both screens render exclusively from `buildOrderQuote` (`engine/quote.ts`) + `planOrderSupply` — zero local total math.** Supplies shows the legend/supply table (symbol · swatch · DMC code + name · drills incl. **+10%** safety · bags) with a **"why these bags?"** dye-lot explanation as an inline disclosure, plus the inline itemized order-summary panel. Order renders the **same** itemized quote. One selector, two views — so Supplies and Order can never diverge (SC4).

### Order — honest client-side handoff & the order packet (ORDER-01/02)
- **D-08:** **Auto-filled, locked spec + finish + ship-to + itemized quote → download a versioned JSON packet.** The print spec is **locked** (Rolled Canvas fixed, size derived from grid, finish) — nothing GemPixel already resolved is re-entered (ORDER-01). Completion = **downloading a versioned, self-contained order packet** with a schema `version` field (design/chart reference, canvas spec, optimized gem-bag list, integer-cents quote snapshot; forward-compatible with the v5.0 backend). Reuse existing `export.ts` / `projectStore` serialization patterns. The ship-to address stays **client-side only** — embedded in the downloaded file, never sent anywhere.
- **D-09:** **No implied payment, no fake receipt (ORDER-02).** The terminal state is an honest "packet downloaded — take this to the vendor" confirmation. **No order number, no receipt, no payment UI** — real payment + lab submission are v5.0. This is a hard honesty constraint (consistent with Phase 22's `$0` tax / honest-shipping decisions).

### Upload — recent projects & the size-selection move (UPLOAD-01)
- **D-10:** **Drag/drop + browse + an inline recent-projects list from `projectStore`.** Upload composes the existing ingest path plus an **inline list** of recent projects (thumbnails/summaries from `projectStore`); selecting one rehydrates state and advances into the flow — no modal picker (per design handoff Storyboard A1). **Canvas-size selection is removed from Upload** and owned by Refine (SC1/D-03).

### Claude's Discretion
- Exact prop interfaces / `<Screen>Props` shapes for the four screens, and how much App prop-drills vs passes a small grouped props object — follow the Phase 20/21 "App owns state, children pure" convention; **no new context/store** (props only).
- `flags.ts` shape — plain `const` booleans vs a typed record; whether flags are inlined or a tiny module. Keep it one obvious place.
- The Advanced disclosure implementation (native `<details>` vs a controlled Pill-toggle disclosure) and the recent-projects thumbnail size/layout.
- Order-packet filename, the exact `version` string, and packet field naming — as long as it is self-contained, versioned, and forward-compatible with the future v5.0 backend schema.
- Which screen lands first in the swap order (Refine is the keystone and highest-risk; Upload is the simplest starting swap — planner sequences the flags).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (source of truth for look/behavior)
- `C:\Users\rickf\OneDrive\Desktop\GemPixel\GEM PIXEL design review\design_handoff_ui_redesign\README.md` — the design contract: Storyboard A (customer desktop 4-step journey — **A1 Upload / A2 Refine / A3 Supplies / A4 Order**), Atelier tokens, per-screen state/data shapes, and control specs. (External to the repo — absolute path.)
- `…\design_handoff_ui_redesign\screenshots\` — reference renders `A1-upload.png`, `A2-refine.png`, `A3-supplies.png`, `A4-order.png` (A2 shows the size cards, edge-cleanup segmented control, and color slider most directly).
- `…\design_handoff_ui_redesign\GemPixel Redesign.dc.html` — high-fidelity prototype. **Reference only — do NOT ship; `support.js` is a prototyping runtime, not a production dependency.**

### Milestone grounding
- `.planning/ROADMAP.md` §"Phase 23" — goal, Success Criteria SC1–SC5, dependencies (Phase 21 primitives, Phase 22 engine), and the strangler build constraints.
- `.planning/REQUIREMENTS.md` — UPLOAD-01, REFINE-01..05, SUPPLIES-01/02, ORDER-01/02 (+ the §Traceability notes on smoothing/reducer/quote reuse). REFINE-04 & SUPPLIES-02 are already Complete (engine); this phase wires them.

### Live engine touchpoints (frozen signatures — verify line numbers at plan time)
- `src/engine/quote.ts` — `buildOrderQuote(...) → OrderQuote` (integer-cents, `QuoteLineItem[]` summing exactly to total; `TAX_RATE_ESTIMATE = 0`). **Supplies + Order both read this single selector** (D-07).
- `src/engine/density.ts` — `gridToInches(...)`, `formatInches(...)`, `DOTS_PER_INCH = 10`, `MM_PER_DOT = 2.5`. Feeds SizeCard's derived-inches (D-05); no hard-coded inch labels.
- `src/engine/color.ts` — `reduceToColorCount` (target-N merge) + `getColorDistance` (CIEDE2000); post-process consumed by the Refine color slider (D-03).
- `src/engine/smoothing.ts` — `smoothMatches(strength 0–3)`; runs before reduction (Phase 22 D-05), driven by the edge-cleanup segmented control (D-03).
- `src/engine/bagPlanner.ts` — `planOrderSupply(counts, shape, priceDb) → OrderSupplyPlan` (rows, `+10%` safety, bags); the Supplies table + "why these bags?" source (D-07).
- `src/engine/projectStore.ts` — `projectStore` (list/save/load), `ProjectSummary`, `RecentImage`, `generateThumbnail`, `generateUUID`; powers the Upload recent-projects list (D-10).
- `src/engine/export.ts` — existing serialization/download pattern to reuse for the Order packet (D-08).
- `src/features/match/useDiamondArtMatch.ts` — owns the match pipeline; exposes `detectedColorCount` and applies `smooth → reduce`; the Refine controls wire to it (D-03/D-04).

### Reusable UI (Phase 21 — built, unwired)
- `src/ui/SegmentedControl.tsx` (edge-cleanup 4-seg), `src/ui/Slider.tsx` (color-count, native `input[type=range]`), `src/ui/SizeCard.tsx` (dumb card — parent passes `gridDims`/`inches`/`drillCount`/`selected`/`onSelect`), `src/ui/Pill.tsx`, `src/ui/Button.tsx`, `src/ui/cn.ts`.

### Shell / integration (Phase 20 — built)
- `src/features/wizard/AtelierShell.tsx` — takes `children` (step panels + single-mount viewer), `step`/`canEnter`/`goTo`/`stale`/`onSave`. The four screens render inside its body.
- `src/features/wizard/stepMeta.ts` (`STEP_META`) — the one place step labels/order live (Phase 20 D-02); the semantic remap is a data edit here.
- `src/App.tsx` (2460 lines) — the state owner; renders `data-step-panel` CSS-toggled siblings (~L1406–1509) where each new screen swaps in behind its flag (D-02). Hoisted `<CanvasViewer>` must stay single-mount.
- `src/features/wizard/useWizard.ts` — 1..4 index state machine, preserved (Phase 20 D-04).

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/TESTING.md` — pure-engine/thin-UI split, naming (`PascalCase.tsx`, `<Component>Props` above component, named exports, no barrels, co-located `__tests__/`), and the Vitest baseline the new screen tests extend.

### Prior-phase decisions carried in
- `.planning/phases/20-atelier-design-system-canvas-first-shell/20-CONTEXT.md` — D-01 App-owns-state, D-02 `STEP_META`, D-13 soft-invalidate, D-14 single-mount viewer.
- `.planning/phases/21-shared-ui-primitives/21-CONTEXT.md` — the `src/ui/` primitive APIs (D-04/D-05 controlled, SizeCard dumb-card contract).
- `.planning/phases/22-additive-engine-density-color-reducer-single-source-quote/22-CONTEXT.md` — D-01..D-08 (reducer, `detectedColorCount`, canonical transform order, single-source quote, honest tax/shipping).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/ui/` primitives (Phase 21)** — SegmentedControl, Slider, SizeCard, Pill, Button are built, tokened, and a11y-correct; screens compose them, not raw markup.
- **`engine/quote.ts` `buildOrderQuote` + `planOrderSupply`** — the single-source total + drill plan; Supplies and Order consume, never recompute (D-07).
- **`engine/density.ts` `gridToInches`/`formatInches`** — the one derived-inches source for SizeCards (D-05).
- **`engine/projectStore.ts`** — list/save/load + thumbnails already exist; Upload's recent list is wiring, not new persistence (D-10).
- **`useDiamondArtMatch` `detectedColorCount` + `smooth → reduce` pipeline** — the Refine controls wire straight to it (D-03).
- **`AtelierShell` `children` seam + `data-step-panel` sibling slots** — the swap points; new screens drop in behind flags with the viewer untouched (D-02).

### Established Patterns
- **App.tsx owns all state; children pure/props-only** (Phase 20) — the four screens are controlled, no new store/context.
- **Single-source aggregators can't diverge** (`planOrderSupply` → `quote.ts`) — Supplies/Order both read the one selector.
- **Slider max stays stable under the user; only a real re-match moves it** (Phase 22 D-04) — drives the two-tier reactivity split (D-03/D-04).
- **Honesty constraints** — no figure/state reads as more finalized than reality (Phase 22 tax/shipping) — extends to "no fake receipt" on Order (D-09).
- **Naming/structure** — `PascalCase.tsx`, `<Component>Props` above component, named exports, co-located tests, no barrels.

### Integration Points
- `src/features/screens/*` (new) ← composed by App inside `AtelierShell` children, gated by `src/features/screens/flags.ts`.
- Refine ↔ `useDiamondArtMatch` (size → re-match; edge-cleanup + color slider → post-process).
- Supplies + Order ↔ `engine/quote.ts` (`buildOrderQuote`) + `planOrderSupply`.
- Order packet ↔ `engine/export.ts` / `projectStore` serialization.
- Upload ↔ `projectStore` (recent list) + existing ingest path.

</code_context>

<specifics>
## Specific Ideas

- **Refine is the keystone** — highest-fidelity screen; the design handoff A2-refine.png is the visual contract for the size cards, edge-cleanup segmented control, color slider, and the collapsed Advanced disclosure.
- **The color slider must feel live and never jump** — post-process ticks only, max pinned to `detectedColorCount`; show the live merged count beside the slider so the smoothing dead-zone reads as "already at N," not a broken control (Phase 22 D-05 note).
- **"No visible change" reducer contract** — lowering colors merges only orphan drills; the picture doesn't visibly shift.
- **Honest Order** — a download + "take this to the vendor" confirmation, not a checkout. No order number, no payment, no receipt.
- **One nav, inline everything** — the design principle "you never open a side menu to find information" holds; recent projects, custom size, and Advanced are all inline, not modals/drawers.

</specifics>

<deferred>
## Deferred Ideas

- **Mobile responsive + touch** — single portrait column at ~300px, pinch-zoom, `touch-action: none` → **Phase 24**.
- **Deleting legacy Step1..4 components, side asides, theme toggle, dead sidebar/preset state** — the strangler flags flip fully on and the old bodies are removed → **Phase 25**.
- **Tunable Delta-E merge guard threshold** (v4.0 ships fixed-conservative) → **REFINE-06 (v4.x)**.
- **Richer finish/canvas visualization proof on Order** → **ORDER-03 (v4.x)**.
- **Service-fee line + order-ref/threshold auto-flagging** (old Phase 17 idea) → deferred per ROADMAP note; not in v4.0 ORDER scope.
- **Real payment + lab submission** (the actual order fulfillment behind the packet handoff) → **v5.0**.

None of the above were scope creep — all are already-mapped later phases / deferred requirements; captured so nothing is lost.

</deferred>

---

*Phase: 23-the-four-screens-in-flow-order*
*Context gathered: 2026-07-14*
