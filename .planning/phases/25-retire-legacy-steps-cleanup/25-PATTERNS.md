# Phase 25: Retire Legacy Steps + Cleanup - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 11 modified + 3 deleted (0 net-new)
**Analogs found:** 11 / 11 (in-place edits — the "analog" is each file's own current state + the named prior-phase precedent)

> **Phase shape:** This is a MODIFICATION + DELETION phase, not a new-file phase. There is no
> greenfield code to pattern-match against an external analog — every edit extends a proven seam
> that already exists in the tree. The pattern each plan copies is therefore **the current live
> code at the exact seam** (excerpted below with verified line numbers) plus the named prior-phase
> precedent that sanctions the extension style. Research (`25-RESEARCH.md`) already verified every
> line number; this map turns those anchors into copy-ready excerpts and flags the SC10 guardrail
> per modal.

---

## File Classification

| File | Action | Role | Data Flow | Analog / Precedent | Match |
|------|--------|------|-----------|--------------------|-------|
| `src/engine/viewer.ts` | modify | engine (canvas interaction class) | event-driven (zoom/pan) | its own `handleZoom`/`fitToContainer` + P24 D-05 pinch (behavior-only extension) | exact |
| `src/App.tsx` (recompute) | modify | container / state owner | event-driven → worker | its own `handleRecomputeMatch` soft-invalidate seam (`:590`) | exact |
| `src/App.tsx` (ingest) | modify | container / state owner | file-I/O → state | its own `loadImageFile`/`img.onload` (`:958`) | exact |
| `src/App.tsx` (`<main>` print) | modify | layout / view compose | transform (print) | its own step-gated `<main>` className (`:1619`) + `beforeprint` hook (`:706`) | exact |
| `src/App.tsx` (footer relocate) | modify | layout / view compose | request-response (nav) | its own Back/Next footer (`:1804`) | exact |
| `src/App.tsx` (panel ternaries) | modify | view compose | — | its own panel-1/2/4 ternaries (`:1641/1705/1772`); panel-3 (`:1737`) is the PRESERVE exception | exact |
| `src/features/wizard/AtelierShell.tsx` | modify | layout shell (pure) | — | its own `h-dvh overflow-hidden` root (`:52`) | exact |
| `src/features/wizard/CanvasWorkspace.tsx` | modify | component (pure/props) | — | its own viewport surface + HUD (`:81/84/113`); D-09 re-token map (UI-SPEC) | exact |
| `src/features/screens/RefineScreen.tsx` | modify | screen (pure/props) | — | its own stale props + rail (`:69/108/175`) | exact |
| `src/__tests__/App.test.tsx` | retarget | test | — | P23 aside test-retargeting precedent | role-match |
| `src/__tests__/integration.test.tsx` | retarget | test | — | P23 aside test-retargeting precedent | role-match |
| `src/features/wizard/steps/Step1Ingest.tsx` | **delete** | screen (legacy) | — | — | — |
| `src/features/wizard/steps/Step2Palette.tsx` | **delete** | screen (legacy) | — | — | — |
| `src/features/wizard/steps/Step4Export.tsx` | **delete** | screen (legacy) | — | — | — |
| `src/features/wizard/steps/Step3Canvas.tsx` | **PRESERVE untouched** (guardrail #11 / D-01) | screen (legacy, fulfillment-live) | — | Phase 26 owns deletion | — |
| `src/features/screens/flags.ts` | **leave as-is** (all `true`, D-01) | config | — | Phase 26 owns cleanup | — |

---

## Pattern Assignments

### `src/engine/viewer.ts` (engine, event-driven) — D-04 `isFitMode`

**Pattern:** behavior-only extension of the existing zoom/fit machinery. Add one private boolean;
set it in the two funnels that already exist. No signature change (P22 engine-freeze holds; matches
the P24 D-05 pinch precedent). All user-zoom paths (`zoomIn`/`zoomOut`/wheel/pinch) funnel through
`handleZoom`, so one line there covers every "user zoomed" exit-from-fit.

**Current state — state field (`:16`):**
```typescript
private scale = 1.0;   // ← starts at 1.0, no fit-mode concept today
```

**Current state — `handleZoom` (`:180`, clamps `:184`) — the single user-zoom funnel:**
```typescript
private handleZoom(mouseX: number, mouseY: number, zoomFactor: number) {
  const mouseCanvasX = (mouseX - this.offsetX) / this.scale;
  const mouseCanvasY = (mouseY - this.offsetY) / this.scale;
  const minScale = 0.5;
  const maxScale = 50.0;
  const newScale = Math.min(Math.max(this.scale * zoomFactor, minScale), maxScale);
  this.offsetX = mouseX - mouseCanvasX * newScale;
  this.offsetY = mouseY - mouseCanvasY * newScale;
  this.scale = newScale;
  this.draw();
  if (this.onZoomChange) { this.onZoomChange(this.scale); }
  // ← ADD: this.isFitMode = false;  (explicit user zoom leaves fit)
}
```

**Current state — `fitToContainer()` (`:475`) — measures backing store, works while `display:none`:**
```typescript
public fitToContainer() {
  if (this.gridWidth <= 0 || this.gridHeight <= 0) return;
  const cellSize = 16;
  const offscreenWidth = this.gridWidth * cellSize;
  const offscreenHeight = this.gridHeight * cellSize;
  const scaleX = this.canvas.width / offscreenWidth;   // this.canvas.width = backing store (800), not layout
  const scaleY = this.canvas.height / offscreenHeight;
  const newScale = Math.min(scaleX, scaleY) * 0.95;    // 5% padding
  this.scale = Math.min(Math.max(newScale, 0.1), 50.0);
  this.offsetX = (this.canvas.width - offscreenWidth * this.scale) / 2;
  this.offsetY = (this.canvas.height - offscreenHeight * this.scale) / 2;
  this.draw();
  if (this.onZoomChange) { this.onZoomChange(this.scale); }
  // ← ADD: this.isFitMode = true;  (re-entering fit)
}
```
`resetZoom()` (`:471`) already delegates to `fitToContainer()`, so it inherits fit-mode for free.

**Discretion (per CONTEXT):** the re-fit-on-dimension-change trigger may live App-side (call
`fitToContainer()` after recompute) or in the viewer on grid set. Container-resize re-fit needs a new
`ResizeObserver` guarded on `isFitMode` — the one genuinely new listener; keep optional if it risks
the jsdom suite (jsdom has no layout).

---

### `src/App.tsx` — recompute auto-fire (container, event-driven → worker) — D-02

**Pattern:** DO NOT rewrite recompute. Auto-fire the existing `handleRecomputeMatch`; delete only the
stale *surfaces*. `setMatchInputs` is the fire-once, abort-race-safe commit the match hook keys on.

**Current state — the seam to reuse (`:575–609`):**
```typescript
const isStale =
  !!matchResult &&
  (matchInputs.image !== image || matchInputs.cols !== cols || matchInputs.rows !== rows);
const staleFromStep: number | null = isStale ? 2 : null;
const matchCols = matchInputs.cols;   // last-good dims — keep rendering committed grid while stale
const matchRows = matchInputs.rows;

const handleRecomputeMatch = () => {
  setActionError(null);
  if (!image) {                                    // ME-01 imageless guard — KEEP
    setActionError('Re-upload the source image to recompute the match.');
    return;
  }
  setMatchInputs({ image, cols, rows });           // ← D-02 auto-fires THIS
};

const guardedGoTo = (target: number) => { ... };   // ← retire staleFromStep gating (D-02)
const nextBlockedByStale = staleFromStep !== null && wizard.step + 1 >= staleFromStep;  // ← retire
```

**D-02 delta:** SizeCard → call `handleRecomputeMatch()` immediately; custom-size input → debounce
~500ms (400–600ms band) + clamp-guard before firing (`if (nextCols >= MIN && nextRows >= MIN && image)`).
Then **remove**: page-level stale banner, `stale`/`onRecompute` refineProps, `nextBlockedByStale`
advance-block, StepBar amber marker, and `isStale`/`staleFromStep` if fully unreferenced.
Keep the ME-01 imageless guard (still valid). Reuse the existing two-phase loading overlay
(`CanvasWorkspace.tsx:233`) for the "Recomputing…" pending state — no new surface.

---

### `src/App.tsx` — auto-advance on ingest (container, file-I/O → state) — D-08

**Current state — `loadImageFile` → `img.onload` (`:958–998`):**
```typescript
img.onload = () => {
  setHighlightedColor(null);
  setActiveProjectId(null);
  setImageName(file.name || 'Uploaded Image');
  // ...aspect-ratio rows clamp (unit grid/cm/inch)...
  setRows(newRows);
  setImage(img);
  setImageSourceOpen(false);
  if (!matchResult) {                              // first upload commits; re-upload stays uncommitted
    setExcludedColors(new Set());
    setSelectedPreset('custom');
    setMatchInputs({ image: img, cols, rows: newRows });
  }
  // ← ADD D-08: wizard.goTo(2)  (canEnter(2) gates on hasImage — now true). Advance Upload→Refine.
};
```
Note the recent-image path (`~:1042`) runs the same handler — decide whether recent-load also advances
(likely yes for parity; A4 discretion).

---

### `src/App.tsx` — canvas print from every step (layout, transform) — D-03 / WR-01

**Current state — the bug is one Tailwind class (`:1619`):**
```tsx
<main className={wizard.step === 2 ? 'relative flex min-w-0 flex-1 flex-col print:block @max-[640px]:sticky @max-[640px]:top-0 @max-[640px]:h-[45dvh] @max-[640px]:flex-none @max-[640px]:z-10' : 'hidden'}>
```
Off-Refine the className is `'hidden'` with NO `print:block` override → plain Ctrl+P prints nothing.

**Fix:** compose `print:block` unconditionally, e.g.
`` `print:block ${wizard.step === 2 ? 'relative flex …@max-[640px]:…' : 'hidden'}` `` →
`hidden print:block` = `display:none` on screen, `block` in print.

**Why low-risk (already wired):** `beforeprint` already re-fits before print (`:706–714`):
```typescript
const handleBeforePrint = () => {
  savedViewportModeRef.current = viewportMode;
  setViewportMode('symbols');
  if (viewerRef.current) {
    viewerRef.current.setViewMode('symbols');
    viewerRef.current.fitToContainer();          // fits backing store even while display:none
  }
};
```
`.print-canvas-wrapper canvas { max-width:100% }` already exists (`index.css:280`), and the plain
`@media print` block does NOT hide `main` (only `print-only-report-mode`/`print-only-legend-mode`
body classes do). Supply-Report / legend print buttons target their own DOM — no double-print conflict.

---

### `src/App.tsx` + `AtelierShell.tsx` — fixed 3-zone shell (layout) — D-05

**Current AtelierShell root (`:52`) — flat children below header:**
```tsx
<div className="@container flex flex-col h-dvh overflow-hidden print:h-auto print:overflow-visible">
  <header className="... no-print shrink-0"> ... StepBar ... Save pill ... </header>
  {children}                                   // ← today: flat, no zone structure
</div>
```

**Current in-flow footer to relocate (`App.tsx:1804`) — ids/handlers must survive verbatim:**
```tsx
<div className="no-print mt-4 flex items-center justify-between border-t border-border pt-4">
  {wizard.step > 1 ? (<button id="wizard-back-btn" onClick={wizard.back} ...>&lt; Back</button>) : (...)}
  {wizard.step < 4 ? (
    <button id="wizard-next-btn"
      onClick={() => { if (!nextBlockedByStale) wizard.next(); }}
      disabled={!wizard.canEnter(wizard.step + 1) || nextBlockedByStale} ...>Next Step →</button>
  ) : (...)}
</div>
```

**D-05 delta:** restructure into 3 flex children — **Zone 1** existing `<header>` (`shrink-0`),
**Zone 2** `flex-1 min-h-0 overflow-y-auto` wrapping step panels + single-mount `<main>`, **Zone 3**
`shrink-0` bottom bar hosting the relocated Back/Next (padding `px-4 py-3` to match header). `min-h-0`
on Zone 2 is the load-bearing detail. Desktop-scoped — keep the `@max-[640px]` mobile classes on the
canvas wrapper (`:1612/1619`) intact. Canvas `<main>` re-zoned, NEVER remounted (P20 D-14). Note
`nextBlockedByStale` is being removed by D-02 — the relocated Next drops that clause.

---

### `src/features/wizard/CanvasWorkspace.tsx` — re-token + switcher bottom-snap (component) — D-07/D-09

**Current viewport surface (`:81`) — legacy `slate-*` remap-shim consumer:**
```tsx
<div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950 viewport-dots print:bg-white print:h-auto print:overflow-visible print:p-4">
```

**Current view-switcher (`:84–110`) — top `viewport-hud`, active = `bg-sky-500 text-white`:**
```tsx
<div className="viewport-hud no-print" ...>
  <div className="flex bg-slate-950/40 rounded-lg p-0.5 border border-slate-800/40">
    {(['grid','symbols','reference'] as const).map(mode => {
      const isActive = viewportMode === mode;
      // active: 'bg-sky-500 text-white shadow shadow-sky-500/20'  → D-09: 'bg-accent text-on-accent'
      // idle:   'text-slate-400 hover:text-slate-200'            → D-09: 'text-muted hover:text-ink'
```

**Current zoom HUD (`:113–149`) — PRESERVE aria-labels + 44px targets through the re-token:**
```tsx
<button onClick={() => onZoomIn()} aria-label="Zoom In"
  className="min-h-[44px] min-w-[44px] p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white ...">➕</button>
// same shape for onZoomOut() aria-label="Zoom Out" ➖, onFit() aria-label="Fit Viewport" ⛶
```

**Deltas:** (D-09) apply the UI-SPEC re-token map — `bg-slate-950`→`bg-bg`, `bg-slate-950/80`→`bg-bg/80`,
`border-slate-800`/`bg-slate-800`→`border-border`/`bg-border`, `text-slate-300/400/500`→`text-ink`/`text-muted`/`text-faint`,
`bg-sky-500 text-white`→`bg-accent text-on-accent`, `bg-indigo-500` (progress fill `~:234`)→`bg-accent`.
Keep the 44px targets and align aria strings to "Zoom in"/"Zoom out"/"Fit to screen" if touched.
(D-07) move the switcher from top `viewport-hud` to bottom-snap, centered, ≥8px clear of the hint pill,
never overlapping the canvas.

---

### `src/features/screens/RefineScreen.tsx` — drop stale props + rail cap (screen) — D-02/D-06

**Current stale prop surface (`:68–98`) — REMOVE:**
```typescript
// interface (:68–70)
stale: boolean;
onRecompute: () => void;
// destructure (:96–97)  stale, onRecompute,
```

**Current rail-local stale cue (`:172–189`) — REMOVE with its "Recompute match" button:**
```tsx
{stale && (
  <div role="status" className="... border-warn ...">
    <span className="text-[11px] font-semibold">Size changed — preview is out of date</span>
    <button onClick={onRecompute} ...>Recompute match</button>
  </div>
)}
```

**Current rail width (`:108`) — D-06 cap to `max-w-[320px]` (300–340px band):**
```tsx
<section data-screen="refine"
  className="flex w-[360px] max-w-full flex-col gap-6 border-l border-border bg-panel p-6 text-ink @max-[640px]:w-full @max-[640px]:border-l-0">
  // w-[360px] → max-w-[320px]; canvas viewport stays flex-1; no horizontal scroll / no encroachment ≥1024px
```
Also drop the props from App's `refineProps` object (`App.tsx:~1408–1409`).

---

### Panel-ternary collapse (view compose) — D-01

**Pattern (`App.tsx:1641/1705/1772`):** for panels **1, 2, 4**, delete the `import { StepN… }`
(`:18/19/21`) AND collapse the ternary to the new screen only — dropping the `USE_NEW_* ? Screen : <StepN>`
wrapper and its else-branch (avoids the "declared but never read" / dead-branch tsc break, Pitfall 3).

```tsx
// BEFORE (panel 1, :1642): {USE_NEW_UPLOAD ? (<UploadScreen .../>) : (<Step1Ingest ... 30+ props/>)}
// AFTER:                   <UploadScreen .../>          // ternary + Step1Ingest branch removed
```

**Panel-3 is the EXCEPTION (`:1737–1770`) — PRESERVE untouched:**
```tsx
{USE_NEW_SUPPLIES ? (<SuppliesScreen {...suppliesProps} />) : (
  <Step3Canvas ... handleShopifyCheckout={handleShopifyCheckout}
    handleDownloadCanvasOnly={handleDownloadCanvasOnly}
    handleDownloadCombinedCanvasSheet={handleDownloadCombinedCanvasSheet} ... />
)}
```
Keep the `USE_NEW_SUPPLIES` ternary, the `Step3Canvas` import (`:20`), and `flags.ts` — Phase 26 owns them.

---

### Test retargeting — D-02 stale test + Step deletion blast radius

**`App.test.tsx:1473` — the D-02 red-fail test (asserts the retired UX):**
```typescript
it('marks downstream stale, keeps last-good match, blocks advancing; imageless Recompute prompts re-upload (ME-01)', ...
  expect(container.textContent).toContain('This step is out of date');        // ← D-02 removes banner
  const recomputeBtn = ...find(b => b.textContent?.trim() === 'Recompute match')  // ← D-02 removes button
  expect(container.querySelector('nav[aria-label="Progress"] [data-stale="true"]')).toBeTruthy();  // ← removes marker
```
**Retarget in the SAME commit as D-02** (P23 aside precedent): assert size-change auto-fires a recompute,
last-good grid stays until the fresh one lands, no stale banner appears. KEEP the ME-01 imageless-guard
assertion ("Re-upload the source image…" — the guard still lives in `handleRecomputeMatch:595`).

**Deleted-Step assertions:** `App.test.tsx` and `integration.test.tsx` reference `Step1Ingest`/
`Step2Palette`/`Step4Export`; retarget/retire their Step-1/2/4 assertions when those files are deleted.
(`print.test.tsx` does NOT reference the deleted Steps — grep-clean; no retarget needed there.)
Do NOT retire assertions that exercise the preserved Step3Canvas fulfillment path.

---

## Shared Patterns

### Theme-remnant sweep scoping (D-01/D-09)
**Confident sweep scope ONLY:** `CanvasWorkspace.tsx` (D-09 map), the 3 deleted Step files, and
`safeStorage.removeItem('gempixel_theme')` (`App.tsx:198`, keep — idempotent). Anti-pattern: a global
`slate-*` find-replace (would hit guardrail-protected fulfillment modals). Change color tokens only;
never strip structural/sizing/aria attributes.

### Reuse-don't-rebuild (whole phase)
Every "new" behavior is a *trigger* or *class* change over tested machinery: `fitToContainer()` (fit
math), `handleRecomputeMatch`+`setMatchInputs` (fire-once worker), `beforeprint` hook (print fit),
two-phase loading overlay (pending UI), `setTimeout`/`clearTimeout` in a ref (debounce). Zero new deps
(CLAUDE.md §5 forbids panzoom/Fabric/jsPDF/scroll libs).

### Single-mount canvas never remounts (P20 D-14)
The D-05 re-zone and D-04 fit-mode change the canvas's position/scale, never its mount. The step-2
re-fit effect (`App.tsx:737`) must still fire post-restructure (Pitfall 4).

---

## SC10 Fulfillment Guardrail — frame-scope modal trace (Open-Q1 RESOLVED here)

Traced each frame-scope `slate-*` modal to its trigger:

| Modal (App.tsx) | Open state | Trigger | Classification | Action |
|-----------------|-----------|---------|----------------|--------|
| Checkout Warning (`:1931`) | `checkoutWarning` | set at `:1330` inside `handleShopifyCheckout` (`:1289`) → Diamond Drills USA cart via `compileShopifyCartLink` | **FULFILLMENT-COUPLED** | **PRESERVE untouched** (Phase 26) |
| Save Project (`:2029`) | `saveModalOpen` | `setSaveModalOpen(true)` at `:1517`/`:1593` (top-bar Save flow) | live Save feature (not fulfillment, not theme remnant) | **PRESERVE** — do not sweep as a remnant |
| Artist Resources (`:1835`) | `resourcesModalOpen` (`:216`) | **NO `setResourcesModalOpen(true)` anywhere in `src/`** — the only setters are `(false)` closes; trigger likely lived in a now-deletable Step | unreachable / dead, but uses `slate-*` | **PRESERVE when in doubt** — dead-code removal is NOT confidently non-fulfillment; defer any deletion to Phase 26 (matches CONTEXT preserve-when-in-doubt + A1) |

**Rule for the planner:** the confident theme sweep does NOT touch any of these three frame-scope
modals. Any diff hunk removing a `slate-*` class OUTSIDE `CanvasWorkspace.tsx` or the 3 deleted Step
files is a guardrail warning sign.

---

## No Analog Found

None. This is a modification/deletion phase — every edit's reference is the file's own current state
(excerpted above) plus a named prior-phase precedent (P24 D-05 viewer extension; P23 test-retargeting;
P20 D-13 soft-invalidate seam; P20 D-14 single-mount). No file requires an external analog or
RESEARCH.md fallback pattern.

## Metadata

**Analog search scope:** `src/engine/`, `src/features/wizard/`, `src/features/wizard/steps/`,
`src/features/screens/`, `src/__tests__/`, `src/App.tsx`.
**Files scanned:** viewer.ts, App.tsx (targeted ranges), AtelierShell.tsx, CanvasWorkspace.tsx,
RefineScreen.tsx, App.test.tsx, Step3Canvas.tsx (trigger trace), flags cross-check via grep.
**Pattern extraction date:** 2026-07-16
</content>
</invoke>
