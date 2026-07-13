# Stack Research — v4.0 Canvas-First Redesign (Atelier)

**Domain:** Client-side Preact + Vite + Tailwind v4 UI redesign (Atelier design system) — GemPixel v4.0
**Researched:** 2026-07-13
**Confidence:** HIGH

> **Scope of this document.** Subsequent-milestone stack review for a full customer-facing UI/UX
> redesign recreated in the *existing* codebase. The validated base stack (Preact 10, Vite 6,
> TypeScript strict, Tailwind v4, `culori`, native Web Worker, `safeStorage`/`usePersistentState`,
> canonical `money.ts`, `planOrderSupply`, Canvas 2D `viewer.ts`) is **fixed and NOT re-researched**.
> Everything below concerns only the *new* frontend needs of the Atelier redesign and answers one
> question per capability: **add a dependency, or stay browser-native/hand-built?**

## TL;DR (the headline for scoping)

**Almost nothing new is needed at runtime.** The redesign is a re-skin + re-layout of the existing app. The only genuinely new dependencies are **three (optionally four) self-hosted webfont packages** (`@fontsource-variable/*`) that *replace* the current external Google Fonts `@import` — a net privacy/perf win with zero JS. Everything else in the design contract — 4-segment segmented control, color-count slider, pills/chips, the 4-step nav, portrait/mobile layout, PNG proof export — is built with primitives already in the stack: Tailwind utilities, a native `<input type="range">`, small Preact components, Tailwind v4's **built-in** container queries, and native `canvas.toBlob`. This is exactly consistent with the project's documented avoidance of heavy UI/font/util libs.

## Recommended Stack

### Core Technologies (already in place — NO change)

| Technology | Version | Purpose | Why keep as-is |
|------------|---------|---------|-----------------|
| Preact | `^10.25.0` (current) | View layer for the 4-step flow, refine rail, tables | Design is DOM-light (chart is Canvas); ~4KB VDOM is the deliberate choice. Redesign adds no need for React. |
| Vite | `^6.0.7` (current) | Bundler / dev server / Web Worker + asset bundling | Bundles + fingerprints `@fontsource` woff2 automatically; no font plugin needed. |
| TypeScript | `^5.3.3` (current, strict) | Typing new UI state (size, cleanup level, color-count, detected palette) | Unchanged. |
| Tailwind CSS | `^4.0.0` → resolves to **4.3.2** | Atelier tokens (CSS-first `@theme`), all layout, **container queries** | v4's `@theme` already drives the current skin system; container queries are core in v4. |
| `@tailwindcss/vite` | `^4.0.0` → **4.3.2** | Tailwind's Vite integration | Already wired in `vite.config.ts`. |
| culori / Web Worker / Canvas 2D / `money.ts` / `planOrderSupply` | current | Color science, matching, chart render, pricing | Untouched by a UI redesign. |

### Supporting Libraries (the ONLY new additions — webfonts)

Self-host the Atelier typefaces via Fontsource, **replacing** the two external `@import url('https://fonts.googleapis.com/...')` lines at the top of `src/index.css`. All four are variable fonts, so one small woff2 per family covers every weight the design uses (400–700).

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fontsource-variable/newsreader` | `5.2.10` | Display / titles + customer wordmark (serif, wght 400–700; opsz axis) | **Required** — every customer screen title + "GemPixel" wordmark. |
| `@fontsource-variable/archivo` | `5.2.8` | Body / UI sans-serif | **Required** — replaces the current `Outfit` body font. |
| `@fontsource-variable/jetbrains-mono` | `5.2.8` | Data / numbers / uppercase micro-labels (mono) | **Required** — DMC codes, drill counts, micro-labels. |
| `@fontsource-variable/pixelify-sans` | `5.2.7` | Pixel wordmark / ops-console headings | **OPTIONAL / likely defer** — see scope note below. |

**Pixelify Sans scope note:** the customer top-bar wordmark renders "GemPixel" in **Newsreader 21/600** (handoff A1), and Pixelify's real home — the ops console — is **Storyboard C, deferred to v5.0**. So Pixelify Sans is probably **not needed in v4.0**. Add it only if a customer screen actually renders text in it; otherwise omit and save the bytes.

**Integration (single, well-trodden pattern):**
1. In `src/index.css`, delete the two Google-Fonts `@import url(...)` lines (currently lines 1–2).
2. Import the woff2 CSS — either `@import '@fontsource-variable/archivo';` in the CSS entry, or `import '@fontsource-variable/archivo';` in `src/main.tsx`. Fontsource ships the `@font-face` + hashed woff2; Vite bundles/fingerprints them (no external runtime requests — aligns with the privacy-first ethos).
3. Keep the existing `--font-*` token wiring; point body `font-family` → `'Archivo'`, `--font-display` → `'Newsreader'`, mono → `'JetBrains Mono'`.

- **Newsreader multi-axis:** it has two axes (`opsz`, `wght`). The default import provides `wght` (sufficient). For true optical sizing, also import the `opsz` axis file and set `font-optical-sizing: auto;` — nice-to-have, not required.
- **Dependency placement:** list under `dependencies` (they're `import`ed by app source and bundled). No runtime/functional difference here (no server), but it matches import semantics.

### Development Tools (no new ones)

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest `^3.0.0` (node env) | Existing suite (246 tests) | Redesign is presentational. New UI *logic* (color-count max = detected count, size→inches mapping, quote math) is testable as pure functions without DOM. |
| `tsc` | Typecheck in `npm run build` | Unchanged. |

## Installation

```bash
# The ONLY new install for v4.0 — self-hosted Atelier fonts (replaces external Google Fonts):
npm install @fontsource-variable/newsreader@5.2.10 \
            @fontsource-variable/archivo@5.2.8 \
            @fontsource-variable/jetbrains-mono@5.2.8

# Optional — only if a customer screen actually renders Pixelify Sans (else defer to v5.0 ops console):
npm install @fontsource-variable/pixelify-sans@5.2.7

# Nothing else. No UI kit, no slider lib, no font-loader plugin, no container-query plugin, no PNG-export lib.
```

## The design-contract capabilities — build vs. buy

Every interactive primitive the handoff calls for is browser-native or a few lines of Preact + Tailwind. Confirmed viable; the bundle cost of the rejected "buy" option is listed to justify building.

| Capability (design ref) | Recommendation | How | Cost of NOT building (rejected lib) |
|---|---|---|---|
| **4-segment control** `Off/Light/Med/Strong` (A2/B2) | **Build** | `role="radiogroup"` + 4 `<button>`s (or radio inputs) in a bordered flex row; selected = `bg-accent text-on-accent`, radius `7–8px`. ~30 lines, reusable. | Radix/Headless `ToggleGroup` — Radix is **React-only** (needs `preact/compat` aliasing + ~15–30KB); overkill. |
| **Color-count slider** (A2/B2), `max` = detected count | **Build** | Native `<input type="range" min={floor} max={detectedCount}>` styled via Tailwind + `::-webkit-slider-thumb`/`::-moz-range-thumb`. Dynamic `max` binding is trivial in Preact. | `rc-slider` (~30KB + React), `nouislider` (~30KB). Native range covers single-thumb fully. |
| **Pills / chips** (status pills, "BEST"/"LOCKED" tags, recent-project chips, size cards) | **Build** | `<span class="rounded-full ...">` / bordered cards. Pure Tailwind + Atelier radius tokens, 0 JS. | none worth adding. |
| **Stepper / step-nav** (the 4-step bar — the *only* navigator) | **Build** | One `<StepNav>` Preact component: flex row of step items (circle + label) + connector lines; completed/current/upcoming from an index prop; green fill/check per spec. ~60 lines. | Stepper libs are React-bound and heavier than the whole component. |

**Verdict:** hand-built is not just viable, it's the correct call per the documented "avoid heavy UI libs" stance and the developer profile's "browser-native first" directive. Extract these as small shared components under `src/components/` so the 4 steps + mobile stay consistent.

## Responsive / mobile (Storyboard B)

**No new tooling.** Tailwind v4 (4.3.2) ships **container queries in core** — the `@tailwindcss/container-queries` plugin is *not* required (it existed only for v3.2–3.x). Mark a wrapper with the `@container` utility and use `@sm:`/`@md:`/`@lg:` (and `@max-*`) variants so the Refine rail, size cards, and supply table reflow to the portrait one-column phone layout based on *container* width, not just viewport. Viewport breakpoints (`sm:`/`md:`) remain available too. CSS-only, zero JS.

- **Do NOT** install `@tailwindcss/container-queries` — redundant/confusing on v4.
- The current `@media (max-width: 767.98px)` **drawer/`aside` overrides** in `index.css` (~lines 510–549, 578–588) belong to the *retired* sidebar model — plan to **delete** them; the redesign is inline-everything, never a drawer.

## Client-side PNG export of the chart proof (if needed)

**Native, zero deps.** `canvas.toBlob(cb, 'image/png')` → `URL.createObjectURL(blob)` → programmatic `<a download>` click → `URL.revokeObjectURL`. The project already exports PNGs from the Canvas viewer (`engine/export.ts`); reuse that pattern for the A4/B4 "canvas proof" if an export button is added.

- **Do NOT** add `html2canvas` / `dom-to-image` (~50KB+, inaccurate DOM rasterization) — the proof is already a real `<canvas>`.
- Server-side render of the *purchased* chart (PNG+PDF) is explicitly **v5.0** (deferred). v4.0 proof is the client canvas only.

## Retiring dark mode cleanly (Atelier light-only)

Mechanical, no dependency change. In `src/index.css` + `index.html`:

1. Delete the `[data-theme="dark"]` token block (index.css ~11–31); fold the `[data-theme="light"]` values into `:root`.
2. Remove the pre-mount theme `<script>` in `index.html` (lines 7–15) and either hard-set `data-theme="light"` or drop the attribute usage.
3. Drop the `gempixel_theme` persistence + any theme toggle in `App.tsx`.
4. Remove the `body` color/background `transition` (no skin swap to animate).
5. Retire the dark-only chunky `--btn-shadow` values; the Atelier button is flat green (`--accent #0E6E5C`, text `#F4F1E9`).

Then add the Atelier radii/shadow tokens to the existing `@theme` block so utilities exist for them:

```css
@theme {
  --radius-card: 12px;      /* cards */
  --radius-control: 8px;    /* inputs/controls (7–8px) */
  --radius-pill: 20px;      /* pills */
  --radius-chip: 6px;       /* small chips (4–6px) */
  --shadow-card: 0 40px 80px -30px rgb(0 0 0 / 0.5);
}
```

Palette tokens already match the handoff (bg `#F4F1E9`, panel `#FCFAF4`, white `#FFFFFF`, ink `#1B1A17`, muted `#6B6459`, faint `#9A927D`, border `#E4DECF`/subtle `#EEE8D9`, accent `#0E6E5C`, tint `#EAF2EF`, warn `#B8860B`) — the current light skin was clearly authored from this design. **Add the missing alert/orange** token (`#C2410C` / bg `#FBEBE0`); the current file only defines `warn`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@fontsource-variable/*` (self-host) | External Google Fonts `@import` (current) | Never for this project — external requests add DNS/TCP latency + render-block, can't be pinned, and cut against the privacy-first ethos. Self-host is strictly better. |
| `@fontsource-variable/*` (variable) | `@fontsource/*` (static per-weight) | Only if a family lacked a variable build. All four here have variable builds; one variable woff2 < several static weights. |
| `@fontsource` CSS import | `unplugin-fonts` / `vite-plugin-webfont-dl` / `fontaine` | Not needed — Fontsource ships bundler-ready CSS + woff2; a plugin adds config for no gain. |
| Native `<input type=range>` | `rc-slider` / `nouislider` | Only for multi-thumb ranges or complex tooltips — the color-count slider is single-thumb. |
| Tailwind v4 core container queries | `@tailwindcss/container-queries` plugin | Only on Tailwind v3.2–3.x. Redundant on v4. |
| Hand-built segmented control / stepper | Radix / Headless UI `ToggleGroup` / stepper libs | Only in a React app with heavy a11y-widget needs; incompatible-in-spirit with a Preact + no-UI-kit stack. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react` + `react-dom` | ~45KB + VDOM overhead; DOM tree is tiny (chart is Canvas). Explicit project avoidance. | Preact 10 (in place). |
| Any UI kit (MUI, Chakra, Radix, Headless UI, shadcn, Mantine) | 30KB–200KB+, mostly React-only, pull in styling systems that fight Tailwind. Contradicts "avoid heavy UI libs". | Tailwind utilities + 4 tiny hand-built components. |
| Slider libs (`rc-slider`, `nouislider`, `react-slider`) | 20–35KB for a single-thumb slider the browser gives free. | Native `<input type="range">` + Tailwind. |
| Font-loader libs (`webfontloader`, `vite-plugin-fonts`, `fontaine`) | `@fontsource` already provides self-host CSS + woff2; extra plugin = config for nothing. | `@fontsource-variable/*` import. |
| `@tailwindcss/container-queries` plugin | Container queries are **core** in Tailwind v4 (4.3.2). | Built-in `@container` + `@sm:`/`@md:`/`@max-*` variants. |
| `html2canvas` / `dom-to-image` | 50KB+, inaccurate DOM rasterization; the proof is already a `<canvas>`. | Native `canvas.toBlob('image/png')`. |
| `jsPDF` / `pdfmake` | 200KB+ bundle bloat (documented avoidance). | Existing `@media print` + `window.print()` path. |
| `framer-motion` / animation libs | Heavy; design uses standard hover/active/focus + simple transitions. | CSS transitions (already used). |
| Tour / onboarding libs (`shepherd.js`, `driver.js`, `intro.js`) | Not in scope; the step-nav *is* the guidance. | The `<StepNav>` component. |
| Backend / SSR / payment / vendor-API SDKs (Next, Express, Stripe, Lumaprints client) | **Explicitly deferred to v5.0.** v4.0 is 100% client-side. | Nothing — curated cost table + client-side confirm/handoff. |
| Fabric.js / Paper.js / `panzoom` / Jimp / Pica | Prior documented avoidances for the Canvas + resize path. | Existing `viewer.ts` + worker decode. |

## Stack Patterns by Variant

**If the customer wordmark/motif is confirmed to use Pixelify Sans on a live v4.0 screen:**
- Add `@fontsource-variable/pixelify-sans@5.2.7`.
- Because: it's the only screen that would need it; otherwise it's dead weight (the customer "GemPixel" wordmark is Newsreader, and Pixelify's other home — the ops console — is deferred to v5.0).

**If mobile reflow proves awkward with viewport breakpoints alone (rails inside fixed-width regions):**
- Use Tailwind v4 `@container` on the rail/table wrappers.
- Because: component-level reflow (container queries) beats page-level (`sm:`/`md:`) when a component's width ≠ viewport width — exactly the Refine rail / supply table case.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `tailwindcss@4.3.2` | `@tailwindcss/vite@4.3.2` | Keep both on the same 4.x line; project pins `^4.0.0` → resolves to 4.3.2 today. `@theme` + container queries stable on this line. |
| `@fontsource-variable/*@5.x` | Vite 6 / any bundler | Bundler-agnostic; Vite hashes the woff2. No peer-dep constraints. |
| Preact `^10.25.0` | `@preact/preset-vite@2.9.0` | JSX + HMR handled; hand-built components need no compat shim (we add no React libs). |
| Native `<input type=range>` / `canvas.toBlob` | All target browsers | Universally supported; no polyfill. |

## Bundle-Weight Impact Summary

- **JS runtime: +0 KB.** No new JavaScript dependency — every interactive primitive is native/hand-built.
- **Fonts: three self-hosted variable woff2 (~20–45 KB each, cached, on-demand)** replacing the two render-blocking external Google Fonts requests — net perf + privacy improvement, not a regression. Pixelify Sans (optional) would add one more only if actually used.
- **CSS: negligible** — Tailwind v4 already bundled; container queries are core (no added utility bloat beyond what's referenced).

## Sources

- npm registry (`npm view <pkg> version`, 2026-07-13) — pinned: `@fontsource-variable/newsreader@5.2.10`, `archivo@5.2.8`, `jetbrains-mono@5.2.8`, `pixelify-sans@5.2.7`, `tailwindcss@4.3.2`, `@tailwindcss/vite@4.3.2`. **HIGH** (authoritative).
- [Fontsource — self-host Open Source fonts](https://fontsource.org/) + npm pages ([newsreader](https://www.npmjs.com/package/@fontsource-variable/newsreader), [jetbrains-mono](https://www.npmjs.com/package/@fontsource-variable/jetbrains-mono), [pixelify-sans](https://www.npmjs.com/package/@fontsource-variable/pixelify-sans)) — self-host + Vite import pattern, perf rationale. **HIGH**.
- Tailwind CSS v4 container-query behavior — [tailwindlabs/tailwindcss-container-queries](https://github.com/tailwindlabs/tailwindcss-container-queries) (README: "As of Tailwind CSS v4.0 … supported by default and this plugin is no longer required") + corroborating write-ups. **HIGH**.
- Existing codebase — `src/index.css` (external Google Fonts `@import`, two-skin `@theme` token system, dark-mode block, mobile drawer overrides), `index.html` (pre-mount theme script), `package.json`, `vite.config.ts`, `.agents/GEMINI.md` (documented "what NOT to use"), design handoff `README.md` (Atelier tokens + per-screen specs). **HIGH** (direct read).

---
*Stack research for: GemPixel v4.0 Canvas-First Redesign (frontend-only, 100% client-side)*
*Researched: 2026-07-13*
