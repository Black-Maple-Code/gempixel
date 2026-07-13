# Phase 20: Atelier Design System & Canvas-First Shell - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 8 (2 new components + 6 modified)
**Analogs found:** 8 / 8 (all have in-repo analogs — this is a re-skin/restructure of existing code)

> All line numbers below were re-verified against live code (CONTEXT/RESEARCH line refs were approximate). Corrections noted inline.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/wizard/StepBar.tsx` *(new)* | component (chrome/nav) | props-only render | Desktop top progress bar, `App.tsx:1519-1573` + dot-nav `App.tsx:1471-1497` | exact (extracting existing markup) |
| `src/features/wizard/AtelierShell.tsx` *(new, optional)* | component (layout shell) | props-only render | `src/features/wizard/steps/Step1Ingest.tsx` (pure-props child idiom) | role-match |
| `src/index.css` *(modified)* | config (design tokens/CSS) | n/a | Existing `@theme inline` + `[data-theme]` blocks (self-analog) | exact |
| `index.html` *(modified)* | config (boot) | n/a | self (delete boot script) | exact |
| `src/main.tsx` *(modified)* | config (entrypoint) | n/a | self (add font imports) | exact |
| `vite.config.ts` *(modified)* | config (build) | n/a | self (add Fontaine plugin) | exact |
| `src/App.tsx` *(modified)* | component (state owner) | request-response | self (theme hook/effect, nav, viewer host) | exact |
| `src/engine/viewer.ts` + `src/engine/export.ts` *(modified)* | utility (canvas render) | file-I/O / transform | self (`'Outfit'` literals) | exact |

---

## Pattern Assignments

### `src/features/wizard/StepBar.tsx` (new — pure nav component)

**Analog A — pure-props child contract:** `src/features/wizard/steps/Step1Ingest.tsx:10-51`. Every step component is a **pure presentational component: all state + handlers passed in as props, no local state mirroring engine state** (docstring lines 4-9). `<StepBar>` must follow this exactly — it receives `{step, canEnter, goTo}` from App and owns nothing (D-01).

```tsx
// Step1Ingest.tsx — the props-only contract to copy
export interface Step1IngestProps { image: HTMLImageElement | null; /* …all state in, no useState */ }
export function Step1Ingest(props: Step1IngestProps) { const { … } = props; return ( … ); }
```

**Analog B — the desktop step-nav markup to extract & collapse** (`src/App.tsx:1519-1551`, the `hidden md:flex` top bar). This is the closest visual analog to the new horizontal 4-step bar and is one of the TWO surfaces D-03 collapses:

```tsx
// App.tsx:1521-1550 — current desktop step nav (labels differ from STEP_META target)
{['Upload', 'Size', 'Colors', 'Supplies'].map((label, i) => {
  const step = i + 1;
  const isActive = wizard.step === step;
  const isCompleted = wizard.step > step;
  const isValid = wizard.canEnter(step) || isTestEnv;
  return (
    <div key={label} className="flex items-center gap-1.5">
      {i > 0 && <span className="w-6 h-px bg-border" />}   {/* connector */}
      <button onClick={() => isValid && wizard.goTo(step)} disabled={!isValid}
        className={`… ${isCompleted ? 'bg-accent-2 text-on-accent font-bold'
          : isActive ? 'bg-accent text-on-accent font-bold'
          : isValid ? 'text-muted hover:text-ink' : 'text-muted opacity-50'}`}>
        <span className="w-4 h-4 rounded-full … border border-current">{isCompleted ? '✓' : step}</span>
        {label}
      </button>
    </div>
  );
})}
```

**Analog C — the second surface to delete** (dot-nav, `src/App.tsx:1471-1497`, inside the sticky `<aside>` footer). Same `isActive/isCompleted/isValid` computation; both A + C must be replaced by the single `<StepBar>` (D-03).

**Gating pattern to add (D-12):** the analog uses `disabled={!isValid}` + `cursor-not-allowed`. New StepBar upgrades this to `aria-disabled="true"`, remove from tab order, `aria-current="step"` on the active step, and a static "Upload an image to unlock" tooltip (tooltip idiom = `.tooltip-group`/`.tooltip-box`, `src/index.css:591-615`).

**`STEP_META` single-source (D-02):** replace the three inline label arrays that exist today — `['Upload','Size','Colors','Supplies']` (`App.tsx:1521`), `['Upload','Palette & Optimize','Cost & Order','Save']` (`App.tsx:1491` and `App.tsx:1532`) — with one `STEP_META` map (`1 Upload · 2 Refine · 3 Supplies · 4 Order`).

---

### `src/features/wizard/AtelierShell.tsx` (new — optional layout wrapper)

**Analog:** the pure-props idiom of `Step1Ingest.tsx:51` again. Per Claude's Discretion in CONTEXT, placement/existence is the planner's call (may inline minimal chrome instead). If created, it wraps the top-bar chrome (logo + `<StepBar>` + Save pill) and receives wizard state as props. Save-pill analog: `App.tsx:1562-1571` (`btn-chunk-2` styled Save button, already in the desktop top bar).

---

### `src/index.css` (design tokens + font wiring + dark-mode flatten)

**Analog:** the file's own existing token architecture — no new mechanism introduced (CONTEXT §Reusable Assets).

**Flatten pattern (D-05):** delete the dual-skin blocks and hoist the light (Atelier) values onto `:root`.
- Currently `:root, [data-theme="dark"]` share the dark block (`src/index.css:10-31`) and `[data-theme="light"]` is a separate override (`src/index.css:33-53`).
- Target: one unconditional `:root` carrying the Atelier light values (the current `:33-53` set), deleting both `[data-theme]` selectors. The `@theme inline` remaps (`:69-129`) and neutral/accent scale remaps reference the same `var(--…)` names and keep working unchanged (RESEARCH §3a).

**Font import deletes (D-09):** remove the two external Google-Fonts lines at the very top:
```css
/* src/index.css:1-2 — DELETE both (SC2 no-external-request gate) */
@import url('https://fonts.googleapis.com/css2?family=Outfit:…&family=JetBrains+Mono:…&family=Pixelify+Sans:…');
@import url('https://fonts.googleapis.com/css2?family=Newsreader:…');
```

**`@theme inline` font overrides (D-09):** the block at `src/index.css:69` currently defines only `--font-display: var(--font-display)` (`:88`). Add `--font-serif`/`--font-sans`/`--font-mono` with the Fontaine fallback family appended (RESEARCH §1c). Redefine `--font-display` once on `:root` as `'Newsreader Variable'` (replacing the per-skin `--font-display` at `:25` Pixelify / `:47` Newsreader).

**`@layer base` family reconciliation:**
- `src/index.css:136` `font-family: 'Outfit', sans-serif;` on `body` → `var(--font-sans)` (Archivo now owns body/UI).
- `src/index.css:139-141` `code, pre, .font-mono { font-family: 'JetBrains Mono', monospace !important; }` — append fallback: `'JetBrains Mono', 'JetBrains Mono fallback', monospace`.

---

### `index.html` (dark-mode resurrection vector — RESEARCH NEW FINDING)

**Analog:** self. Delete the inline anti-FOUC boot script and hard-coded attribute:
```html
<!-- index.html:2 — simplify to <html lang="en"> -->
<html lang="en" data-theme="light">
<!-- index.html:7-15 — DELETE this entire script (reads abandoned gempixel_theme) -->
<script>
  (function () { try {
    var t = localStorage.getItem('gempixel_theme');
    document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light';
  } catch (e) {} })();
</script>
```
This file is NOT in CONTEXT's touchpoint list but is the actual dark-mode resurrection vector (RESEARCH §3c, Pitfall C).

---

### `src/main.tsx` (font entrypoint)

**Analog:** the current 9-line entrypoint (`src/main.tsx:1-9`). Add the four `@fontsource` JS imports **above** `import './index.css'` (RESEARCH §1a — JS import, not CSS `@import`, to dodge the Tailwind-v4 URL-resolution bug):
```ts
import '@fontsource-variable/newsreader/wght.css';
import '@fontsource-variable/archivo/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';   // existing line, keep last
```

---

### `vite.config.ts` (Fontaine no-CLS plugin)

**Analog:** the current 18-line config (`vite.config.ts:1-18`). Existing plugin array is `[preact(), tailwindcss()]` (`:7`). Add `FontaineTransform.vite({ fallbacks, resolvePath })` after `tailwindcss()` (RESEARCH §2a). Note the existing `test` block uses `environment: 'node'` (`:9`) — RESEARCH's example says "unchanged"; preserve it. `resolvePath` into `node_modules/@fontsource…` is the one MEDIUM item needing a build spike (Pitfall B).

---

### `src/App.tsx` (state owner — dark-mode rip + nav swap + single-mount viewer)

**Theme hook + effect delete (D-05):**
```ts
// App.tsx:163-168 — DELETE the usePersistentState theme instance + the [data-theme] effect
const [theme, setTheme] = usePersistentState<'dark' | 'light'>('gempixel_theme', 'light', …);
useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
```
Keep `usePersistentState` itself (used elsewhere) — only the `gempixel_theme` instance goes.

**Toggle UI delete (D-05):** the light/dark pill button, `App.tsx:1437-1451` (`onClick={() => setTheme(…)}`).

**Boot cleanup (D-06):** add one `localStorage.removeItem('gempixel_theme')` at App init (no ordering dependency once the `index.html` script is deleted — RESEARCH §3d).

**Viewer theme effect (D-07) — the REAL mechanism (RESEARCH §3e):** `viewer.ts`/`symbols.ts` never took a `theme` param; the theme→canvas path is the CSS-var read effect:
```ts
// App.tsx:556-562 — KEEP the effect; drop `theme` from the dep array (theme no longer exists).
useEffect(() => {
  if (!viewerRef.current) return;
  const styles = getComputedStyle(document.documentElement);
  viewerRef.current.setRoundBacking(styles.getPropertyValue('--drill-round-backing').trim());
  viewerRef.current.setGridGap(styles.getPropertyValue('--canvas-gap').trim());
}, [theme, image, matchResult, drillStyle]);   // → [image, matchResult, drillStyle]
```
Tag with `// PHASE 22: remove theme param` marker here (not on an engine signature).

**Single-mount viewer (D-14) — current tree position to hoist from:**
- The `<canvas ref={canvasRef}>` host lives at `App.tsx:1702-1709`, inside the `{(image || matchResult) ? … }` branch in `<main>` — it is NOT inside a `{wizard.step===n}` branch today, so the canvas host itself is already always-mounted while an image exists. Good.
- The four step **panels** ARE gated: `{wizard.step === 1 && <Step1Ingest…/>}` (`App.tsx:1295-1336`), `step===2` (`:1338-1364`), `step===3` (`:1366-1395`), `step===4` (`:1397-1415`). D-14 target: render these as siblings toggled with `hidden`/`display:none` instead of `&&`-unmount, so nothing around the viewer remounts.
- Viewer lifecycle to preserve: init `App.tsx:518-533` (`new CanvasViewer` once, guarded by `if (!viewerRef.current)`), data sync `App.tsx:536-554`, teardown `App.tsx:508-513`. The never-remount guarantee (SC4) falls out of keeping these untouched while converting the panel `&&` gates to CSS toggles.

**Nav surfaces to delete (D-03):** desktop top step bar `App.tsx:1519-1551`, sticky dot-nav footer `App.tsx:1471-1497` (both replaced by `<StepBar>`). Note: the mobile bottom tab bar at `App.tsx:2184-2238` is a **panel toggle** (Setup/Canvas/Colors), not a step nav — mobile is Phase 24; leave it unless it conflicts.

---

### `src/engine/viewer.ts` + `src/engine/export.ts` (`'Outfit'` symbol-font literals — D-07/Pitfall D)

**Analog:** self. Three hard-coded `'Outfit'` canvas symbol fonts orphaned by the Outfit `@import` delete:
```ts
// viewer.ts:392
this.ctx.font = `bold ${symbolFontPx(baseSymbolPx, symbol)}px 'Outfit', sans-serif`;
// export.ts:85 and export.ts:173 (identical shape)
ctx.font = `bold ${symbolFontPx(Math.floor(cellScale * 0.65), symbol)}px 'Outfit', sans-serif`;
```
This is a **string-literal change, not a signature change** (D-07-safe). Recommendation (Open Q1): repoint to `'Archivo Variable'` to keep a loaded font; tag `// PHASE 22`. `symbols.ts` has only a comment mention (`symbols.ts:22`) — no code change, optionally update the comment.

---

## Shared Patterns

### Pure-props child components (drives D-01/D-12/D-14)
**Source:** `src/features/wizard/steps/Step1Ingest.tsx:4-9` (docstring) + `:10-51` (interface + destructure).
**Apply to:** `<StepBar>`, `<AtelierShell>`, and every future screen. App.tsx stays the sole state owner; children receive `{step, canEnter, goTo, stale?}` as props and render only.

### Design tokens via `var(--…)` + `@theme inline`
**Source:** `src/index.css:69-129`.
**Apply to:** all new chrome. Consume semantic utilities (`bg-panel`, `text-ink`, `border-border`, `bg-accent`, `text-on-accent`) — never hard-code Atelier hexes in components; add/override tokens in `:root` + `@theme inline` only.

### Canvas can't read CSS vars — push via setters
**Source:** `src/App.tsx:556-562` (`getComputedStyle` → `setRoundBacking`/`setGridGap`).
**Apply to:** any canvas color that must track tokens. After the flatten, `:root` always yields Atelier light values; the effect stays but loses its `theme` dep.

### Disabled/gated controls + tooltip idiom
**Source:** nav buttons `disabled={!isValid}`/`cursor-not-allowed` (`App.tsx:1531/1538`) + `.tooltip-group`/`.tooltip-box` (`src/index.css:591-615`).
**Apply to:** StepBar locked-step gating (upgrade to `aria-disabled` + out-of-tab-order + `aria-current="step"` per D-12).

### Chunky button primitives
**Source:** `.btn-chunk` / `.btn-chunk-2` (`src/index.css:149-167`), used at `App.tsx:1557` (Next) and `:1568` (Save).
**Apply to:** top-bar Save pill and any StepBar CTAs.

---

## No Analog Found

None. Phase 20 is a re-skin + restructure of existing UI; every new/modified file maps to in-repo code. The only genuinely new dependency wiring (Fontaine in `vite.config.ts`, `@fontsource` imports in `main.tsx`) has no prior analog but is fully specified in RESEARCH §1-2 — planner should use RESEARCH there rather than a codebase pattern.

## Metadata

**Analog search scope:** `src/features/wizard/`, `src/App.tsx`, `src/index.css`, `src/engine/{viewer,symbols,export}.ts`, `src/main.tsx`, `index.html`, `vite.config.ts`.
**Files scanned:** 9.
**Line numbers:** re-verified against live code 2026-07-13 (CONTEXT refs `:162-164/1474/1523` corrected to `:163-168/1471-1497` dot-nav, `:1519-1551` desktop step bar; mobile `:2184` is a panel toggle, not step nav).
**Pattern extraction date:** 2026-07-13
</content>
</invoke>
