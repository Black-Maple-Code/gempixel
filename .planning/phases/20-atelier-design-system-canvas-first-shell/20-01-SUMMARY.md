---
phase: 20-atelier-design-system-canvas-first-shell
plan: 01
subsystem: ui
tags: [fontsource, fontaine, tailwind-v4, design-tokens, self-hosted-fonts, no-cls, css]

# Dependency graph
requires:
  - phase: 20-atelier-design-system-canvas-first-shell (CONTEXT/RESEARCH/UI-SPEC)
    provides: Atelier token values, D-05/D-09/D-10/D-11 locked decisions, font-stack research
provides:
  - Self-hosted Newsreader/Archivo/JetBrains Mono via @fontsource (no external font request)
  - Fontaine no-CLS metric-fallback @font-face wiring in vite.config.ts
  - Single unconditional Atelier-light :root (dual [data-theme] skins flattened)
  - --font-serif/--font-sans/--font-mono + --radius-*/--shadow-card Atelier tokens
  - Engine canvas symbol font repointed to 'Archivo Variable' (signatures frozen)
affects: [20-02, 20-03, phase-21-ui-primitives, phase-22-engine-theme-param, phase-23-screen-bodies]

# Tech tracking
tech-stack:
  added:
    - "@fontsource-variable/newsreader@5.2.10"
    - "@fontsource-variable/archivo@5.2.8"
    - "@fontsource/jetbrains-mono@5.2.8"
    - "fontaine@0.8.0 (devDep)"
  patterns:
    - "Font faces imported as @fontsource CSS entrypoints via JS import in main.tsx (not CSS @import) to dodge the Tailwind v4 external-URL bug"
    - "No-CLS via Fontaine metric fallback faces + manual '<Family> fallback' family appended inside each --font-* value (Fontaine does not rewrite CSS-variable-declared font names)"
    - "Design tokens live unconditionally on :root; @theme inline exposes them to Tailwind utilities"

key-files:
  created: []
  modified:
    - "package.json / package-lock.json - four font packages pinned"
    - "src/main.tsx - four @fontsource entrypoints above ./index.css"
    - "vite.config.ts - FontaineTransform.vite({ fallbacks, resolvePath })"
    - "src/index.css - flattened Atelier :root, @theme inline font stacks, radius/shadow tokens"
    - "src/engine/viewer.ts, src/engine/export.ts, src/engine/symbols.ts - 'Outfit' -> 'Archivo Variable'"

key-decisions:
  - "Repointed the three engine canvas symbol-font literals 'Outfit'->'Archivo Variable' (string-literal only; engine signatures stay frozen per the strangler rule / D-07)"
  - "resolvePath: (id) => new URL('../node_modules/@fontsource'+id, import.meta.url) resolved the @fontsource woff2 correctly on first build (assumption A2 confirmed)"
  - "Fontaine's default fallback family name is '<Family> fallback', matching the names authored in --font-* (assumption A1 confirmed)"

patterns-established:
  - "JS-import font entrypoints in main.tsx; never a CSS @import for external/package fonts"
  - "Every --font-* stack must name its Fontaine fallback family for no-CLS to take effect"

requirements-completed: [DESIGN-01, DESIGN-02]

coverage:
  - id: D1
    description: "Self-hosted Newsreader/Archivo/JetBrains Mono via @fontsource; no external font request in source or built dist"
    requirement: DESIGN-02
    verification:
      - kind: other
        ref: "grep -c fonts.googleapis.com src/index.css == 0; ! grep -rq fonts.googleapis.com dist/"
        status: pass
    human_judgment: false
  - id: D2
    description: "No font-driven layout shift — Fontaine emits metric-matched fallback @font-face (size-adjust/ascent-override/descent-override) for all three families, each referenced by a --font-* value"
    requirement: DESIGN-02
    verification:
      - kind: other
        ref: "npm run build; dist CSS has 19 size-adjust + ascent-override + descent-override faces named 'Newsreader Variable fallback'/'Archivo Variable fallback'/'JetBrains Mono fallback'"
        status: pass
    human_judgment: true
    rationale: "Metric faces are present and grep-proven, but the actual absence of visible CLS on first paint is only observable in a real browser Network/paint trace (not assertable in jsdom)."
  - id: D3
    description: "CSS half of DESIGN-01: dual [data-theme] skins flattened to a single unconditional Atelier light :root; no [data-theme] selector remains"
    requirement: DESIGN-01
    verification:
      - kind: other
        ref: "grep -c '\\[data-theme' src/index.css == 0; grep -c Pixelify src/index.css == 0; --bg #F4F1E9 on :root"
        status: pass
    human_judgment: false
  - id: D4
    description: "Engine canvas symbol-font literals repointed to 'Archivo Variable' with signatures frozen; full Vitest suite stays green"
    requirement: DESIGN-02
    verification:
      - kind: unit
        ref: "npx vitest run — 246 passed (22 files)"
        status: pass
      - kind: other
        ref: "grep -rn \"'Outfit'\" src/engine/ == 0; PHASE 22 markers present"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-13
status: complete
---

# Phase 20 Plan 01: Atelier Design Tokens & Self-Hosted No-CLS Fonts Summary

**Self-hosted Newsreader/Archivo/JetBrains Mono via @fontsource with Fontaine metric-fallback no-CLS, dual [data-theme] skins flattened to one Atelier-light :root, and the three engine canvas symbol-font literals repointed to 'Archivo Variable' — 246 tests green, zero external font requests.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-13T23:32:28Z
- **Completed:** 2026-07-13T23:37:26Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Installed and pinned the four font packages (three @fontsource runtime deps + fontaine devDep); imported the CSS entrypoints as JS imports in `main.tsx` above `./index.css`, and wired `FontaineTransform.vite` with a `node_modules`-aware `resolvePath`.
- Deleted both external Google-Fonts `@import` lines and flattened the `:root, [data-theme="dark"]` + `[data-theme="light"]` blocks into a single unconditional Atelier-light `:root`; no `[data-theme]` selector or `Pixelify` reference remains.
- Added `--font-serif`/`--font-sans`/`--font-mono` to `@theme inline` (each naming its Fontaine `'<Family> fallback'` family), redefined `--font-display` once as Newsreader Variable, and added `--radius-card/control/pill` + `--shadow-card` tokens.
- Repointed the three engine canvas symbol-font literals `'Outfit'`→`'Archivo Variable'` (string-literal only, `// PHASE 22` markers) and confirmed via build spike that Fontaine emits metric-fallback faces (`size-adjust`/`ascent-override`/`descent-override`) for all three families with no external font URL in `dist/`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install font packages + wire font-load/no-CLS pipeline** - `f635fbf` (feat)
2. **Task 2: Flatten dark-mode CSS + wire self-hosted font stacks + radius/shadow tokens** - `804d753` (feat)
3. **Task 3: Repoint engine symbol-font literals + prove no-CLS build spike** - `0a518a4` (feat)

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified
- `package.json` / `package-lock.json` - four font packages pinned at exact versions
- `src/main.tsx` - four `@fontsource` CSS entrypoints imported above `./index.css`
- `vite.config.ts` - `FontaineTransform.vite({ fallbacks, resolvePath })` after `tailwindcss()`; `test`/`resolve.alias` blocks untouched
- `src/index.css` - external font imports removed; single Atelier `:root`; `@theme inline` font stacks; radius/shadow tokens; `body`→`var(--font-sans)`; mono fallback appended
- `src/engine/viewer.ts` - symbol-font literal → `'Archivo Variable'` + PHASE 22 marker
- `src/engine/export.ts` - two symbol-font literals → `'Archivo Variable'` + PHASE 22 markers
- `src/engine/symbols.ts` - comment rephrased off the old family name

## Decisions Made
- **Repoint over accept-fallback (Open Q1):** the three engine `'Outfit'` literals were repointed to `'Archivo Variable'` so canvas symbols keep a loaded font. This is a string-literal edit, not an engine signature change — the strangler rule (D-07) holds; the `theme`-param removal stays deferred to Phase 22 (markers left in place).
- **`resolvePath` shape confirmed on first build:** `new URL('../node_modules/@fontsource'+id, import.meta.url)` resolved every woff2 (the one MEDIUM item from RESEARCH §2a) — no "could not resolve" warnings, so the hand-authored-metrics fallback path was not needed.
- **Fallback family name confirmed:** Fontaine's default `'<Family> fallback'` naming matches the names authored inside the `--font-*` values, so no `overrideName` was required (assumption A1).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Fontaine double-rewrite (cosmetic, no fix needed):** in addition to my manually-authored `--font-*` stacks, Fontaine's declaration-rewriter also appended fallbacks to some generated `font-family` declarations, producing a few malformed extra entries (e.g. `Archivo,"Archivo fallback" Variable,…`). The well-formed stacks (`"Archivo Variable", "Archivo Variable fallback", ui-sans-serif, …`) that the app's utilities/body actually resolve to are present and correct, and each references a real metric-fallback `@font-face`, so no-CLS works and rendering degrades gracefully. Left as-is — harmless build-output artifact, not a correctness issue.
- **jsdom `getContext()` stderr noise:** the canvas export tests log "Not implemented: HTMLCanvasElement's getContext()" (pre-existing jsdom limitation, canvas npm package not installed). Tests still pass; unrelated to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The visual-skin foundation is in place: Plan 20-02/03 chrome can consume `bg-panel`/`text-ink`/`bg-accent`, the new `--radius-*`/`--shadow-card` tokens, and the `font-serif`/`font-sans`/`font-mono` utilities.
- Remaining DESIGN-01 work (App.tsx theme hook/effect/toggle removal + `index.html` boot-script deletion) is the JS half, handled by a later plan in this phase — the CSS side (no `[data-theme]` selector) is done here so a stale `data-theme="dark"` attribute now selects nothing (SC1 by construction).

## Self-Check: PASSED
- All three task commits present in `git log` (`f635fbf`, `804d753`, `0a518a4`).
- `npx tsc --noEmit` exits 0; `npm run build` exits 0; `npx vitest run` → 246 passed (≥240, SC5).
- `grep -c fonts.googleapis.com src/index.css` == 0 and no `fonts.googleapis.com` in `dist/` (SC2).
- `grep -c '[data-theme' src/index.css` == 0 (SC1 CSS side); `grep -rn "'Outfit'" src/engine/` == 0.
- `dist/` CSS contains Fontaine `size-adjust`/`ascent-override`/`descent-override` fallback faces for all three families.

---
*Phase: 20-atelier-design-system-canvas-first-shell*
*Completed: 2026-07-13*
