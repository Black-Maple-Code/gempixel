# Phase 26: Interim Customer Fulfillment — Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 8 (2 modified core, 1 additive engine fn, 3 deletions, test retargeting)
**Analogs found:** 6 / 6 (all in-file / sibling analogs — this is a re-home + strangler-close phase, not net-new)

> This phase is dominated by **re-home + delete**, not greenfield. Every "new" surface has an exact
> existing analog living in the same file or a sibling. Copy those; introduce no new visual language,
> no new dependency, no new engine signature (the one additive `drawLegendOnly` export excepted, D-05).

---

## File Classification

| File | Change | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `src/engine/export.ts` | ADD `drawLegendOnly` | engine (renderer) | transform (data→canvas) | `drawCombinedCanvasSheet` legend loop, same file `:187–213` | exact (extract) |
| `src/features/screens/OrderScreen.tsx` | MODIFY — two task sections, per-task state | component (pure screen) | request-response (props-only) | in-file terminal `:257–277` + finish-card `:152–177` | exact |
| `src/App.tsx` | MODIFY — re-home 3 handlers as props, delete modals, re-token banner | provider (state owner) | event-driven / orchestration | existing `orderProps` wiring + `onDownloadPacket` handler | exact |
| `src/features/wizard/steps/Step3Canvas.tsx` | DELETE | component (legacy) | — | n/a — its `:268–317` block is the re-home reference | n/a |
| `src/features/screens/flags.ts` | DELETE | config | — | n/a — all 4 flags `true`, last branch gone | n/a |
| `src/__tests__/{App,integration,print}.test.tsx` | RETARGET | test | — | Phase 23 aside-retargeting precedent | role-match |
| `src/features/screens/__tests__/OrderScreen.test.tsx` | RETARGET terminal-state | test | — | in-file `:139–153` terminal test | exact |

---

## Pattern Assignments

### `src/engine/export.ts` — additive `drawLegendOnly` (engine renderer, transform)

**Analog:** the legend-draw loop inside `drawCombinedCanvasSheet` — same file, lines 181–213.
The new export factors out that exact swatch/symbol/label loop and returns an `HTMLCanvasElement`
(same shape as the other two renderers), so it downloads through `triggerCanvasDownload` unchanged.

**Options shape to mirror** (`export.ts:33–43`) — take the same `leftLegendColors` / `rightLegendColors`
inputs `drawCombinedCanvasSheet` uses; `drawLegendOnly` needs only those + `symbolMap` + `cellScale`
(no `gridData`/`cols`/`rows` — legend is grid-independent).

**Core loop to extract** (`export.ts:187–213`) — the swatch backing, black stroke, contrast symbol,
and 9px mono DMC label. This is the artifact-free path (D-05): a UI-layer crop of the combined sheet
would capture the full-width dashed folding-guides drawn at `:215–249` and re-derive 6 private layout
constants — rejected.

```typescript
allLegendColors.forEach((item, index) => {
  const colIdx = Math.floor(index / itemsPerCol);
  const rowIdx = index % itemsPerCol;
  const x = startX + 10 + colIdx * colSpacing;
  const y = legendOffsetY + topPadding + rowIdx * itemHeight + itemHeight / 2;
  const symbol = symbolMap[item.dmc] || '';
  ctx.fillStyle = item.hex;
  ctx.fillRect(x, Math.round(y - 5), 10, 10);
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
  ctx.strokeRect(x, Math.round(y - 5), 10, 10);
  ctx.fillStyle = getContrastColor(item.hex);
  ctx.font = `bold ${symbolFontPx(8, symbol)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(symbol, x + 5, y);
  ctx.fillStyle = '#000000'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
  ctx.fillText(item.dmc, x + 18, y);
});
```

**Canvas-creation boilerplate to copy** (`export.ts:141–150`): `document.createElement('canvas')`,
set `width`/`height` from the legend column metrics (`numCols`, `itemsPerCol`, `itemHeight`,
`topPadding` computed at `:120–125`), get `2d` context with the `if (!ctx) throw` guard, paint white
backing. Size the canvas to the legend band only — do NOT reuse the grid-inclusive `canvasWidth`.

**Deviation to record in PLAN (D-05):** this is the one sanctioned engine addition. It adds an export;
it does not touch `drawCanvasOnly`, `drawCombinedCanvasSheet`, or `triggerCanvasDownload` signatures
(the Phase-22 freeze). If extraction would force a signature change on `drawCombinedCanvasSheet`, fall
back to two PNGs + the existing `printLegendSheetOnly` path and record the SC1 trim.

---

### `src/App.tsx` — re-home 3 handlers + delete + re-token (provider, orchestration)

**The three handlers STAY in App** (App owns state, P20 D-01) — only their call site moves from
`Step3Canvas` props to `OrderScreen` props. They are already `async` and already `setActionError`-guarded.

**Handler pattern to keep verbatim** (`App.tsx:1003–1025`, `handleDownloadCanvasOnly`):

```typescript
const handleDownloadCanvasOnly = async () => {
  if (!matchResult) return;
  setActionError(null);
  try {
    const colorMap = new Map<string, string>();
    activeCandidates.forEach(c => colorMap.set(c.dmc, c.hex));
    const canvas = drawCanvasOnly({ cols: matchCols, rows: matchRows,
      gridData: matchResult.matches, colorMap, symbolMap, cellScale: 20 });
    const baseName = saveProjectName.trim() || 'gempixel-layout';
    await triggerCanvasDownload(canvas, `${baseName}-canvas.png`);
  } catch (err) {
    console.error('Failed to download canvas grid:', err);
    setActionError('Could not generate the download. Please try again.');
  }
};
```

- Add a third sibling `handleDownloadLegend` on this exact template, calling the new `drawLegendOnly`
  and downloading `${baseName}-legend.png` (D-03 filenames).
- `handleDownloadCombinedCanvasSheet` (`:1027–1052`) uses `-grid-legend.png` — same template.
- **Download spacing (D-03, Claude's discretion):** if wiring a single "download all canvas artifacts"
  path, `await` each `triggerCanvasDownload` in sequence (it already resolves after a 100ms
  `setTimeout` in `export.ts:282`); add a small extra delay if Safari/Firefox drop rapid downloads.

**Cart handler** (`App.tsx:1214–1259`, `handleShopifyCheckout`) — re-home as the section-② `onCartCheckout`
prop. It calls `compileShopifyCartLink(items, affiliateTag, affiliateApp, priceDb)` (`checkout.ts:33`)
and `window.open(result.url, '_blank', 'noopener,noreferrer')`. **Note the coupling:** it currently
sets `checkoutWarning` (`:1254–1255`) which drives the Checkout Warning modal being deleted (D-08) —
plan how the too-long-URL / unmapped-items branch surfaces once that modal is gone (likely via the
re-tokened `actionError` banner). This is the one non-trivial re-home; trace it fully before cutting.

**Panel-3 collapse** (`App.tsx:1614–1647`): drop the `USE_NEW_SUPPLIES ? SuppliesScreen : Step3Canvas`
ternary to `<SuppliesScreen {...suppliesProps} />` only; delete the `Step3Canvas` import (`:19`).

**Delete coupled `slate-*` modals:** Artist Resources (`:1660–~1750`) and Checkout Warning
(`:1757–~1850`) — both are dark-slate remnants tied to the removed fulfillment path (D-08).

**Error-banner re-token (D-08, the only user-visible remnant).** Current banner (`App.tsx:1510–1512`):

```jsx
<div className="fixed top-16 left-1/2 z-[60] ... rounded-lg border border-rose-500/60
     bg-rose-950/95 px-4 py-2.5 text-xs font-medium text-rose-100 no-print shadow-lg backdrop-blur">
  <span>{actionError}</span>
```

Re-token to the Atelier warn-on-light recipe from UI-SPEC: `border border-warn text-warn bg-panel-2`.
There are **two** dark banners — also the match-error banner at `:1506` (`border-rose-500/60
bg-rose-950/90 text-rose-100`). **Grep-gate (hard):** after edit, no `bg-slate-9(00|50)`, no
`text-white`, no `rose-950` on any live (non-print) surface.

---

### `src/features/screens/OrderScreen.tsx` — two task sections + per-task state (pure component)

**Analog:** the screen's own existing terminal and finish-card patterns. Everything here is a clone of
in-file precedent — no new primitive (UI-SPEC "reuse-only").

**Prop pattern to extend** (`OrderScreen.tsx:63–66`) — retire the single `packetDownloaded: boolean`
+ `onDownloadPacket` for a per-task-state model (D-07). Add props mirroring `onDownloadPacket` exactly:
`onDownloadCanvasGrid`, `onDownloadGridLegend`, `onDownloadLegend`, `onCartCheckout`, and a per-task
state object (e.g. `{ canvasDownloaded, cartOpened }`) replacing `packetDownloaded`. All are App-owned
handlers passed into the pure screen — same precedent as `onDownloadPacket`.

**Done-state / terminal panel to CLONE ×2** (`OrderScreen.tsx:257–277`):

```jsx
{packetDownloaded ? (
  <div data-testid="order-terminal"
    className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-accent bg-[#EAF2EF] p-4">
    <span className="text-sm font-semibold text-accent">Packet downloaded.</span>
    <span className="text-xs leading-relaxed text-muted">Take this file to your vendor ...</span>
  </div>
) : (
  <Button variant="primary" className="w-full py-2.5 text-sm" onClick={onDownloadPacket}>
    Download order packet
  </Button>
)}
```

Clone into two independent per-task sub-terminals (D-07): section ① "Downloaded ✓" (fires once the
canvas files download), section ② "Cart opened ↗" (fires after the cart opens). The two are
independent — one done while the other is not. Copy the exact `border-accent bg-[#EAF2EF] p-4` panel
recipe and `Button variant="primary"` CTA; use the UI-SPEC copy table verbatim.

**Section heading recipe** (`OrderScreen.tsx:149`, the `<legend>` eyebrow): the two task-section
headers reuse `font-mono text-[10px] uppercase tracking-wider text-faint` — no serif display heading
inside the card (UI-SPEC Typography).

**Section layout:** keep the existing two-column shell `flex ... gap-6 md:flex-row` (`:88`); the two
task groups live in the right column (`bg-panel-2 p-6`, `:146`) as `gap-6`-separated stacks — do NOT
introduce a flat button list (the retired `Step3Canvas` "Order & Actions" stack, D-07).

**Button primitive** (`src/ui/Button.tsx`): `variant="primary"` → `bg-accent text-on-accent
hover:brightness-110`, `rounded-[var(--radius-control)]`. All 4 downloads + the cart CTA use it.
(Note: real variants are `'primary' | 'save' | 'ghost'` — `primary` is correct here.)

---

### DELETIONS

- `src/features/wizard/steps/Step3Canvas.tsx` — DELETE (D-02). Its fulfillment block (`:268–317`,
  the `slate-*` "Order & Actions" button stack calling all 4 handlers + `printLegendSheetOnly` +
  `printReport`) is the reference for what re-homes — read it, then delete the file.
- `src/features/screens/flags.ts` — DELETE (D-02). All four exports are `true`; the last legacy
  branch (panel 3) collapses to `SuppliesScreen`. Also delete/retarget `__tests__/flags.test.ts`.

---

### TEST RETARGETING (deletion blast radius)

**Analog:** the Phase 23 aside test-retargeting precedent (referenced in CONTEXT).

- `src/features/screens/__tests__/OrderScreen.test.tsx` (`:65–66`, `:139–153`) — update the
  `packetDownloaded` default + the "shows the honest terminal state ONLY on packetDownloaded" test
  to the per-task state (two independent sub-terminals). New `data-testid`s for the two done panels;
  keep the "never Place order / no receipt" honesty assertions.
- `src/__tests__/{App,integration,print}.test.tsx` — retarget assertions coupled to `Step3Canvas`
  onto the re-homed Order fulfillment path; **preserve** assertions now exercised via OrderScreen.
- `src/features/screens/__tests__/flags.test.ts` — retire with `flags.ts`.
- Suite stays green at every commit (D-02): re-home (add) before delete.

---

## Shared Patterns

### Canvas download (reuse verbatim)
**Source:** `src/engine/export.ts:260` `triggerCanvasDownload(canvas, filename)`
**Apply to:** all 3 PNG handlers. Blob → object-URL → anchor click → deferred `revokeObjectURL`.
Returns a `Promise` that resolves after a 100ms `setTimeout` — the natural sequencing point for D-03.

### App-owned handler → pure screen prop
**Source:** `OrderScreen.tsx:63` `onDownloadPacket` prop wired in App to a Blob download.
**Apply to:** every new PNG/cart handler. App stays the state owner (P20 D-01); the screen owns no
domain state and does no cents math.

### Single-source quote / bag plan (cart can't diverge)
**Source:** `App.tsx:1070` `planOrderSupply(...)` → the one `orderPlan`; cart via `compileShopifyCartLink`
(`checkout.ts:33`) packs each color with the SAME `bagPlanner.packColor` + `priceDb`.
**Apply to:** section-② cart wiring (D-01) — one call site, structurally == the displayed legend/quote.

### Atelier tokens (no new visual language)
**Source:** `OrderScreen.tsx` existing classes + `src/index.css` `@theme inline`.
**Apply to:** all new surfaces. Done panels `border-accent bg-[#EAF2EF] p-4`; eyebrows
`font-mono text-[10px] uppercase tracking-wider text-faint`; error banner `border-warn text-warn
bg-panel-2`. `Pill` (`src/ui/Pill.tsx`) for LOCKED / unavailable / done badges.

---

## No Analog Found

None. Every surface has an exact in-file or sibling analog. The sole "new" code — `drawLegendOnly` —
is an extraction of `drawCombinedCanvasSheet`'s own legend loop, not a novel pattern.

---

## Metadata

**Analog search scope:** `src/engine/` (export.ts, checkout.ts), `src/features/screens/`,
`src/features/wizard/steps/`, `src/ui/`, `src/__tests__/`, `src/App.tsx`.
**Files scanned:** 9 read + targeted greps.
**Line numbers:** verified against live source 2026-07-16 (CONTEXT numbers confirmed accurate;
`handleShopifyCheckout` at `:1214`, handlers at `:1003`/`:1027`, terminal at `:257–277`, panel-3
ternary at `:1614–1647`, error banner at `:1510`).
