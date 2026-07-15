# Phase 24: Mobile Responsive + Touch Pass - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 6 (all MODIFIED, none created)
**Analogs found:** 6 / 6 (each file's own current source is the primary analog — additive pass)

> **Framing:** Phase 24 is a purely additive layout + touch pass. Every file below is MODIFIED in place; there are no new files, no new screens, no engine signature changes. The "closest analog" for each is therefore the file's own current code (the exact excerpts the executor extends). Two mechanisms in this phase — Tailwind v4 `@container` container queries and canvas `touch-action: none` — are **first-use in this codebase** (Grep across `**/*.{ts,tsx,css}` for `@container`, `container-type`, `@max-[`, `@max-2xl`, `touch-action`, `touch-none`, `activePointers` returned **zero matches**). The planner should treat these as net-new patterns with no prior in-repo analog; the sibling patterns they attach to (Pointer Events, flex layout, responsive class overrides) are established.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/engine/viewer.ts` | engine (canvas viewer class) | event-driven (pointer/wheel) | self (current Pointer Events handlers) | exact / self |
| `src/features/wizard/AtelierShell.tsx` | component (shell chrome) | request-response (props-only) | self (root `<div>` box) | exact / self |
| `src/App.tsx` | store/orchestrator (sole state owner) | event-driven + layout | self (shell body `<div>` + `<main>`) | exact / self |
| `src/features/screens/RefineScreen.tsx` | component (controls rail) | request-response (props-only) | self (root `<section>`) | exact / self |
| `src/features/wizard/CanvasWorkspace.tsx` | component (canvas + HUD) | request-response (props-only) | self (zoom HUD buttons) | exact / self |
| `src/index.css` | config (global stylesheet) | n/a (static CSS) | self (`@media max-width:767.98px` blocks) | exact / self |

## First-Use Pattern Note (analog search result)

- **Container queries (`@container` / `container-type: inline-size` / `@max-[640px]:*` / `@max-2xl:*`):** NOT present anywhere in the codebase today. Phase 24 introduces the first usage. No in-repo precedent to copy — follow Tailwind v4 docs + D-01/D-02. Existing responsive precedent is **viewport** `@media (max-width:767.98px)` in `index.css` (which this phase is partly deleting), NOT container queries.
- **`touch-action` / `touch-none`:** NOT present anywhere today. First use is D-06 on the canvas element. No analog.
- **Multi-touch / `activePointers`:** NOT present. The current viewer is single-pointer only. D-05 extends the existing single-pointer handlers.

---

## Pattern Assignments

### `src/engine/viewer.ts` (engine, event-driven) — D-05 + D-06

**Analog:** self. The pinch branch extends these exact current-state handlers. Public zoom API (`handleZoom`, `zoomIn/Out`, `fitToContainer`, `onZoomChange`) and the `0.5–50` clamps stay unchanged — pinch **reuses** them.

**Single-pointer drag state fields** (lines 20-22) — pinch adds an `activePointers` map alongside these; do not remove `isDragging`/`lastPointerX/Y` (single-finger + mouse pan keeps using them):
```typescript
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
```

**`setupListeners` / `destroy`** (lines 54-68) — canvas-only `touch-action` (D-06) is set here (or in constructor). `wheel` is the only `{passive:false}` listener; keep it:
```typescript
  private setupListeners() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }
```
> D-06 add: `this.canvas.style.touchAction = 'none';` (constructor or setupListeners). Not the workspace frame — canvas element only.

**Pointer handlers — the extension seam** (lines 70-111). Note the existing `setPointerCapture` try/catch guard (jsdom-safe) that D-05 must preserve; when a 2nd pointer arrives, don't let pointer-1's capture swallow it (skip capture while pinching or capture both ids):
```typescript
  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore failure in environments that do not support pointer capture fully (e.g. test environment stubs)
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.offsetX += dx;
    this.offsetY += dy;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.draw();
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (err) { /* Ignore */ }
  };

  private handlePointerCancel = (e: PointerEvent) => { /* mirrors Up */ };
```
> D-05 adds: `private activePointers = new Map<number, {x:number,y:number}>();` — set on down, update on move, delete on up/cancel. Gate the pinch branch on `activePointers.size === 2` (jsdom never dispatches two live pointers, so the suite stays green).

**`handleWheel` — the canvas-local-coords pattern pinch must mirror** (lines 113-122). Pinch computes midpoint the same way (`clientX - rect.left`, `clientY - rect.top`):
```typescript
  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    this.handleZoom(mouseX, mouseY, zoomFactor);
  };
```

**`handleZoom` — the cursor-anchored math pinch feeds** (lines 124-141). Pinch calls `handleZoom(midX, midY, currentDist / prevPinchDist)` — same `minScale 0.5 / maxScale 50` clamps, same `onZoomChange`:
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
    if (this.onZoomChange) this.onZoomChange(this.scale);
  }
```

---

### `src/features/wizard/AtelierShell.tsx` (component, props-only) — D-01

**Analog:** self. The `container-type` MUST live on this real full-width box (the shell body below is `display:contents` and generates no box; the flex-row body can't query its own width). Add `@container` / `container-type: inline-size` to this exact root `<div>` (line 52). No new DOM nodes.

**Root box to modify** (line 52):
```tsx
    <div className="flex flex-col h-dvh overflow-hidden print:h-auto print:overflow-visible">
```
> D-01: add Tailwind v4 `@container` (which emits `container-type: inline-size`) to this className. The query then reaches `RefineScreen`'s root (a genuine flex-item descendant via the App shell body). PURE/props-only — owns no state; nothing else in this file changes.

---

### `src/App.tsx` (store/orchestrator) — D-01 + D-03

**Analog:** self. App stays sole state owner (Phase 20 D-01); this is CSS-class + JSX-reorder only. Single-mount `<CanvasViewer>` is only reordered, never conditionally mounted (D-14).

**Shell body flex-row → flex-col flip** (line 1612) — receives `@max-[640px]:flex-col` (D-01). Do NOT re-home its `min-h-0`/`justify-center` sizing utilities:
```tsx
        <div className="flex min-h-0 flex-1 flex-row justify-center">
```

**Single-mount canvas `<main>`** (line 1619) — shown only on step 2, `display:none` otherwise (D-14). The sticky Refine canvas wrapper (D-03, `sticky top-0 h-[45dvh]` on `@max-[640px]`) attaches at/around this `<main>`; `position:sticky` works because the `h-dvh overflow-hidden` body is the single scroll region:
```tsx
          <main className={wizard.step === 2 ? 'relative flex min-w-0 flex-1 flex-col print:block' : 'hidden'}>
            <CanvasWorkspace canvasRef={canvasRef} … />
          </main>
```

**`data-step-panel` sibling wrappers** (line 1641+) — the `display:contents` (`'contents no-print'` when active, `'hidden'` when not) transparency is why each screen's OWN root is the flex item (so the container query reaches RefineScreen's `<section>`). Preserve this — it is load-bearing for D-01:
```tsx
        <div data-step-panel="1" className={wizard.step === 1 ? 'contents no-print' : 'hidden'}>
```

---

### `src/features/screens/RefineScreen.tsx` (component, props-only) — D-01 + D-03 order

**Analog:** self. Root rail relaxes `w-[360px]` → `w-full` on `@max-[640px]` (D-01). This root is a genuine flex-item descendant of the AtelierShell container box, so the container query reaches it.

**Root `<section>` to modify** (lines 106-109):
```tsx
    <section
      data-screen="refine"
      className="flex w-[360px] max-w-full flex-col gap-6 border-l border-border bg-panel p-6 text-ink"
    >
```
> D-01: add `@max-[640px]:w-full` (and, per D-03, the mobile column may drop `border-l`). Desktop base `w-[360px]` untouched.

**Controls order (D-03 — reflowed column follows this existing desktop rail order):**
1. SizeCards (Size section, `sizePresets.map` → `<SizeCard>`, lines 110-128)
2. Custom-size disclosure (`customOpen` toggle → width/height number inputs, lines 130-170) — **mobile-keyboard collision risk noted in D-03**: these numeric inputs under a 45dvh sticky pane are the documented fallback trigger (drop `sticky` → non-sticky canvas-first if cramped).
3. Rail-local stale cue (lines 172-180+)
4. edge-cleanup SegmentedControl → color Slider → Advanced disclosure (further down the same `<section>`)

---

### `src/features/wizard/CanvasWorkspace.tsx` (component, props-only) — MOBILE-02 (buttons already exist) + Claude's-discretion re-token

**Analog:** self. The zoom HUD buttons already satisfy MOBILE-02's "on-screen zoom buttons"; touch-ergonomics (44px targets / Atelier re-token) is Claude's discretion.

**Zoom HUD buttons — current small `p-1.5` tap targets + legacy `slate-*` classes** (lines 112-148) — the re-token/enlarge candidates:
```tsx
          {(viewportMode === 'grid' || viewportMode === 'symbols') && (
            <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
              <div className="tooltip-group">
                <button
                  onClick={() => onZoomIn()}
                  aria-label="Zoom In"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-355 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                >
                  ➕
                </button>
                <div className="tooltip-box">Zoom In</div>
              </div>
              {/* Zoom Out (➖) and Fit (⛶) mirror the same p-1.5 / slate-* pattern, lines 126-147 */}
            </div>
          )}
```
> Note: `text-slate-355` (line 119/130/141) is a non-standard token in the current source — if re-tokening, this is a pre-existing oddity to normalize. MOBILE-02 only requires the buttons exist and aid touch zoom (they do); enlarging is optional.

**HUD outer wrapper class** (line 85): `className="viewport-hud no-print"` — driven by the `.viewport-hud` CSS rule in `index.css` (see below); the mobile override for it is PRESERVED.

**Bottom hint pill** (lines 220-223): `"drag to pan · scroll to zoom · … drills"` — copy that may want a touch-aware variant (e.g. "pinch to zoom") on mobile; Claude's discretion, not required.

---

### `src/index.css` (config) — D-04

**Analog:** self. Regression-critical delete-vs-keep boundary. The `@media (max-width:767.98px)` block at **lines 497-536** and the one at **lines 565-575** are DIFFERENT blocks.

**DELETE (dead drawer CSS, lines 497-536)** — the `aside`, `aside.w-96`, `aside.w-0`, `.drawer-backdrop` rules (dead since Phase 23 removed all `<aside>` drawer elements; new screens use plain `<div>`). The `main { padding-bottom: 4.5rem }` rule inside is also part of the abolished drawer/bottom-bar model:
```css
@media (max-width: 767.98px) {
  aside { position: fixed !important; … width: 100vw !important; … }
  aside.w-96 { width: 100vw !important; }
  aside.w-0 { width: 0 !important; display: none !important; }
  main { padding-bottom: 4.5rem !important; }
  .drawer-backdrop { position: fixed; inset: 0; z-index: 44; … }
}
```

**PRESERVE (still-live, lines 564-575)** — the SEPARATE mobile `.viewport-hud` override block. Do NOT delete; the HUD is rendered live by CanvasWorkspace:
```css
/* Mobile overrides for Viewport HUD — sit above the bottom tab bar */
@media (max-width: 767.98px) {
  .viewport-hud {
    top: auto;
    bottom: 96px;
    transform: translateX(-50%);
    width: 90%;
    max-width: 400px;
    justify-content: center;
    gap: 8px;
  }
}
```
> Boundary: scope the edit to the named `aside` / `.drawer-backdrop` (and the drawer-era `main` padding) selectors in the 497-536 block. The base `.viewport-hud` rule (lines 545-562) and its mobile override (565-575) both stay.

---

## Shared Patterns

### Established: Pointer Events as the single input model
**Source:** `src/engine/viewer.ts` lines 54-111
**Applies to:** the touch work (D-05). Mouse/pen/touch already flow through one set of handlers; multi-touch extends them rather than adding a parallel Touch Events API (which CLAUDE.md's no-dependency / browser-native convention favors).

### Established: responsive = descendant-only overrides, base classes untouched
**Source:** the base classes at `AtelierShell.tsx:52`, `App.tsx:1612`, `RefineScreen.tsx:108`
**Applies to:** D-01/D-02. Desktop base (`flex-row`, `w-[360px]`) is provably unregressed because container queries add only `@max-[640px]:*` descendant overrides that fire below ~640px — well under any desktop container width.

### Established: jsdom test discipline
**Source:** `src/engine/viewer.ts` `setPointerCapture` try/catch (lines 75-79, 96-100, 106-110); defensive `getBoundingClientRect()` (line 115)
**Applies to:** D-05. Keep capture in try/catch; gate the real-touch pinch branch on `activePointers.size === 2` so jsdom (single synthetic pointers only) never enters it.

### Established: single-mount viewer never remounts (Phase 20 D-14)
**Source:** `App.tsx:1619` `<main>` (display-toggled, always rendered) + `CanvasWorkspace.tsx` canvas (never gated behind a step conditional)
**Applies to:** D-03. The Refine mobile reflow only REORDERS the one `<CanvasViewer>` into a `sticky` pane — it is never conditionally mounted/unmounted per breakpoint.

## No Analog Found

No files lack an analog (every in-scope file is its own analog). However, these **mechanisms** have zero in-repo precedent and must follow external docs / the CONTEXT decisions rather than a copied pattern:

| Mechanism | Where introduced | Reason no analog |
|-----------|------------------|------------------|
| Tailwind v4 `@container` / `container-type` / `@max-[640px]:*` | AtelierShell root, App shell body, RefineScreen root | First container-query use in the codebase (Grep: 0 matches). Prior responsive work is viewport `@media`, not container queries. |
| `touch-action: none` (canvas-only) | viewer.ts canvas element | First `touch-action`/`touch-none` use (Grep: 0 matches). |
| `activePointers` multi-touch / pinch | viewer.ts pointer handlers | Viewer is currently single-pointer only; no multi-touch precedent. |

## Metadata

**Analog search scope:** `src/engine/`, `src/features/wizard/`, `src/features/screens/`, `src/App.tsx`, `src/index.css`
**Files scanned / read:** viewer.ts (full), AtelierShell.tsx (full), RefineScreen.tsx (root region L100-180), CanvasWorkspace.tsx (full), App.tsx (shell body L1600-1680), index.css (L485-585). Codebase-wide Grep for container-query / touch-action / activePointers tokens.
**Pattern extraction date:** 2026-07-15
</content>
</invoke>
