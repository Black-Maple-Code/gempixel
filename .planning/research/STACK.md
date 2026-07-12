# Stack Research — v3.0 Two-Mode Viewport Experience

**Domain:** Client-side gem-art / diamond-painting planner (Preact + Vite + Web Worker), frontend-first milestone
**Researched:** 2026-07-12
**Confidence:** HIGH

> **Scope of this document.** This is a *subsequent-milestone* stack review. The validated base stack
> (Preact 10, Vite 6, TypeScript strict, Tailwind v4, `culori`, native Web Worker, `safeStorage` +
> `usePersistentState`) is **fixed and NOT re-researched** — its rationale lives in the embedded stack
> block of `.agents/GEMINI.md`. Everything below concerns only the *new* v3.0 capabilities and answers
> one question per feature: **add a dependency, or stay browser-native?**
>
> **Headline verdict: v3.0 needs essentially ZERO new runtime dependencies.** The one dependency worth
> considering is `@preact/signals` (first-party, ~1.6 KB) for the viewport/mode state, and it is
> *optional*. Everything else — coach-marks, the order packet, the email/export path, and the gem-bag
> optimizer — is best done with browser-native APIs and code the repo already has.

---

## Recommended Stack (additions only)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@preact/signals** *(optional, recommended)* | `^2.9.2` (pulls `@preact/signals-core ^1.14.2`) | Cross-cutting viewport + mode state (`mode`, active contextual panel, wizard step) with fine-grained reactivity | First-party Preact, ~1.6 KB core. A viewport-native app has one expensive canvas subtree and many small in-canvas HUD controls; signals let a control update **without re-rendering the canvas host**, which plain `useState` lifted into `App.tsx` cannot do cleanly. Drop-in alongside existing hooks. |
| **Browser-native (no dep)** | — | Coach-marks / contextual guidance, order-packet generation, share/export path, bag optimization | Popover API + CSS Anchor Positioning are Baseline 2026; `Blob`/`canvas.toBlob`/`URL.createObjectURL` are already used in `export.ts`; the bag optimizer already exists in `bagPlanner.ts`. Adding libraries here would fight the canvas-centric UI and bloat a bundle the developer deliberately keeps light. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **fflate** | `^0.8.3` | Zip `manifest.json` + `canvas.png` + `summary.html` into ONE `.zip` packet | **Only if** UX requires a single-file deliverable. 8 KB min (ZIP archiving = +3 KB), tree-shakeable, zero-dep, fast. If a multi-file download (or a single self-contained JSON with an embedded base64 PNG) is acceptable, **skip this** — no dep at all. |
| **driver.js** | `1.x` (~5 KB gzip) | DOM-element highlight tour, first-run only | **Escape hatch, not recommended.** Only if a scripted first-run walkthrough of *DOM controls* is demanded. It cannot guide *in-canvas* attention (the actual v3.0 need), so prefer native overlays. Listed so the roadmap can reject it deliberately. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest (existing) | Variant-integrity + pricing test (`DATA-01`, `PRICE-01/02`) | Reuse the existing `bagPlanner.test.ts` node-env pattern. Add a table-driven test asserting every `DRILL_VARIANTS` entry has a priced bag for each declared size and **no `$0`/unpriced tier**. No new tooling. |
| TypeScript (existing) | Versioned packet manifest schema | Define `OrderPacketV1` as a strict interface with a `schemaVersion` literal so the v4.0 backend has a stable contract to parse. No new tooling. |

## Installation

```bash
# Optional (recommended) — viewport + mode state
npm install @preact/signals

# Optional (ONLY if a single-file .zip packet is required)
npm install fflate

# NOT recommended — listed for completeness / deliberate rejection
# npm install driver.js
```

Everything else (coach-marks, packet PNG/JSON/HTML, share/email, bag math) requires **no install**.

---

## Answers to the Five Stack Questions

### (a) State management / app-shell for the viewport wizard + mode split

**Verdict: stay on Preact, add `@preact/signals` for the handful of cross-cutting values. Do NOT add a store or a state-machine library.**

- Today state is plain `useState`/`useCallback` in `App.tsx` plus `usePersistentState` (see `useWizard.ts` — a clean 50-line machine). That is the right foundation.
- The *new* pressure is that a viewport-native design has sibling widgets (in-canvas HUD, contextual panels, mode-specific chrome) that all read/write a small shared core: `mode: 'customer' | 'artist'`, the active contextual panel, and the wizard step. Lifting all of that into `App.tsx` and prop-drilling through a canvas host causes the whole viewport to re-render on every toggle.
- `@preact/signals` fixes exactly this: a `signal`/`computed` is read where it's used and updates only those subscribers, leaving the canvas subtree untouched. It's first-party and tiny.
- **Zero-dep fallback (acceptable):** Preact Context + `useState` for the same core state. Works, but coarser re-renders; fine if the developer wants literally no new runtime dep.
- **Mode split is a discriminated union, not a state chart.** `type AppMode = 'customer' | 'artist'` gating rendered paths is enough; the existing `useWizard` already models step transitions.

**Do NOT add:** Redux, Zustand, Jotai (external stores — unnecessary for one small shared core), or **XState** (a ~15 KB state-machine lib is overkill for a 4-step wizard + a 2-value mode toggle the repo already handles in 50 lines).

### (b) In-canvas guided wizard / coach-marks WITHOUT heavy tour deps

**Verdict: browser-native. Preact overlay components + the Popover API + CSS Anchor Positioning. No tour library.**

- The v3.0 need is *in-canvas guidance* — cues anchored to the viewport and canvas, not tooltips bolted onto arbitrary DOM elements. Tour libraries (Shepherd ~12 KB+, React Joyride ~34 KB, intro.js) are element-highlight engines that assume a DOM-form flow and actively fight a canvas-centric layout.
- **Native building blocks (all Baseline 2026, ~91% of traffic):**
  - **Popover API** (`popover` attribute / `showPopover()`) — stable in all engines — for contextual popovers/coach-mark bubbles with top-layer stacking and light-dismiss for free.
  - **CSS Anchor Positioning** (`anchor()`, `position-anchor`) — Baseline 2026 (Chrome 125+, Firefox 132+, Safari 18.2+) — to pin a coach-mark to a HUD control with no JS positioning math. *Caveat:* Safari 18.2–18.3 places correctly but doesn't auto-flip (`@position-try`); provide a simple fallback placement.
  - **In-canvas cues** — draw directly on the existing canvas (the `export.ts`/`viewer.ts` 2D-context patterns) or overlay absolutely-positioned Preact `<div>`s over the canvas for a highlighted region + caption.
- This is a natural extension of the Phase 9 viewport HUD already in the codebase — a `<CoachMark>` Preact component driven by a signal is a few dozen lines.

**Do NOT add:** driver.js / Shepherd / React Joyride / intro.js. driver.js is the smallest (~5 KB) and is the only defensible fallback *if* a scripted DOM walkthrough is later demanded — but it does not solve in-canvas guidance, so adopting it now would add weight for the wrong problem.

### (c) Generating the order packet client-side (JSON manifest + PNG + printable summary)

**Verdict: 100% browser-native. Reuse `export.ts` + `projectStore.ts` patterns. `fflate` only if a single `.zip` is required.**

The packet has three parts, each already achievable with what's in the repo:

1. **Structured JSON manifest (the star — designed to feed the v4.0 backend).** Define a strict, versioned `OrderPacketV1` TypeScript interface (`schemaVersion`, canvas spec, optimized gem-bag list from `bagPlanner`, service fee, totals, customer note). Serialize with `JSON.stringify` → `Blob(['...'], {type:'application/json'})`. This is the stable contract the v4.0 order-management backend will parse — freeze the shape like `projectStore`'s serialized shapes are frozen.
2. **The PNG.** Already solved: `drawCanvasOnly()` → `triggerCanvasDownload()` in `export.ts` (`canvas.toBlob('image/png')`). Reuse verbatim.
3. **Shareable / printable summary.** Reuse the established **CSS print** approach (`@media print` + `window.print()` → native PDF) from the base stack decision — a print-only summary view (bag list, fee, totals) rather than a PDF library.

**Packaging choice (roadmap decision, both zero-to-tiny weight):**
- **Preferred (zero-dep):** emit the manifest, PNG, and summary as separate downloads, OR a *single self-contained JSON* that embeds the PNG as a base64 data URL (simplest for the backend to ingest; ~33% base64 overhead is fine for one image).
- **Single-file `.zip` (needs `fflate ^0.8.3`):** bundle `manifest.json` + `canvas.png` (raw bytes, no base64 bloat) + `summary.html` into one archive for a tidy emailable deliverable. Adopt `fflate` *only* if the single-file UX is a hard requirement.

**Do NOT add:** jsPDF / pdfmake (already rejected in the base stack — CSS print covers it), JSZip (heavier and slower than `fflate` — if you zip at all, use `fflate`), FileSaver.js (the `URL.createObjectURL` + anchor pattern in `export.ts` already does this).

### (d) Gem-bag optimization algorithm

**Verdict: the exact bounded search is ALREADY IMPLEMENTED in `src/engine/bagPlanner.ts` and is the correct family. Keep it. Do NOT add an ILP/LP solver, and do NOT downgrade to pure greedy.**

Findings from reading `bagPlanner.ts` + `variants.ts`:
- **Problem size is tiny.** Per color there are at most **4 bag tiers** (200 / 500 / 1000 / 2000) and they're solved **independently** per color (dye-lot consistency forbids mixing colors). This is a per-color bounded coin-covering problem, not a large combinatorial optimization.
- **The existing `minCostBulk` is an exact bounded enumeration** — it branches over counts of the larger sizes and ceil-fills the smallest, guaranteeing the optimum in a few hundred evaluations, with a `≤ 800 → 200-count only` dye-lot rule. This is exactly the right approach: small-N **exact DP/enumeration**, not a heuristic.
- **Pure greedy (largest-first) is NOT sufficient** and must not replace it: non-divisible tiers plus per-size pricing make greedy suboptimal (e.g. `1×1000 + 2×500` vs a cheaper/fewer `1×2000`). The current code enumerates precisely to avoid that — correct.
- **An ILP/LP solver is unjustified.** `javascript-lp-solver` / `glpk.js` (WASM, 100 KB+, async init) would add significant weight and a build/init burden to solve a 4-variable-per-color problem that closed-form enumeration already solves optimally and synchronously. **Reject.**

**v3.0 refinement (algorithm stays, no dep):**
- The milestone objective is *"fewest bags while preserving dye-lot consistency,"* but `minCostBulk` currently minimizes **cost**. Clarify the objective (fewest packets vs cheapest) and, if "fewest bags" wins, minimize `packets` with cost as the tiebreak — a one-line change to the comparator in the existing search. (Requirements/roadmap item, not a stack change.)
- **Pricing-accuracy bug surfaced (`PRICE-01/02`, `DATA-01`):** `defaultPacketCost()` in `bagPlanner.ts` prices sizes **200 / 1000 / 2000 / 5000**, but `DRILL_VARIANTS` uses tiers **200 / 500 / 1000 / 2000** — so the **500 tier gets `$0`** and a phantom `5000` tier is priced. This is the "correct 500-bag cost / no `$0` unpriced sizes" requirement. Fix = align the price table to the actual tiers + a **variant-integrity Vitest test** (table-driven over `DRILL_VARIANTS`). No new dependency — reuse the existing `bagPlanner.test.ts` harness.

### (e) Client-side "email / export the packet" path with no server

**Verdict: Web Share API (Level 2, file sharing) as the primary "send," with graceful fallback to download + prefilled `mailto:`. No email SDK, no server.**

- **Web Share API** — `navigator.canShare({ files })` / `navigator.share({ files, title, text })` — can hand the PNG (and, where supported, the packet file) straight to the OS share sheet → the user's mail/messaging app. Excellent on mobile/tablet; feature-detect and progressively enhance.
- **`mailto:` link** — opens the user's mail client with a prefilled subject/body (order summary + totals + a "packet attached" note). **Cannot attach files** (mailto has no attachment support), so it complements, not replaces, the download.
- **Universal fallback (always works):** the existing `export.ts` download pattern — user downloads the packet, then attaches it in their own email or uploads it to the artist. This is the reliable baseline for manual/offline fulfillment.

**Do NOT add:** EmailJS / Resend / SendGrid / Nodemailer or any transactional-email SDK. They require an API key embedded in the client (exposed/abusable) and are effectively a backend service — which is explicitly **deferred to v4.0**. Sending real email is a v4.0 backend concern; v3.0 only *produces and hands off* the packet.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@preact/signals` for shared viewport/mode state | Preact Context + `useState` (zero-dep) | If the developer wants literally no new runtime dependency and accepts coarser re-renders of the canvas host. |
| Discriminated union + existing `useWizard` | XState | Only if the wizard grows into genuinely complex, guard-heavy, parallel states — not the case at 4 steps + a mode toggle. |
| Native Popover API + CSS Anchor Positioning | driver.js (~5 KB) | Only if a scripted first-run walkthrough of DOM controls is later demanded (still won't do in-canvas guidance). |
| Zero-dep multi-file / self-contained JSON packet | `fflate` (`.zip` bundle) | If a single-file emailable archive is a hard UX requirement. |
| Existing exact bounded search in `bagPlanner.ts` | `javascript-lp-solver` / `glpk.js` | Never for this problem (≤4 tiers/color, exact enumeration already optimal). Only if the problem later gains many interacting global constraints. |
| Web Share API + `mailto` + download | EmailJS / Resend / SendGrid | Never client-side (key exposure). Belongs to the v4.0 backend. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any backend / DB / auth / payment SDK (Stripe, Firebase, Supabase, etc.) | v3.0 is explicitly frontend-first and client-side; payments/fulfillment are v4.0 | Produce the exportable order packet; defer sending to v4.0 |
| Redux / Zustand / Jotai / XState | External store / state-machine weight for one small shared core the repo already handles | `@preact/signals` (or Context) + existing `useWizard` |
| Shepherd / React Joyride / intro.js | Heavy DOM-tour libs (12–34 KB) that assume DOM-form flows and fight a canvas UI | Native Popover API + CSS Anchor Positioning + canvas-drawn cues |
| jsPDF / pdfmake | 200 KB+ bundle bloat (already rejected in base stack) | CSS `@media print` + `window.print()` |
| JSZip | Heavier/slower archiver | `fflate` (only if zipping is actually needed) |
| FileSaver.js | Redundant | Existing `URL.createObjectURL` + anchor download in `export.ts` |
| `javascript-lp-solver` / `glpk.js` (WASM) | 100 KB+ + async init to solve a 4-variable-per-color problem | Existing exact bounded search in `bagPlanner.ts` |
| EmailJS / Resend / SendGrid (client-side) | Exposes API keys; is effectively a backend service | Web Share API + `mailto` + download; real email = v4.0 |

## Integration Points (into the existing Preact + Worker architecture)

- **`@preact/signals`** — introduce a small `src/state/` (e.g. `appMode`, `activePanel`, `coachStep` signals). Components subscribe directly; the canvas host (`viewer.ts` consumer) stops re-rendering on chrome toggles. No change to the Web Worker contract.
- **Coach-marks** — new `src/features/coach/` Preact overlay component keyed off a signal; anchors to the Phase 9 HUD via CSS Anchor Positioning; in-canvas cues reuse the 2D-context patterns in `viewer.ts`/`export.ts`.
- **Order packet** — new `src/engine/orderPacket.ts` (pure, node-testable like `bagPlanner`/`projectStore`): builds `OrderPacketV1` from the current project + `planColorSupply()` output; reuses `drawCanvasOnly()`/`triggerCanvasDownload()` for the PNG and the CSS-print path for the summary. Optional `fflate` zip step lives here behind a flag.
- **Bag optimization** — no new module; refine `bagPlanner.ts` (objective tiebreak) and fix the `defaultPacketCost` tier mismatch; add a variant-integrity test in `src/engine/__tests__/`.
- **Share/export** — a thin `sharePacket()` helper (feature-detect `navigator.canShare`), falling back to the existing download + a `mailto` composer.
- **Vendor cleanup** — remove the `prodigi` entry from `VENDOR_REGISTRY` in `checkout.ts` and narrow the `'lumaprints' | 'prodigi' | 'finerworks'` union to `'lumaprints' | 'finerworks'` (touches `calculateCanvasCost` + any UI selector). Pure data/type change, no dep.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@preact/signals@^2.9.2` | `preact@^10.25` | Requires Preact ≥10.x (satisfied). Pulls `@preact/signals-core@^1.14.2`. Verify peer at install. |
| `fflate@^0.8.3` | Vite 6 / ESM | Tree-shakeable ESM; import only `zipSync`/`zip`. No transitive deps. |
| Popover API / CSS Anchor Positioning | Chrome 125+, Firefox 132+, Safari 18.2+ | Baseline 2026 (~91% traffic). Provide fallback placement for Safari 18.2–18.3 (no `@position-try` auto-flip). |
| Web Share API (files) | Modern mobile + desktop Chromium/Safari | Feature-detect `navigator.canShare({files})`; always ship the download fallback. |

## Bundle-Weight Impact Summary

- **Baseline recommendation (signals only): ~+1.6 KB** to the runtime bundle. Everything else is native or repo-existing.
- **If `fflate` is added: ~+3–5 KB** (ZIP path, tree-shaken). Optional.
- **If the zero-dep path is chosen throughout: +0 KB.** Fully consistent with the developer's lightweight/native-first preference.

## Sources

- [@preact/signals — npm](https://www.npmjs.com/package/@preact/signals) — current `2.9.2`; core `1.14.2` (HIGH)
- [preactjs/signals — GitHub](https://github.com/preactjs/signals) — fine-grained reactivity rationale (HIGH)
- [Signals — Preact Guide](https://preactjs.com/guide/v10/signals/) — Preact integration, sizing (HIGH)
- [fflate — npm](https://www.npmjs.com/package/fflate) / [101arrowz/fflate — GitHub](https://github.com/101arrowz/fflate) — `0.8.3`, 8 KB core, +3 KB ZIP (HIGH)
- [driver.js — npm](https://www.npmjs.com/package/driver.js) / [driverjs.com](https://driverjs.com/) — 1.x, ~5 KB gzip, zero-dep (MEDIUM — cited only as rejected alt)
- [React Joyride vs Shepherd vs Driver.js benchmark (2026)](https://usertourkit.com/blog/react-tour-library-benchmark-2026) — tour-lib bundle sizes (MEDIUM)
- [Using CSS anchor positioning — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using) / [Using the Popover API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using) — native coach-mark APIs (HIGH)
- [CSS Anchor Positioning in 2026 — nexgismo](https://www.nexgismo.com/blog/css-anchor-positioning-replace-javascript-tooltip-library-2026) — Baseline 2026, Chrome 125+/FF 132+/Safari 18.2+, ~91% traffic, Safari flip caveat (MEDIUM)
- Codebase: `src/engine/bagPlanner.ts`, `variants.ts`, `checkout.ts`, `export.ts`, `projectStore.ts`, `features/wizard/useWizard.ts` — existing exact bag optimizer, pricing-tier mismatch, native export patterns (HIGH)

---
*Stack research for: client-side gem-art planner — v3.0 viewport-native, two-mode milestone*
*Researched: 2026-07-12*
