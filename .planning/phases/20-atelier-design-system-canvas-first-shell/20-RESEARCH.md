# Phase 20: Atelier Design System & Canvas-First Shell - Research

**Researched:** 2026-07-13
**Domain:** Font self-hosting + no-CLS, dark-mode retirement, single-mount viewer in an existing Preact 10 / Vite 6 / Tailwind v4 app
**Confidence:** HIGH (font wiring + versions VERIFIED against installed packages; Fontaine `resolvePath` for @fontsource is MEDIUM — needs a plan-time build spike)

> **Focused pass.** This builds on the approved `20-CONTEXT.md` (D-01..D-14) and `20-UI-SPEC.md`, and on milestone `SUMMARY.md` / `PITFALLS.md` (esp. Pitfall 9 dark-mode, Pitfall 13 fonts, Pitfall 2 viewer). It does **not** re-litigate locked decisions or re-derive architecture. It closes the "how exactly" gaps: exact font imports/versions, the Fontaine wiring, the dark-mode boot mechanics, and the CSS-toggle viewer pattern.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim, abridged to this phase's relevance)
- **D-05:** Full UI-layer rip of dark mode now + engine quarantine. Delete both `[data-theme="dark"]` and `[data-theme="light"]` blocks in `src/index.css` (flatten Atelier light tokens onto `:root`), delete the `usePersistentState('gempixel_theme', …)` hook + the DOM `[data-theme]` effect (`App.tsx:162-168`), and the toggle UI (`App.tsx:1439-1449`).
- **D-06:** One-time unconditional `localStorage.removeItem('gempixel_theme')` on boot; key permanently abandoned.
- **D-07:** Engine signatures frozen (engine changes in Phase 22). Pin theme call sites to literal `'light'` + `// PHASE 22: remove theme param` markers.
- **D-08:** SC1 (no half-dark flash) satisfied by construction — once `[data-theme="dark"]` rules are gone, a stale `data-theme` selects nothing; no anti-FOUC script needed.
- **D-09:** Self-host via variable `@fontsource-variable/newsreader` (serif titles) + `@fontsource-variable/archivo` (body/UI, replacing Outfit) + `@fontsource/jetbrains-mono` (data). Delete both external Google-Fonts `@import` lines. Override `--font-serif`/`--font-sans`/`--font-mono` in the existing `@theme inline` block.
- **D-10:** Drop Pixelify Sans entirely; wordmark renders in Newsreader 21/600.
- **D-11:** No-CLS = `font-display: swap` + auto-generated fallback metrics via the **Fontaine Vite plugin**.
- **D-14:** Single-mount viewer = always-render `<CanvasViewer>` at shell scope + CSS-toggle sibling step panels with `hidden`/`display:none`.

### Claude's Discretion
- Exact Atelier token names within `@theme inline` (values follow the design handoff verbatim; naming follows existing `src/index.css`).
- Component file placement for `<StepBar>` / `<AtelierShell>`.
- Precise `stale` flag shape and where the "Recompute match" banner mounts.

### Deferred Ideas (OUT OF SCOPE)
- Actual four-screen content/behavior → Phase 23. Additive engine work + removing the `theme` param → Phase 22. `src/ui/` primitives → Phase 21. Mobile/touch → Phase 24. Deleting legacy Step1..4 → Phase 25. Pixelify Sans re-intro → v5.0.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DESIGN-01 | Atelier light theme only; dark mode retired | §3 Dark-mode retirement mechanics — flatten to `:root`, delete `index.html` boot script (new finding), stale-attribute-selects-nothing confirmed under Tailwind v4 |
| DESIGN-02 | Self-hosted fonts, no external request, no font-driven layout shift (SC2) | §1 Font self-hosting (exact imports/versions/`@theme` overrides) + §2 Fontaine no-CLS wiring |
| SHELL-01 | Horizontal 4-step bar is the only navigator | Covered by CONTEXT D-01..D-04; no residual research gap (chrome-only, hand-built) |
| SHELL-02 | Validation-gated flow + single-mount viewer (SC4) | §4 Single-mount viewer + CSS-toggle panels; canvas-while-`display:none` measurement gotcha flagged |
</phase_requirements>

## Summary

The locked decisions are sound and current. The three `@fontsource` packages exist at the pinned versions, already ship `font-display: swap`, and expose lean weight-axis-only CSS entrypoints that make SC2 achievable with three tiny woff2 subsets. Fontaine (`fontaine@0.8.0`, published 2026-01-14) is actively maintained and remains the right tool for D-11 — **do not** switch to hand-authored `size-adjust`.

Two concrete gaps the CONTEXT touchpoint list missed, both load-bearing for SC1/SC2:

1. **`index.html` is the real dark-mode resurrection vector**, not just `App.tsx`. Line 2 hard-codes `<html … data-theme="light">` and lines 7-15 are an **inline anti-FOUC boot script** that reads `localStorage.getItem('gempixel_theme')` and sets `data-theme="dark"` for returning dark users *before Preact mounts*. D-05's touchpoint list (index.css + App.tsx) does not mention this file. It must be edited in this phase or a returning dark user still gets `data-theme="dark"` stamped on `<html>` every reload (harmless only *after* the `[data-theme="dark"]` CSS is deleted, but it should go regardless — and D-06's `removeItem` should be reconciled with it).

2. **`'Outfit'` is hard-coded as the canvas symbol font in three engine spots** (`viewer.ts:392`, `export.ts:85`, `export.ts:173`). Deleting the Outfit `@import` (D-09) orphans these to a system-sans fallback. This is a string-literal change (not an engine *signature* change, so D-07 is not violated) — the planner must decide: repoint to `'Archivo Variable'` or accept the fallback. Pitfall 13 already flagged this.

**Primary recommendation:** Import the three `@fontsource` CSS entrypoints via **JS import in `src/main.tsx`** (not a CSS `@import` inside `index.css`) to sidestep the historical Tailwind-v4 external-URL-resolution bug, add Fontaine to `vite.config.ts` with a `node_modules`-aware `resolvePath`, and **manually append the Fontaine fallback family** (`'<Family> fallback'`) inside the `--font-serif`/`--font-sans`/`--font-mono` values because Fontaine does not auto-rewrite font names declared in CSS variables. Verify the emitted CSS + Network tab in a build spike before calling SC2 done.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Font faces + subsetting | Build (Vite asset pipeline) | Browser (unicode-range subset fetch) | @fontsource woff2 emitted/fingerprinted at build; browser fetches only the latin subset at runtime |
| Fallback metric overrides (no-CLS) | Build (Fontaine Vite transform) | Browser (renders fallback then swaps) | Capsize metrics injected as pure CSS `@font-face` at build; zero runtime JS |
| Theme tokens | Browser (CSS `:root` custom props) | Build (Tailwind v4 `@theme` → utilities) | Flattened onto `:root`; Tailwind generates `font-*`/color utilities from the vars |
| Dark-mode retirement | Browser (CSS + `index.html` boot) | Client (App boot `removeItem`) | The resurrection vector is the inline boot script in `index.html`, not runtime state |
| Single-mount viewer + panel toggle | Client (Preact tree position) | Browser (CSS `display:none`) | Never-remount guarantee falls out of hoisting the viewer above the `{step===n}` branch |

## Standard Stack

### Core (new runtime deps — the ONLY additions this phase)
| Package | Version | Purpose | Entrypoint to import |
|---------|---------|---------|----------------------|
| `@fontsource-variable/newsreader` | `5.2.10` | Serif titles + "GemPixel" wordmark | `@fontsource-variable/newsreader/wght.css` |
| `@fontsource-variable/archivo` | `5.2.8` | Body/UI text (replaces Outfit) | `@fontsource-variable/archivo/wght.css` |
| `@fontsource/jetbrains-mono` | `5.2.8` | Data / DMC codes / counts | `@fontsource/jetbrains-mono/400.css` + `/700.css` |

### Build (new devDependency)
| Package | Version | Purpose |
|---------|---------|---------|
| `fontaine` | `0.8.0` | Auto-generate fallback `@font-face` with `size-adjust`/`ascent-override`/`descent-override` (Capsize metrics) → no-CLS |

**Installation:**
```bash
npm install @fontsource-variable/newsreader@5.2.10 @fontsource-variable/archivo@5.2.8 @fontsource/jetbrains-mono@5.2.8
npm install -D fontaine@0.8.0
```

**Verified against installed packages (npm, 2026-07-13):** family names and `font-display` read directly from the installed CSS — `'Newsreader Variable'` (wght axis `200 800`), `'Archivo Variable'` (wght axis `100 900`), `'JetBrains Mono'` (static, per-weight). All three ship `font-display: swap` baked in — D-11's swap requirement is already satisfied by the packages; nothing to add there. [VERIFIED: npm registry + installed package CSS]

**Why the lean entrypoints:** importing a package root (`@fontsource-variable/newsreader`) pulls every axis + italic + all language subsets. `wght.css` exposes only the weight axis (normal, non-italic) across the vietnamese/latin-ext/latin subsets = **3 woff2 emitted, 1 (latin) fetched at runtime** for an English UI. JetBrains Mono is *not* variable, so import only the weights used: `400` (labels/body data) and `700` (the documented DMC-code/bag-count emphasis in 20-UI-SPEC §Typography). [VERIFIED: installed package `wght.css` / `400.css`]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fontaine (D-11) | Hand-authored `@font-face` fallback with `size-adjust` | Rejected by D-11 (maintenance/accuracy). Fontaine is maintained (0.8.0, 2026-01) — **stay on D-11.** Only fall back to hand-authored metrics if a build spike proves Fontaine can't resolve the @fontsource woff2. |
| `wght.css` (weight axis) | `opsz.css` (adds optical-size axis) for Newsreader | Newsreader is an optical-size design; `opsz.css` improves large-title rendering but adds a second axis dimension per subset. Optional polish — `wght.css` is the lean default and meets the spec weights (400/600). |
| JS import in `main.tsx` | CSS `@import '@fontsource-…/wght.css'` in `index.css` | CSS `@import` routes woff2 URL resolution through the Tailwind v4 Vite plugin, which historically failed to resolve external-package font URLs (issue #16700). JS import uses Vite's own asset graph — more robust. |

## Package Legitimacy Audit

| Package | Registry | Age | Source | Verdict | Disposition |
|---------|----------|-----|--------|---------|-------------|
| `@fontsource-variable/newsreader` | npm | 5.2.10, pub 2025-09-17 | fontsource.org (official self-host project) | OK | Approved |
| `@fontsource-variable/archivo` | npm | 5.2.8, pub 2025-09-17 | fontsource.org | OK | Approved |
| `@fontsource/jetbrains-mono` | npm | 5.2.8, pub 2025-09-17 | fontsource.org | OK | Approved |
| `fontaine` | npm | 0.8.0, pub 2026-01-14 | github.com/unjs/fontaine (UnJS, Nuxt ecosystem) | OK | Approved |

**Removed [SLOP]:** none. **Flagged [SUS]:** none. All four are established, widely-used, and named directly in the locked CONTEXT decisions; versions confirmed via `npm view` and package contents inspected locally. [VERIFIED: npm registry + official docs fontsource.org / unjs.io]

---

## 1. Font self-hosting (D-09/D-10, DESIGN-02, SC2)

### 1a. Import the faces (JS import in `main.tsx`)

Add above the existing `import './index.css'` in `src/main.tsx`:

```ts
import '@fontsource-variable/newsreader/wght.css';  // 'Newsreader Variable', wght 200–800
import '@fontsource-variable/archivo/wght.css';     // 'Archivo Variable',   wght 100–900
import '@fontsource/jetbrains-mono/400.css';        // 'JetBrains Mono' 400
import '@fontsource/jetbrains-mono/700.css';        // 'JetBrains Mono' 700 (DMC/bag emphasis)
import './index.css';
```

Rationale: Vite resolves these CSS modules and their `url(./files/*.woff2)` through its asset pipeline (hashed, emitted, no external request). Keeping them out of `index.css`'s `@import` chain avoids the Tailwind-v4 plugin URL-resolution path (see §2 gotcha). [VERIFIED: installed package structure] [CITED: fontsource.org Vite guide]

### 1b. Delete external requests + retire Pixelify (`src/index.css`)

- Delete **both** lines 1-2 (`@import url('https://fonts.googleapis.com/…Outfit…')` and `@import url('…Newsreader…')`). This is the SC2 "no external font request" gate.
- Remove the `--font-display: 'Pixelify Sans', …` (dark block, line 25) and the light `--font-display: 'Newsreader', serif` (line 47) as part of the `[data-theme]` flatten (§3); redefine `--font-display` once on `:root` as `'Newsreader Variable'` (wordmark uses Newsreader per D-10).

### 1c. Override `--font-*` inside the existing `@theme inline` block

The app's `@theme inline` block (`src/index.css:69`) currently only defines `--font-display`. Tailwind v4's `font-sans`/`font-serif`/`font-mono` utilities are backed by the theme vars `--font-sans`/`--font-serif`/`--font-mono`. Add these three inside the block (values include the Fontaine fallback family — see §2):

```css
@theme inline {
  /* … existing color/neutral/accent remaps … */
  --font-serif:   'Newsreader Variable', 'Newsreader Variable fallback', ui-serif, Georgia, serif;
  --font-sans:    'Archivo Variable',    'Archivo Variable fallback',    ui-sans-serif, system-ui, sans-serif;
  --font-mono:    'JetBrains Mono',      'JetBrains Mono fallback',      ui-monospace, monospace;
  --font-display: var(--font-serif);     /* wordmark + titles = Newsreader (D-10) */
}
```

Then reconcile the hard-coded families in `@layer base` (`src/index.css`):
- Line 136 `font-family: 'Outfit', sans-serif;` on `body` → `font-family: var(--font-sans);` (Archivo now owns body/UI, D-09). [CITED: existing src/index.css:131-142]
- Lines 139-141 `code, pre, .font-mono { font-family: 'JetBrains Mono' !important; }` — the literal already matches the new package family name; append the fallback: `'JetBrains Mono', 'JetBrains Mono fallback', monospace`.

**Note on `@theme inline`:** `inline` inlines the token *value* into generated utilities (rather than emitting a `var()` reference). That is the correct mode here — the font stacks are static strings, so utilities like `font-sans` get the full stack (incl. fallback family) literally. No behavioral risk vs. the existing block, which already uses `inline`. [VERIFIED: existing @theme inline block, src/index.css:69]

**Confidence:** HIGH for imports, versions, family names, `@theme` override. The `'… fallback'` family name in §1c depends on Fontaine's default naming (see §2) — MEDIUM until confirmed from build output.

---

## 2. No-CLS via Fontaine (D-11, SC2)

### 2a. `vite.config.ts` wiring

Fontaine ships a Vite transform. Current maintained package is `fontaine` (the UnJS repo also publishes `@nuxtjs/fontaine` for Nuxt — **not** what we want; use the plain `fontaine` Vite plugin). [CITED: unjs.io/packages/fontaine]

```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { FontaineTransform } from 'fontaine';

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    FontaineTransform.vite({
      // System fonts used to synthesize the metric-adjusted fallback face.
      fallbacks: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial'],
      // Fontaine must read the actual woff2 to compute Capsize metrics.
      // @fontsource emits url(./files/*.woff2); map that id into node_modules.
      resolvePath: (id) =>
        new URL(`../node_modules/@fontsource${id}`, import.meta.url),
    }),
  ],
  test: { /* unchanged */ },
  resolve: { alias: { '@': '/src' } },
});
```

**⚠️ `resolvePath` is the one thing to verify in a build spike (MEDIUM).** Fontaine passes the raw `url(...)` string from each `@font-face`; for @fontsource that is `./files/<name>.woff2` (relative to the package CSS). The exact filesystem mapping depends on how the id string appears after Vite processes the import — it may arrive as `./files/...`, `/node_modules/@fontsource-variable/newsreader/files/...`, or a resolved absolute path. Confirm empirically: build, then inspect for injected fallback `@font-face` rules with `size-adjust`/`ascent-override`/`descent-override`. If Fontaine logs "could not resolve" warnings, adjust `resolvePath` to reconstruct the node_modules path from the id. This is the known friction point in every @fontsource+Fontaine writeup. [CITED: aaronjbecker.com "Fontsource, Fontaine, Tailwind and Vite"; unjs/fontaine README `resolvePath`]

### 2b. The CSS-variable gotcha (load-bearing for this Tailwind-v4 setup)

Fontaine auto-generates a fallback face named **`'<Family> fallback'`** (e.g. `'Newsreader Variable fallback'`) and rewrites `font-family:` *declarations* it finds in CSS to append it. **But it does not rewrite font names declared inside CSS custom properties / `@theme` variables.** Because Atelier wires fonts through `--font-serif`/`--font-sans`/`--font-mono` (not direct `font-family` rules), you must **manually append the fallback family** in each variable value — which §1c already does. Miss this and Fontaine generates the corrected fallback face but nothing references it → CLS is not actually prevented. [CITED: unjs/fontaine README "when using CSS variables… append the fallback name suffix"]

Confirm the exact generated name from build output; if Fontaine's default differs, set it explicitly via the `overrideName`/`fallbackName` option and match it in the `--font-*` values.

### 2c. Interaction notes / gotchas
- **`font-display: swap` is already in the @fontsource faces** — Fontaine's job is only the metric-matched fallback so the *swap* doesn't shift layout. The two are complementary; no `font-display` change needed. [VERIFIED: installed CSS]
- **Variable fonts:** Fontaine computes metrics from the woff2 file regardless of variable/static; `format('woff2-variations')` faces are supported. No special option. (LOW-risk; verify in the same spike.)
- **Tailwind v4:** Fontaine only injects fallback faces for families it finds in a real `@font-face` (the @fontsource CSS) — it does **not** read Tailwind config. Since faces come from @fontsource (real `@font-face`), this is satisfied; the only manual step is the variable-value append (§2b). [CITED: aaronjbecker.com]
- **Tailwind v4 external-URL bug context (#16700):** fixed via PR #18321 (merged 2025-07-30) which added an opt-out for the PostCSS url-rewriter. Recommending the JS-import path (§1a) avoids depending on that fix entirely. [VERIFIED: gh issue 16700 CLOSED/COMPLETED, PR 18321 MERGED]

**Alternative (only if the spike fails):** hand-author one fallback `@font-face` per family using Capsize/`fontpie`-computed `size-adjust`/`ascent-override`/`descent-override`, named `'<Family> fallback'`, and keep the same `--font-*` stacks. This is D-11's rejected path — use only as a documented fallback if Fontaine can't resolve the woff2.

---

## 3. Dark-mode retirement mechanics (D-05..D-08)

### 3a. The flatten holds under Tailwind v4 — confirmed
The `[data-theme]` mechanism is plain CSS custom-property scoping, independent of Tailwind. `@theme inline` reads whatever `--bg`/`--accent`/etc. resolve to on `:root`; flattening the light values onto `:root` (deleting both `[data-theme]` blocks, `src/index.css:10-53`) makes the token vars unconditional. Tailwind utilities and the neutral/accent scale remaps (`src/index.css:93-128`) keep working unchanged because they reference the same `var(--…)` names. **No `@layer`/`@theme` conflict** — this is a value-source change, not a selector-specificity change. [VERIFIED: src/index.css structure]

### 3b. Stale-attribute-selects-nothing (D-08 / SC1) — confirmed, with a caveat
Once `[data-theme="dark"]` rule blocks no longer exist, a `data-theme="dark"` attribute on `<html>` matches no selector → `:root` (light) values apply. D-08's "by construction" reasoning is correct **provided** the deletion is complete. The caveat: something still *sets* `data-theme="dark"`, and that something is not in the CONTEXT touchpoint list — see 3c.

### 3c. NEW FINDING — `index.html` is the actual resurrection vector (must edit this phase)
`index.html` (not listed in CONTEXT's "Live code touchpoints") contains:
- Line 2: `<html lang="en" data-theme="light">` — hard-coded attribute.
- Lines 7-15: an **inline anti-FOUC boot script** that runs *before Preact mounts*:
  ```js
  var t = localStorage.getItem('gempixel_theme');
  document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light';
  ```
  For a returning user with `gempixel_theme:'dark'`, this stamps `data-theme="dark"` on every reload.

**Action:** Delete the inline boot script (lines 7-15) and simplify line 2 to `<html lang="en">` (or leave `data-theme="light"` — harmless once dark CSS is gone, but the script must go). After the `[data-theme="dark"]` CSS is deleted this is *safe* even if left, but leaving a dead script that reads an abandoned key is exactly the "looks retired but isn't" trap (Pitfall 9). This is the single most important non-obvious edit in the dark-mode rip.

### 3d. `removeItem` ordering (D-06) — clarified
The `index.html` script runs first, then `main.tsx`/`App`. If the boot script is **deleted** (3c), nothing reads `gempixel_theme` anywhere, so `App`'s `localStorage.removeItem('gempixel_theme')` is pure hygiene with **no ordering dependency** — it can run anywhere in App init (or even in `main.tsx`). If for any reason the boot script were kept, `removeItem` would only take effect on the *next* reload (the script already read the key this load), which is another reason to delete the script rather than rely on `removeItem`. Recommend: delete script **and** call `removeItem` once at boot.

### 3e. Viewer theme effect (D-07) — the real mechanism
The theme→canvas path is **not** a `theme` param on `viewer.ts`. `App.tsx:557-562` reads the CSS vars `--drill-round-backing` / `--canvas-gap` via `getComputedStyle` and pushes them with `viewer.setRoundBacking()` / `setGridGap()`. After the flatten, `:root` always yields the light values, so:
- Keep the effect; **drop `theme` from its dependency array** (`App.tsx:562`) — `theme` no longer exists.
- The `viewer.ts` / `symbols.ts` *signatures* are genuinely untouched (they never took a `theme` param — they take hex strings / allocation inputs), so D-07's "signatures frozen" is trivially satisfied. The `// PHASE 22` marker belongs on this effect and on the `'Outfit'` literals (§0 finding), not on an engine signature.

---

## 4. Single-mount viewer + CSS-toggle panels (D-14, SC4)

### 4a. Pattern preserves canvas + worker state — confirmed
Hoisting the single `<CanvasViewer>` host above the `{step===n && …}` branch and toggling sibling panels with `hidden` / `display:none` keeps the canvas element and its `CanvasViewer` instance mounted continuously. Preact never unmounts a node that stays in the tree; `display:none` is a style change, not a reconciliation removal. Therefore:
- The `CanvasViewer` class instance (zoom/pan/LOD/offscreen buffer) survives step changes — no `destroy()`/re-`new` (avoids Pitfall 2). [VERIFIED: viewer wiring App.tsx:517-562]
- In-flight Web Worker state in `useDiamondArtMatch` is owned by App (the persistent state owner), not by any step panel, so panel toggling never touches the worker. Under `preact/compat` this is standard Preact behavior — no keep-alive/freeze lib needed (D-14 rejected those correctly). [VERIFIED: CONTEXT D-14 + match hook ownership]

### 4b. Canvas-sizing-while-`display:none` gotcha (flag for planner)
The one real risk: an element with `display:none` reports `clientWidth/clientHeight = 0` and `getBoundingClientRect()` all-zero. If the `<CanvasViewer>` host (or a `ResizeObserver`/fit-to-container measure) is ever inside a panel that is `display:none` when it initializes or re-measures, it will size the canvas to 0×0 and the chart disappears or renders wrong on reveal. Mitigations:
- **Keep the viewer host itself always visible** (it lives at shell scope per D-14, so it is never the hidden sibling — this is exactly why D-14 works). Only the *surrounding step panels* toggle, not the canvas host.
- If any step panel contains a secondary measured element (e.g. a mini-preview), prefer `visibility:hidden`/off-screen positioning over `display:none` for that measured node, or re-fit on reveal via the existing `getViewportState`/fit path.
- Add/keep an assertion that switching steps calls `draw()` only (not `redrawOffscreen()`), locking the <1ms toggle invariant (Pitfall 2). [CITED: milestone PITFALLS.md Pitfall 2]

`hidden` attribute vs `display:none`: the HTML `hidden` attribute applies `display:none` by default, so both behave identically for measurement. Either is fine; `hidden` is marginally more semantic/a11y-friendly (also removes the subtree from the accessibility tree). Note Tailwind's `hidden` utility == `display:none`.

---

## 5. Testing notes (Nyquist validation disabled — short form)

No full `## Validation Architecture` section (nyquist off for this run). The 240+ Vitest suite (jsdom) must stay green (SC5); this is a refactor, so the protective tests fall into four buckets the planner should lift into verification criteria:

- **Theme / token assertions (DESIGN-01, SC1):** a test that `gempixel_theme` is removed from localStorage on boot; that no `[data-theme="dark"]` selector remains in `index.css` (string assertion); that the `index.html` boot script is gone; that a `data-theme="dark"` attribute on `<html>` yields the light `--bg` computed value. Guards Pitfall 9.
- **Font wiring (DESIGN-02, SC2):** assert `index.css` contains **no** `fonts.googleapis.com` `@import` (SC2 gate); optionally a build-artifact check that no external font URL is referenced. CLS itself is not unit-testable in jsdom — verify via a manual build spike (Network tab + emitted CSS shows Fontaine fallback faces). Keep the existing `useWizard.test.ts` / `App.test` green (D-04 preserves 1..4 indices + locked-Next).
- **Step-nav a11y / tab-order (SHELL-01/02, D-12):** locked steps render `aria-disabled="true"` and are out of tab order; current step has `aria-current="step"`; a locked tap does not navigate. New `<StepBar>` unit tests.
- **Single-mount identity (SC4, D-14):** assert the `CanvasViewer` instance is created once and not re-instantiated across step changes (mock/spy on the constructor or `destroy`); assert step toggle does not remount the canvas node. Guards Pitfall 2.

Because the engine is untouched (D-07), no engine test should change — a red engine test signals an accidental engine diff (the strangler tripwire).

## Common Pitfalls (phase-specific, building on milestone PITFALLS.md)

### Pitfall A: Fontaine generates fallback faces but nothing uses them
**What goes wrong:** metrics faces exist in the build but `--font-*` values omit `'… fallback'`, so CLS persists despite Fontaine being "installed."
**Avoid:** manually append the fallback family in each `--font-*` value (§1c/§2b); verify the emitted name matches.
**Warning sign:** layout still shifts ~100ms after load on titles/mono columns; DevTools shows the real font applied directly with no fallback family in the cascade.

### Pitfall B: `resolvePath` can't find the @fontsource woff2
**What goes wrong:** Fontaine logs resolve warnings, emits no metric override, silent no-CLS failure.
**Avoid:** build spike to confirm the id string shape and adjust `resolvePath` into node_modules; check for injected `@font-face … fallback` with `size-adjust`.
**Warning sign:** build-time "could not resolve" from fontaine; no `ascent-override` in output CSS.

### Pitfall C: Dark mode "retired" but `index.html` boot script left in place
Covered in §3c — the top find. Grep `index.html` and `src/**` for `gempixel_theme` and `data-theme`; both should be absent after the phase (except a possibly-harmless static `data-theme="light"` you may also remove).

### Pitfall D: Canvas symbol font silently falls back after Outfit removal
`viewer.ts:392`, `export.ts:85`, `export.ts:173` render symbols in `'Outfit'`. Decide: repoint to `'Archivo Variable'` (keeps a loaded font) or accept system-sans. Either way, tag with `// PHASE 22` if deferring and confirm export/print snapshot tests still pass. [VERIFIED: grep of src/]

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Google Fonts `@import url(...)` (current `index.css:1-2`) | Self-hosted `@fontsource` via JS import | No external request (privacy, SC2), Vite fingerprinting, offline-capable |
| `font-display: swap` alone (FOUT + shift) | swap + Fontaine Capsize metric fallback | No layout shift on swap (SC2) |
| Inline anti-FOUC theme boot script | No script; single `:root` light theme | No half-dark flash by construction (SC1); less boot JS |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fontaine's default fallback family name is `'<Family> fallback'` | §1c, §2b | If the name differs, the `--font-*` fallback reference misses → CLS not prevented. Mitigation: read the emitted name from build output, set `overrideName` explicitly. |
| A2 | `resolvePath: (id) => new URL('../node_modules/@fontsource'+id, import.meta.url)` resolves the @fontsource woff2 | §2a | If the id shape differs, Fontaine can't compute metrics. Mitigation: build spike to confirm/adjust (explicitly flagged MEDIUM). |
| A3 | JS-importing `wght.css` (not the package root) is enough for the weights the design uses (400/600 serif+sans, 400/700 mono) | §1a | If a heavier/optical weight is needed later, add the axis/weight file. Low risk — spec only uses 400/600/700. |

## Open Questions (RESOLVED)

1. **Canvas symbol font after Outfit removal** — repoint `'Outfit'`→`'Archivo Variable'` in the 3 engine literals, or accept system fallback? Recommend repoint (one-line, keeps a loaded font, not a signature change so D-07-safe). Planner/discuss call. — **RESOLVED:** repoint to `'Archivo Variable'`, adopted by Plan 20-01 T3 (D-07-safe string-literal edit).
2. **Newsreader `wght.css` vs `opsz.css`** — optical sizing improves the large display serif titles. Recommend `wght.css` for lean SC2; revisit only if titles look off at 34px. — **RESOLVED:** `wght.css`, adopted by Plan 20-01 T1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm registry (install) | new deps | ✓ | — | — |
| Node/Vite 6 build | Fontaine transform + font emit | ✓ | vite ^6.0.7 | — |

No missing dependencies. All four packages install cleanly and were inspected locally.

## Sources

### Primary (HIGH confidence)
- Installed package CSS — `@fontsource-variable/newsreader@5.2.10`, `@fontsource-variable/archivo@5.2.8`, `@fontsource/jetbrains-mono@5.2.8`: family names, `font-display: swap`, wght axes, `src url()` format (direct file read).
- `npm view` (2026-07-13) — pinned versions + publish dates for all four packages incl. `fontaine@0.8.0`.
- Existing codebase — `src/index.css` (Google-Fonts imports, `[data-theme]` blocks, `@theme inline`), `index.html` (hard-coded `data-theme` + boot script), `src/App.tsx:162-168/556-562/1439-1449` (theme hook/effect/toggle), `src/engine/viewer.ts:392` + `src/engine/export.ts:85,173` (`'Outfit'` symbol font).
- `gh` — Tailwind issue #16700 (CLOSED/COMPLETED) + PR #18321 (MERGED 2025-07-30).
- `.planning/research/SUMMARY.md`, `PITFALLS.md` (Pitfalls 2, 9, 13) — milestone grounding.

### Secondary (MEDIUM confidence)
- fontsource.org — Vite self-host guide (import CSS entrypoints).
- github.com/unjs/fontaine README + unjs.io/packages/fontaine — `FontaineTransform.vite` options (`fallbacks`, `resolvePath`, `overrideName`/`fallbackName`, `sourcemap`, `skipFontFaceGeneration`), CSS-variable fallback-name caveat.
- aaronjbecker.com "Fontsource, Fontaine, Tailwind and Vite" — the `resolvePath`-into-node_modules pattern (fetch blocked 403/401; corroborated via search excerpts, hence A2 flagged MEDIUM).

## Metadata

**Confidence breakdown:**
- Font imports / versions / family names / `@theme` override — HIGH (read from installed packages).
- Fontaine `vite.config` wiring — MEDIUM (`resolvePath` + fallback-name need a build spike; A1/A2).
- Dark-mode mechanics (flatten, `index.html` boot script, effect deps) — HIGH (read from source).
- Single-mount viewer + `display:none` gotcha — HIGH (Preact semantics + existing viewer wiring).

**Research date:** 2026-07-13
**Valid until:** ~2026-08-13 (font packages stable; re-check `fontaine` before use — 0.x, moves faster).
