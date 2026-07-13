# Feature Research — v4.0 Canvas-First Redesign

**Domain:** Client-side photo → diamond-art (gem-art) product configurator + canvas-first quote/handoff flow
**Researched:** 2026-07-13
**Confidence:** HIGH for engine-feasibility claims (read against shipped `src/engine/`), MEDIUM for market-expectation claims (domain-standard configurator UX + the design handoff, which is itself the feature contract). No external web research was run — the high-fidelity design handoff is the descriptive spec and the existing engine is ground truth.

> Supersedes the v3.0-era FEATURES.md (two-mode/viewport scope was force-closed; that milestone's Artist-mode and coach-mark specifics are out of scope here). This edition covers only the five v4.0 target feature areas.

## Framing

This milestone is a **UI/UX redesign of an already-working tool**, not a greenfield build. Color science, matching worker, supply optimizer, pricing, vendor cost table, symbols, exports, and persistence all ship today. The majority of the "new" customer-facing features are **re-presentations of engine capabilities that already exist** — the work is UI recomposition (canvas-first, no-side-menu, 4-step, mobile) plus a small number of genuinely new computations (target-N color reduction, a customer quote breakdown, an order packet/handoff).

Two headline "new" Refine controls are **already implemented in the engine** and only need rewiring:
- **Edge cleanup** = `engine/smoothing.ts::smoothMatches` — iterative 8-neighbour majority filter (strength 1/2/3 → passes 1/2/3, min-agree 6/5/4). Already wired via `useDiamondArtMatch` + persisted `gempixel_smoothing_strength`.
- **Drill-merge (color-count)** = `engine/color.ts::substituteLowCountColors` — merges low-frequency codes into their nearest already-used shade by **CIEDE2000 Lab distance**. Already wired via `enableSubstitution` + `substitutionThreshold`.

## Feature Landscape

### Table Stakes (Users Expect These)

A photo-to-product configurator is broken without these. Missing = the redesign feels incomplete.

| Feature | Why Expected | Complexity | Engine dependency / notes |
|---------|--------------|------------|---------------------------|
| Horizontal 4-step nav as the only navigator (Upload→Refine→Supplies→Order) | It's the entire IA of the redesign | MEDIUM | New shell; replaces the sidebar/HUD wizard. State: `currentStep` + per-step completion. |
| Forward via primary CTA; back via any completed step; upcoming steps dimmed/disabled | Standard wizard affordance | LOW | Pure UI state machine. Completed=check, current=number, upcoming=`opacity:.45`. |
| Step validation gating (no Refine without image; no Supplies without a computed match) | Prevents empty/half-baked downstream states | LOW | Gate on `image != null`, `matchResult != null`. |
| Upload: drag-drop + browse + recent projects | Entry point; recent chips reuse existing multi-project store | LOW | `ingest.ts` + `projectStore.ts` (built). Object URLs, never uploads. |
| Live chart preview re-rendering on every control change | The whole point of "Refine is live" | LOW–MED | `useDiamondArtMatch` + `viewer.ts` already recompute via useMemo. Size change re-runs worker; cleanup/color-count are cheap post-match transforms. |
| Size selection with explicit dimensions + resulting grid | Users must know what they're buying | LOW | Grid dims → drills=`cols*rows`; grid→inches via 10 dots/inch (already in `calculateCanvasCost`). |
| Supply/legend table: symbol · swatch · DMC · drills(+10%) · bags | Core deliverable; already shipped | LOW | `planOrderSupply` + `symbols.ts` (built). Re-layout into the Atelier table. |
| Itemized price breakdown before the order action (canvas + shipping + tax + total) | Nobody commits without seeing the number and its parts | MEDIUM | `calculateCanvasCost` + `planOrderSupply` + `money.ts` (built). New: one customer-facing breakdown + a tax **estimate**. |
| An honest, actionable order artifact (no backend) | If you can't charge, you must still hand the user something real | MEDIUM | Download an order packet + deep-link to the lab upload page (`VENDOR_REGISTRY.uploadUrl` exists). See boundary section. |
| Mobile single-column journey (same 4 steps inline, never a drawer) | Most customer traffic is mobile; handoff mandates it | MEDIUM | Responsive recompose; 4-segment progress bar + back chevron per screen. |
| Save / resume a project | Already shipped; users expect persistence | LOW | `projectStore.ts` (built). |

### Differentiators (Competitive Advantage)

Aligned with the Core Value (accurate, non-AI, high-fidelity planning). Where the redesign competes.

| Feature | Value Proposition | Complexity | Engine dependency / notes |
|---------|-------------------|------------|---------------------------|
| **Color-count slider, max = real DETECTED count; lowering merges orphan drills into a near-identical used shade** | Kills single-drill "orphan" colors (a real cost + sourcing + stitching pain) with **no visible change** — a concrete, honest simplification | MEDIUM | Reuses `substituteLowCountColors`'s CIEDE2000 nearest-used remap; needs a **target-N adaptation** (deep-dive below). Detected max = `Object.keys(rawMatch.counts).length`. |
| Live per-size drill counts on the size cards | Instant supply/cost feedback while choosing size; turns an abstract dimension into "4,240 drills" | LOW | `cols*rows` per candidate size; no worker re-run to preview counts. |
| Edge cleanup 4-segment (Off/Light/Med/Strong) | Cleaner, more stitchable chart than raw per-pixel matching; dissolves specks, straightens edges | LOW | `smoothMatches` (built). Off→disabled, Light/Med/Strong→strength 1/2/3. Relabel + wire. |
| "Why these bags?" savings explainer + savings headline | Shows the optimizer's value (fewest-bags vs naive) in plain language; builds trust | LOW | `planOrderSupply` already returns `savingsCents`/`savingsPct` + dye-lot rationale (built, Phase 16). |
| Auto-filled, LOCKED lab spec ("nothing to re-enter") | Collapses the lab's multi-step order form into one confirm screen | MEDIUM | Product fixed to Rolled Canvas; size from grid; finish default Trimmed. UI + packet assembly. |
| Canvas-first, no-side-menu, everything-inline layout | The guiding UX principle; distinguishes from sidebar-heavy planners | MEDIUM | Layout work; retires expand/collapse sidebars + page-flip wizard. |
| Detected-vs-matched transparency ("24 of 26 matched") | Honest about palette coverage; surfaces unmapped colors instead of silently dropping | LOW | Match counts + active candidates; unmapped surfacing already a DATA-01 behavior (built). |

### Anti-Features (Implied by the Mock, but Problematic Here)

The handoff's illustrative mock leans on backend behavior. Recreating those literally, client-side, would be dishonest or broken.

| Feature | Where it appears | Why problematic | Alternative |
|---------|------------------|-----------------|-------------|
| "Place order · $57.00" implying a completed charge | A4/B4 mock reads as checkout | **No payment, no lab submission** this milestone; taking money it can't take is misleading | Honest CTA: "Download your order" / "Get your canvas order packet" / "Send to lab". Say what actually happens next. |
| Real-time sales tax / VAT computed client-side | Price card "Tax" | Correct tax needs jurisdiction+nexus+rates = backend; a wrong number is a legal/trust risk | A clearly-labeled **estimate** (curated flat rate or "estimated — finalized by the lab"). Retire "calculated next" (no next step exists). |
| Live Lumaprints/FinerWorks rate API from the browser | Handoff "Pricing/sizing" item | CORS, client-side keys, rate limits, beta instability — and PROJECT defers vendor APIs to v5.0 | The shipped **curated cost table** (`VENDOR_REGISTRY` + `calculateCanvasCost`) with a "prices estimated" disclosure. |
| Server-rendered "what shipped = what bought" proof | A4 canvas proof; handoff item #2 | Authoritative render is server-side (v5.0); a client screenshot is not print-grade | Show the client chart as a **preview/proof-of-layout** (labeled). Real render is v5.0. Reuse `export.ts` PNG for the packet. |
| Unbounded "Custom size" free-entry | Refine footer "Custom size" | Can yield absurd drill counts, out-of-tier canvas (falls to `sqInchRate` extrapolation), or degenerate grids | Keep custom size but **clamp** to a sane range; show live drills+price; block sizes the cost table can't price. |
| Embedding the design PNG in localStorage on the packet | "Everything in the project" convenience | PNGs blow the localStorage quota fast (app already guards storage failures) | Deliver the PNG as a **file download** (v3.0 ORDER-05 decided this); JSON packet references it, never inlines bytes. |
| Exposing the editable price table / affiliate params / drill-cart link on the customer flow | They exist in the tool today | Artist-mode economics leaking into a customer quote (v3.0 MODE-02 concern) erodes trust, reveals margins | Customer flow shows only the finished quote. No separate Artist mode is in v4.0 scope, so simply don't render those surfaces. |
| Backend confirmation email / order-ID lookup / status tracking | Mock ops console + tracking | Entire fulfillment backend is v5.0 | Client-side confirmation only: a locally-generated reference + the downloadable packet. No server round-trip. |
| Re-run the worker on every slider tick | "Refine is live" | Re-matching per color-count tick thrashes the worker on large grids | Color-count + edge-cleanup are **post-match transforms** on the cached grid (as today) — instant. Only size change re-runs the worker (debounce it). |

## Deep-Dive: The Color-Count Slider / Drill-Merge (quality-gate item)

**What the customer wants:** a slider whose maximum is the *actual detected/matched* color count (often 24+ on real photos), where lowering it removes rare "orphan" colors (single/few drills of an exotic shade) by reassigning those cells to the **nearest already-used** color — with no perceptible change to the picture. Fewer distinct colors = fewer bags, fewer symbols, easier stitching.

**What exists:** `substituteLowCountColors(gridCodes, counts, activeCandidates, threshold)`:
- Splits colors into low-count (`count <= threshold`) and high-count (`count > threshold`).
- For each low-count code, finds the nearest high-count code by `getColorDistance` (**CIEDE2000 in CIELAB**, the same metric the matcher uses — so the merge target is genuinely the closest usable shade).
- Remaps the grid and recomputes counts. Pure, no worker, cheap.

**The gap:** the shipped control is **threshold-based** ("merge anything ≤ N drills"), but the design wants a **target-count** control ("reduce to N total colors, max = detected count"). Different axes:
- Threshold answers "how rare is rare?"
- Target-N answers "how many colors do I end up with?"

**Recommended adaptation (MEDIUM, mostly reuse):** add `reduceToColorCount(gridCodes, counts, activeCandidates, targetN)` that:
1. Ranks colors by frequency descending; the top `targetN` become the "kept/used" set (mirrors "high-count"), the rest the "merge" set (mirrors "low-count").
2. Reuses the exact CIEDE2000 nearest-kept remap loop from `substituteLowCountColors` — factor the inner remap into a shared helper so both entry points share one code path and one test surface.
3. Recomputes counts from the remapped grid.

The slider runs `min(floor=8, detectedMax)` → `detectedMax`; at `detectedMax` it's a no-op (identity), and lowering merges the least-frequent colors first into their nearest kept shade. Because merges target the CIEDE2000-nearest kept color, the visible change is minimal exactly when merged colors are rare and near a used shade — the orphan-drill case.

**Approaches considered (and why this one):**
- *Frequency-rank + nearest-used (recommended):* deterministic, directly maps "detected → target," reuses shipped distance math. Best fit for a slider.
- *Pure threshold (shipped):* simpler but max/slider semantics don't match "detected color count," and equal-frequency ties make the resulting count non-monotonic in the slider — worse UX.
- *Perceptual clustering (k-means / median-cut in Lab to N clusters):* more globally "optimal" but (a) can move colors that were fine, (b) heavier compute, (c) can pick a merge target not already in the palette. Rejected: the value prop is "merge into a shade **you already use**," which nearest-kept guarantees and clustering does not.
- *ΔE guard (only merge if ΔE < X):* good enhancement — cap merges so the slider can't force a visibly-wrong merge; surface "can't reduce further without visible change." Optional polish on top of frequency-rank.

**Detected color count source:** `Object.keys(rawMatchResult.counts).length` *before* substitution/smoothing — the honest "26 matched" number that drives the slider max and the "N of M matched" caption.

**Pipeline placement:** `useDiamondArtMatch` currently applies substitution *then* smoothing, recomputing counts each step. The color-count reduction slots in at the substitution stage (it *is* the substitution, generalized); smoothing runs after. Both are post-match, so the slider stays instant.

## Client-Side-Feasible NOW vs Implies-Backend (v5.0) — explicit boundary

| Capability | v4.0 client-side | Requires v5.0 backend |
|------------|------------------|-----------------------|
| Grid→inches, drill counts, size cards | ✅ `cols*rows`, 10 dots/inch (built) | — |
| Edge cleanup | ✅ `smoothMatches` (built) | — |
| Color-count reduction / drill-merge | ✅ `substituteLowCountColors` + target-N adaptation | — |
| Supply plan (bags, +10%, savings) | ✅ `planOrderSupply` (built) | — |
| Canvas base cost + shipping | ✅ curated `VENDOR_REGISTRY` + `calculateCanvasCost` (built) | Live vendor rate APIs |
| Quote total (integer cents, reconciled) | ✅ `money.ts` (built) | — |
| Tax | ⚠️ **estimate only** (curated/flat, clearly labeled) | Real jurisdiction-based tax |
| Order artifact | ✅ downloadable packet (JSON, integer cents, no PII) + PNG file | — |
| Lab handoff | ✅ deep-link to `uploadUrl` (pre-filled where the lab supports query params) | API submission as merchant-of-record |
| "Place order" / charge | ❌ not this milestone — reframe honestly | Payments + Lumaprints API |
| Print-grade "what shipped = what bought" render | ⚠️ client preview only (labeled) | Server-side PNG/PDF render |
| Confirmation ID / status / tracking | ⚠️ local reference only | Orders DB, shipment webhooks |

**Order step honest table-stakes behavior (no backend):** collapse the confirm screen to (1) a locked, auto-filled spec the user can review, (2) a full itemized quote with tax clearly marked *estimate*, and (3) one primary action that **downloads the order packet and/or deep-links to the lab's upload page**, with an email/share fallback. Copy must say what actually happens ("We'll prepare your order file and take you to our print lab" — not "Place order · $57.00" implying a charge). The v3.0 ORDER-04/05 packet decisions (versioned, JSON-round-trippable, integer-cents quote snapshot, no PII, PNG as a file) are directly reusable and forward-compatible with the v5.0 backend that will ingest the same schema.

## Feature Dependencies

```
[Match pipeline: useDiamondArtMatch + matcher.worker] (BUILT)
    ├──enables──> [Live chart preview]
    ├──enables──> [Edge cleanup]  ── uses ──> smoothMatches (BUILT)
    ├──enables──> [Color-count slider] ── uses ──> substituteLowCountColors + target-N adapt
    │                   └──requires──> [Detected color count = distinct raw match codes]
    └──enables──> [Supply table] ── uses ──> planOrderSupply (BUILT) + symbols (BUILT)

[Size selection] ──drives──> [grid dims] ──> [drill counts] + [calculateCanvasCost] (BUILT)

[Supply plan] + [Canvas cost] + [Tax estimate]
    └──assemble via money.ts (BUILT)──> [Customer quote breakdown]
                                             └──requires──> [Order packet]
                                                                └──requires──> [PNG export (export.ts, BUILT)]
                                                                └──enables──> [Lab deep-link handoff]

[4-step shell + validation gating] ──wraps──> ALL customer screens
[Mobile single-column] ──recomposes──> the same components
```

### Dependency Notes
- **Color-count slider requires the detected color count**, read from the *raw* match (pre-substitution) so the max reflects reality; wire it before the substitution stage in `useDiamondArtMatch`.
- **Quote breakdown requires the supply plan AND canvas cost**, both reconciled through `money.ts` so line items sum to the total (PRICE-03 invariant already enforced) — do not introduce a parallel float path.
- **Order packet requires the quote AND a PNG file** — deliver the PNG via `export.ts` as a download, not inline in storage (avoids the quota anti-feature).
- **Everything requires the 4-step shell + gating** — build the shell + step state machine first; it's the load-bearing structure the rest hangs on.
- **Edge cleanup and color-count operate on the cached match** (post-match transforms) — they must NOT retrigger the worker; only size/dimension/palette changes do.

## MVP Definition

### Launch With (v4.0 core)
- [ ] 4-step canvas-first shell + step nav (forward CTA, back-to-completed, validation gating) — the IA everything hangs on
- [ ] Upload step (drag-drop/browse + recent) — entry point, mostly existing engine
- [ ] Refine step: size cards w/ live drill counts, edge-cleanup 4-segment, color-count slider (detected max + drill-merge) — the key screen
- [ ] Supplies step: inline legend/supply table + order-summary panel wired to `planOrderSupply`
- [ ] Order step: locked auto-filled spec + honest itemized quote (tax as estimate) + client-side handoff (packet download + lab deep-link)
- [ ] Mobile single-column journey for all 4 steps
- [ ] Atelier light theme tokens/type (retire dark mode)

### Add After Validation (v4.x)
- [ ] ΔE guard on color-count merges ("can't reduce further without visible change") — trigger: users report a visibly-wrong merge
- [ ] Custom-size input with clamps + live drills/price — trigger: presets prove too limiting
- [ ] Richer proof preview (finish visualization) — trigger: users confused about Trimmed vs wrap

### Future Consideration (v5.0 — backend)
- [ ] Real payment + Lumaprints API submission (merchant of record)
- [ ] Server-side print render (PNG/PDF), asset storage
- [ ] Real tax, order status, dual shipment tracking, ops console + sourcing

## Feature Prioritization Matrix

| Feature | User Value | Impl. Cost | Priority |
|---------|-----------|------------|----------|
| 4-step shell + gating | HIGH | MEDIUM | P1 |
| Refine: size cards + live drills | HIGH | LOW | P1 |
| Refine: edge cleanup (rewire built engine) | MEDIUM | LOW | P1 |
| Refine: color-count slider + drill-merge (target-N adapt) | HIGH | MEDIUM | P1 |
| Supplies table + summary (built engine) | HIGH | LOW | P1 |
| Order: honest quote + packet + lab handoff | HIGH | MEDIUM | P1 |
| Mobile single-column | HIGH | MEDIUM | P1 |
| Atelier light theme | MEDIUM | MEDIUM | P1 |
| Savings explainer surfacing (built) | MEDIUM | LOW | P2 |
| ΔE merge guard | MEDIUM | LOW | P2 |
| Custom size with clamps | MEDIUM | MEDIUM | P2 |

**Priority key:** P1 = must have for the milestone · P2 = should have, add when possible · P3 = nice to have.

## Notable Spec Corrections (flag for requirements)

- **Size-card inch labels in the handoff are illustrative and inconsistent with the real density.** The mock shows `Small 18×12 in / 60×40 grid`, but at the project's canonical 10 dots/inch, a 60×40 grid = **6×4 in**, not 18×12. The **drill counts are correct** (60×40 = 2,400 ✓). Requirements must compute inch labels from the real cols→inches mapping (`calculateCanvasCost` already does `width/10`), not copy mock numbers. This is the "accurate quoting" requirement's first concrete task.
- **"Tax calculated next" copy implies a next step that doesn't exist** with no backend — replace with an estimate label.
- **"24 of 26 matched" must be driven by real detected counts**, frequently 24+ on complex photos — the slider max must not be hardcoded or capped low.

## Competitor / Reference Feature Analysis

| Feature | Photo→product configurators (Shutterfly/CanvasPop/POD builders) | GemPixel v4.0 approach |
|---------|-----------------------------------------------------------------|------------------------|
| Guided flow | Linear stepper with a live preview; back to completed steps | Same 4-step stepper as the *only* nav, canvas-first, inline surfaces |
| Live configuration | Size/material update price + preview instantly | Size updates drills+price+preview; cleanup/color-count are instant post-match |
| Simplification controls | Rare in DIY chart tools; usually just "number of colors" | Detected-max color slider that merges into a **used** shade (honest, no visible change) |
| Quote transparency | Itemized subtotal + shipping + tax at checkout | Itemized canvas + drills + shipping + **tax estimate**, disclosed pre-action |
| Checkout | Real cart + pay | Honest client-side packet download + lab deep-link (no charge this milestone) |

## Sources

- Design handoff (feature/behavior contract, MEDIUM — illustrative mock data, corrected above): `C:\Users\rickf\OneDrive\Desktop\GemPixel\GEM PIXEL design review\design_handoff_ui_redesign\README.md`.
- Existing engine (ground truth, HIGH): `src/engine/smoothing.ts` (edge cleanup), `src/engine/color.ts::substituteLowCountColors` + `getColorDistance` (drill-merge / CIEDE2000), `src/engine/bagPlanner.ts::planOrderSupply` (supplies + savings), `src/engine/checkout.ts::calculateCanvasCost` + `VENDOR_REGISTRY` (quoting), `src/engine/money.ts` (integer-cents reconciliation), `src/features/match/useDiamondArtMatch.ts` (pipeline order).
- Prior scope decisions (HIGH): `.planning/PROJECT.md`, `.planning/milestones/v3.0-REQUIREMENTS.md` (ORDER-04/05 packet contract, MODE-02 economics-leak concern, anti-features list).

---
*Feature research for: client-side gem-art configurator redesign (GemPixel v4.0)*
*Researched: 2026-07-13*
