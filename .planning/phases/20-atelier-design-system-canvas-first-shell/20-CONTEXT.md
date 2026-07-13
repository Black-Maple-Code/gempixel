# Phase 20: Atelier Design System & Canvas-First Shell - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 20 delivers **the visual skin + the structural shell** of the v4.0 canvas-first redesign, wrapping today's existing UI unchanged. Two halves:

1. **Atelier light design system** — the app renders in the Atelier light theme only (dark mode fully retired), from Atelier design tokens (bg `#F4F1E9`, accent green `#0E6E5C`, 8px spacing, radii/shadows) and self-hosted webfonts, with no external font request and no font-driven layout shift. (DESIGN-01, DESIGN-02)
2. **Canvas-first shell** — a horizontal 4-step bar (Upload → Refine → Supplies → Order) is the *only* navigator (no sidebars/hamburger/page-flip wizard), the flow is validation-gated, and the canvas viewer is mounted once and never remounts on step changes. The existing viewer/legend/supply UI still functions unchanged inside the new shell. (SHELL-01, SHELL-02)

This is the **strangler foundation that ships green** — presentation + navigation chrome only. The real Upload/Refine/Supplies/Order screen content lands in Phase 23; the additive engine work (density, `detectedColorCount`, `reduceToColorCount`, `quote.ts`) lands in Phase 22. The 240+ Vitest suite stays green at every commit.

**Not in this phase:** any `engine/*` signature change (Phase 22 only); the actual four-screen content/behavior (Phase 23); mobile/touch (Phase 24); deleting the legacy Step1..4 components (Phase 25 — they stay live inside the shell for now).
</domain>

<decisions>
## Implementation Decisions

### Strangler seam & step mapping (SHELL-01)
- **D-01:** Introduce a **pure `<StepBar>` + `<AtelierShell>` chrome** that App.tsx composes; App.tsx **stays the state owner** and passes `{step, canEnter, goTo}` down as props — the shell/StepBar **reads** step state, never owns it. (Chosen over in-place relabel in App.tsx and over an outer shell that mirrors the wizard index; the latter was rejected because the step index lives inside App and mirroring it forces either lifting state — breaking the state-owner rule — or duplicating it into a dual source of truth.)
- **D-02:** A single **`STEP_META` map** is the one place step labels/order are defined (`1 Upload · 2 Refine · 3 Supplies · 4 Order`), so the Phase 23 semantic remap is a data edit + a body-children swap, not another pass through the 2449-line App.tsx.
- **D-03:** The `<StepBar>` **collapses today's TWO nav surfaces into one** — the desktop footer dot-nav (~`App.tsx:1474`) and the mobile fixed bottom bar (~`App.tsx:1523`) are both deleted and replaced by the single horizontal 4-step bar. "No second navigator" (SHELL-01) is enforced structurally by there being one nav component.
- **D-04:** The existing `useWizard` state machine and its **1..4 indices are preserved unchanged** (Ingest→step1 … Export→step4), so `useWizard.test.ts` / `App.test` index + locked-Next assertions stay green. Only display labels change in Phase 20; content stays 1:1 with today's Step1Ingest/Step2Palette/Step3Canvas/Step4Export bodies rendered inside the shell.

### Dark-mode retirement (DESIGN-01)
- **D-05:** **Staged retirement — full UI-layer rip now + engine quarantine.** In the *UI/CSS/persistence* layer, delete completely: both `[data-theme="dark"]` and `[data-theme="light"]` blocks in `src/index.css` (flatten Atelier light tokens onto `:root`), the `usePersistentState('gempixel_theme', …)` hook + the DOM `[data-theme]` effect (`App.tsx:162-164`), and the toggle UI.
- **D-06:** Run a **one-time unconditional `localStorage.removeItem('gempixel_theme')` on boot** so returning users carry no dark residue (the key is permanently abandoned — no version-key machinery needed).
- **D-07:** **Engine signatures stay frozen** per the strangler rule (engine/* changes only in Phase 22). `src/engine/viewer.ts` and `src/engine/symbols.ts` keep their `theme` param **signatures unchanged**; instead **pin every call site to a literal `'light'`** and tag each with a `// PHASE 22: remove theme param` marker. The one surviving dark branch is provably unreachable-as-dark and tracked for excision in Phase 22.
- **D-08:** SC1 (no half-dark flash on reload) is satisfied **by construction** — once the `[data-theme="dark"]` rules no longer exist, a stale `data-theme` attribute mid-boot selects nothing, so no anti-FOUC head-script is needed.

### Fonts & no-CLS (DESIGN-02)
- **D-09:** **Self-host via variable `@fontsource-variable`** — add `@fontsource-variable/newsreader` (serif titles) + `@fontsource-variable/archivo` (body/UI, **replacing the current Outfit**) + `@fontsource/jetbrains-mono` (data/numbers). Delete **both** external `@import url('https://fonts.googleapis.com/...')` lines at the top of `src/index.css`. Wire the faces into the existing Tailwind v4 `@theme inline` block by overriding `--font-serif`/`--font-sans`/`--font-mono`.
- **D-10:** **Drop Pixelify Sans entirely in v4.0** — its only consumers are the product wordmark and the v5.0-deferred ops console. Render the "GemPixel" wordmark in **Newsreader 21/600** per the top-bar spec (a face already self-hosted). Pixelify Sans can be re-added under `@fontsource/pixelify-sans` when the ops console lands in v5.0.
- **D-11:** **No-CLS strategy = `font-display: swap` + auto-generated fallback metrics via the Fontaine Vite plugin** (`size-adjust`/`ascent-override`/`descent-override` injected at build time). Chosen over hand-authored metric overrides (maintenance/accuracy risk) and over `font-display: optional` (would strand first-visit users on the fallback for a display-serif wordmark/titles).

### Step-nav gating & single-mount viewer (SHELL-02, SC4)
- **D-12:** **Gating UX = visibly disabled + unclickable.** Locked/upcoming steps render `aria-disabled="true"`, are removed from the tab order, and show a short static tooltip ("Upload an image to unlock"). All four steps stay visible as a stable journey map; the current step is marked `aria-current="step"`; a locked tap never dead-ends. (Chosen over clickable-with-toast and hidden-until-eligible.)
- **D-13:** **Editing a completed step = soft-invalidate + re-run prompt.** When the user taps back and edits an upstream step (re-upload, change size), App.tsx marks downstream steps `stale` (a prop the pure children render), **keeps the last-good match/supplies on screen**, blocks advancing past a stale step, and surfaces one **"Recompute match"** CTA. No silent worker re-fire, no data loss; the expensive/abort-race-prone match runs once on an intentional click. (Chosen over auto keep-and-recompute and over hard-reset-downstream.)
- **D-14:** **Single-mount viewer = always-render at shell level + CSS-toggle the surrounding panels.** Hoist the one `<CanvasViewer>` to shell scope so it is **never inside a `{step===n && …}` branch**; render the four step panels as siblings toggled with `hidden`/`display:none`. The never-remount guarantee (SC4) falls out of tree position — zero new deps, preserves zoom/pan/LOD + in-flight worker state, tests stay green. (Portals rejected — need an always-mounted host anyway; keep-alive/freeze libs rejected — React-ecosystem compat risk under `preact/compat`, no Preact 10 `<Activity>`.)

### Claude's Discretion
- Exact Atelier token names/structure within the existing `@theme inline` block (follow the design handoff §"Design Tokens" verbatim for values; naming follows existing `src/index.css` convention).
- Component file placement for `<StepBar>` / `<AtelierShell>` (follow `src/features/` + existing convention; `src/ui/` primitives are formally Phase 21, so Phase 20 may inline minimal chrome or seed `src/ui/` pragmatically — planner's call).
- Precise `stale` flag shape and where the "Recompute match" banner mounts.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (the source of truth for look/behavior)
- `C:\Users\rickf\OneDrive\Desktop\GemPixel\GEM PIXEL design review\design_handoff_ui_redesign\README.md` — **the design contract.** Atelier tokens (colors, typography, radius/shadow, spacing), Storyboard A (customer desktop 4-step journey: A1 Upload / A2 Refine / A3 Supplies / A4 Order), the top-bar + step-nav chrome spec, and per-screen state/data shapes. (External to the repo — absolute path.)
- `…\design_handoff_ui_redesign\GemPixel Redesign.dc.html` — the high-fidelity prototype (Storyboards C, A, B). **Reference only — do NOT ship; `support.js` is a prototyping runtime, not a production dependency.** Recreate faithfully in Preact/Vite/Tailwind.
- `…\design_handoff_ui_redesign\screenshots\` — reference renders (`A1-upload.png`, `A2-refine.png`, `A3-supplies.png`, `A4-order.png` for this milestone's customer flow).

### Milestone grounding
- `.planning/research/SUMMARY.md` — v4.0 research (HIGH confidence): ~90% presentation/shell rework, engine untouched this phase; pitfalls (dark mode = persisted `gempixel_theme` + `[data-theme]`, not `dark:` classes; self-hosted `@fontsource` only; Tailwind v4 has built-in container queries — do NOT add the plugin).
- `.planning/ROADMAP.md` §"Phase 20" — goal, success criteria (SC1-5), and the strangler build constraints.
- `.planning/REQUIREMENTS.md` — DESIGN-01, DESIGN-02, SHELL-01, SHELL-02 (this phase's requirements).

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — pure-engine / thin-UI split; App.tsx as state-owning mega-component; feature-hook layer.
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md` — existing conventions the new chrome must match.

### Live code touchpoints (verify current line numbers at plan time)
- `src/index.css` — external Google-Fonts `@import` (top, to delete), `[data-theme]` dual skins (to flatten), Tailwind v4 `@theme inline` block (~L69, to extend with Atelier tokens).
- `src/App.tsx` (2449 lines) — theme hook (`:164`), desktop dot-nav (~`:1474`), mobile bottom bar (~`:1523`), conditional Step1..4 render; stays the state owner.
- `src/features/wizard/useWizard.ts` — 1..4 step state machine (`step`/`canEnter`/`goTo`); preserved unchanged.
- `src/features/wizard/steps/Step{1Ingest,2Palette,3Canvas,4Export}.tsx` — existing step bodies wrapped unchanged.
- `src/engine/viewer.ts`, `src/engine/symbols.ts` — take a `theme` param; **signatures frozen** (pin call sites to `'light'` + Phase 22 marker).
- `src/features/match/useDiamondArtMatch.ts` — owns the match pipeline; relevant to the soft-invalidate/recompute wiring (D-13) and the single-mount viewer's worker state (D-14).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useWizard` hook** — a clean 1..4 index state machine (`step`/`canEnter`/`next`/`back`/`goTo`/`reset`) already exposes exactly what the new `<StepBar>` needs; feed it as props (D-01, D-04).
- **Tailwind v4 `@theme inline` block** (`src/index.css`) — already established; Atelier tokens extend it rather than introducing a new token mechanism (carried-forward convention, not re-litigated).
- **`usePersistentState` hook** — the theme instance is being removed (D-05), but the hook itself remains in use elsewhere; only the `gempixel_theme` usage is deleted.
- **`CanvasViewer` (`engine/viewer.ts`)** — holds internal zoom/pan/LOD state expensive to rebuild and sensitive to remount (prior B2 abort-race context); hoisting it to shell scope (D-14) protects that state.

### Established Patterns
- **Pure engine / thin UI split** — engine modules avoid Preact/DOM; the strangler rule (engine signatures change only in Phase 22) is why dark-mode retirement is staged (D-07).
- **App.tsx owns all state; children are pure/props-only** — the shell/StepBar and future screens read state via props; this constraint drives D-01, D-12, D-13, D-14.
- **Defensive, non-throwing boundaries** — match/canvas/storage failures degrade rather than crash; the "Recompute match" flow (D-13) should follow the existing `actionError`/banner surfacing convention.

### Integration Points
- New `<AtelierShell>`/`<StepBar>` sit between `main.tsx`'s `<App/>` mount and the existing step bodies — App composes them, passing wizard state down.
- The single `<CanvasViewer>` moves to shell scope; the four step panels become CSS-toggled siblings (D-14).
- `localStorage` boot cleanup (`removeItem('gempixel_theme')`) hooks into App init (D-06).
</code_context>

<specifics>
## Specific Ideas

- The design handoff's guiding principle: **"the collapsed, canvas-first view is the default — you never open a side menu to find information."** The horizontal step bar is the entire navigation.
- Top-bar chrome per handoff: left = pixel-logo mark (green `#0E6E5C` tile w/ 3×3 pixel grid) + "GemPixel" (Newsreader 21/600); center = the step nav; right = "Save" pill (`#1B1A17` bg, `#F4F1E9` text). Step-nav states: completed = green filled circle + check; current = green filled circle + number + bold label; upcoming = outlined circle (`#9A927D`) + muted label at `opacity:.45`; connectors green when passed, `#D8D0BC` when ahead.
- Desktop cards are a fixed 1180px frame; card radius 12px, controls 7–8px, pills 20px; card shadow `0 40px 80px -30px rgba(0,0,0,0.5)`.
</specifics>

<deferred>
## Deferred Ideas

- **Actual Upload/Refine/Supplies/Order screen content + behavior** (size cards, edge-cleanup 4-seg, color-count slider, order packet) → **Phase 23** (keystone: Refine).
- **Additive engine work** — density helper (2.5mm/dot), `detectedColorCount`, `reduceToColorCount`, single-source `engine/quote.ts`, and removing the `viewer.ts`/`symbols.ts` `theme` param (the D-07 quarantined branch) → **Phase 22** (engine-only commits).
- **`src/ui/` shared primitives** (StepNav / SegmentedControl / Slider / SizeCard / Pill / Button as first-class components) → **Phase 21**.
- **Mobile responsive + touch** (single portrait column, pinch-zoom, `touch-action: none`) → **Phase 24**.
- **Deleting the legacy Step1..4 components, side asides, dead sidebar/preset state** → **Phase 25** (strangler close).
- **Pixelify Sans re-introduction** for the ops-console → **v5.0** (backend fulfillment milestone).

None of the above were scope creep — all are already-mapped later phases; captured here so nothing is lost.
</deferred>

---

*Phase: 20-atelier-design-system-canvas-first-shell*
*Context gathered: 2026-07-13*
