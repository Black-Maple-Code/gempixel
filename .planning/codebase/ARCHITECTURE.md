<!-- refreshed: 2026-07-12 -->
# Architecture

**Analysis Date:** 2026-07-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     UI Layer (Preact)                        │
├──────────────────┬──────────────────┬───────────────────────┤
│   App shell      │  Wizard steps    │   Viewport HUD        │
│  `src/App.tsx`   │ `src/features/   │  (canvas controls in  │
│                  │   wizard/steps/` │   App.tsx)            │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Feature Hooks (Preact)                     │
│  `src/features/match/useDiamondArtMatch.ts`                  │
│  `src/features/wizard/useWizard.ts`                          │
└────────┬────────────────────────────────────────────────────┘
         │  posts pixels / receives matched grid
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Engine (pure TS, no DOM*)                   │
│  color · ingest · palette · candidates · smoothing ·         │
│  symbols · bagPlanner · checkout · export · variants ·       │
│  projectStore · viewer                                       │
│  `src/engine/*.ts`                                           │
└────────┬───────────────────────────────┬────────────────────┘
         │  heavy match offloaded         │  persistence
         ▼                                ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  Web Worker              │   │  Browser localStorage         │
│ `matcher.worker.ts`      │   │ (projectStore + recents)      │
│  + `worker-client.ts`    │   │                               │
└──────────────────────────┘   └──────────────────────────────┘
```

\*`viewer.ts` and `export.ts` intentionally touch Canvas/DOM; the rest of the engine is pure logic.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App shell | Root state store, panel/HUD layout, wizard/step composition, persistence wiring | `src/App.tsx` |
| Match hook | Owns image→grid pipeline: worker match, low-count substitution, smoothing, symbol allocation | `src/features/match/useDiamondArtMatch.ts` |
| Wizard hook | 4-step state machine (`step`, `canEnter`, `next`/`back`/`goTo`/`reset`) | `src/features/wizard/useWizard.ts` |
| Wizard steps | Per-step UI (ingest, palette, canvas, export) | `src/features/wizard/steps/Step[1-4]*.tsx` |
| Color engine | sRGB→Lab conversion, CIEDE2000 matching, alpha blend, low-count substitution | `src/engine/color.ts` |
| Ingest | Physical→grid dimensioning, crop bounds, box-sampling downscale | `src/engine/ingest.ts` |
| Palette | Static DMC / Art Dot catalogs (100 & 200 kits) | `src/engine/palette.ts` |
| Candidates | Resolve active color set from kit + exclusions (pure, memoizable) | `src/engine/candidates.ts` |
| Smoothing | Spatial cleanup — dissolve orphan drills, straighten region edges | `src/engine/smoothing.ts` |
| Symbols | Symbol allocation per color, contrast color | `src/engine/symbols.ts` |
| Bag planner | Supply/packet planning, safety margins, packet pricing | `src/engine/bagPlanner.ts` |
| Checkout | Shopify cart links, canvas-vendor URLs, cost calc, vendor registry | `src/engine/checkout.ts` |
| Export | Canvas-only + combined print sheets, download trigger | `src/engine/export.ts` |
| Viewer | Interactive Canvas 2D zoom/pan/render with LOD & view modes | `src/engine/viewer.ts` |
| Project store | localStorage persistence for projects + recent images | `src/engine/projectStore.ts` |
| Worker client | Main-thread proxy to the matcher worker (abort, cache-hash, callbacks) | `src/engine/worker-client.ts` |
| Matcher worker | Off-thread per-pixel color matching with RGBA cache & progress | `src/engine/matcher.worker.ts` |

## Pattern Overview

**Overall:** Client-side, single-page app with a pure engine core and a thin Preact UI shell. Heavy computation is isolated behind a Web Worker; all state is in-memory or localStorage.

**Key Characteristics:**
- Pure engine / thin UI split — engine modules avoid Preact and (mostly) the DOM, making them unit-testable in isolation.
- Feature hooks encapsulate stateful workflows (`useDiamondArtMatch`, `useWizard`) so `App.tsx` composes signals instead of touching the worker directly.
- Concurrency isolated behind `MatcherClient`: abort-on-new-input and palette-hash cache reuse live in the client/worker pair, invisible to the UI.

## Layers

**UI Layer:**
- Purpose: Render wizard, panels, viewport HUD; collect user inputs.
- Location: `src/App.tsx`, `src/features/wizard/steps/`
- Contains: Preact components (`.tsx`), event handlers, layout state.
- Depends on: Feature hooks, engine modules.
- Used by: `src/main.tsx` (mounts `<App/>`).

**Feature Hook Layer:**
- Purpose: Orchestrate stateful workflows and expose read-only signal surfaces.
- Location: `src/features/match/`, `src/features/wizard/`
- Contains: Preact hooks (`use*`).
- Depends on: Engine modules, `MatcherClient`.
- Used by: `App.tsx`.

**Engine Layer:**
- Purpose: All domain logic — color science, ingest, planning, export, persistence.
- Location: `src/engine/`
- Contains: Pure TS functions/classes, static data, the worker.
- Depends on: `culori` (color), browser APIs (only in `viewer`, `export`, `projectStore`, ingest pixel helpers).
- Used by: Feature hooks, `App.tsx`.

**Worker Layer:**
- Purpose: Off-main-thread per-pixel matching.
- Location: `src/engine/matcher.worker.ts` (+ `worker-client.ts` proxy)
- Contains: Message-driven matching loop with cooperative yielding.
- Depends on: `color.ts`.
- Used by: `useDiamondArtMatch` via `MatcherClient`.

## Data Flow

### Primary Request Path (image → matched grid)

1. User loads an image; `App.tsx` sets `image` state (`src/App.tsx:67`).
2. `useDiamondArtMatch` extracts pixels (`getImagePixels`, downscale ≤2000px) and box-samples to `cols×rows` (`src/features/match/useDiamondArtMatch.ts:100`, `src/engine/ingest.ts:75`).
3. `MatcherClient.match` posts `{abort}` then `{match, pixels, candidates, clearCache, cols}` to the worker (`src/engine/worker-client.ts:11`).
4. Worker matches each pixel via CIEDE2000, using a quantized RGBA→DMC cache, yielding every ~5% for progress (`src/engine/matcher.worker.ts:30`).
5. Worker posts `{result, matches, counts}`; client resolves `onComplete` → `setRawMatchResult` (`src/engine/worker-client.ts:34`).
6. Hook derives final grid: low-count substitution then spatial smoothing, then symbol allocation, via memoized selectors (`useDiamondArtMatch.ts:130-167`).
7. `App.tsx` feeds `matches`/`symbolMap` into `CanvasViewer` for rendering.

### Persistence Flow (save / restore project)

1. `App.tsx` serializes project + grid to `ProjectData`; `projectStore.save` writes to localStorage with oldest-project eviction on quota (`src/engine/projectStore.ts:107`).
2. On load, `projectStore.load` returns `ProjectData`; App injects the raw grid via `restore()` — no worker run (`useDiamondArtMatch.ts:169`).

**State Management:**
- Root UI state is `useState` in `App.tsx` (many independent atoms).
- Workflow state lives in feature hooks.
- Persistent state is localStorage via `projectStore`.

## Key Abstractions

**DmcColor:**
- Purpose: A catalog color with RGB + precomputed Lab + kit membership.
- Examples: `src/engine/types.ts`, `src/engine/palette.ts`
- Pattern: Plain interface; identity is the `dmc` string code.

**Active candidates:**
- Purpose: The color set "in play" for matching (kit filter minus exclusions).
- Examples: `src/engine/candidates.ts`
- Pattern: Pure resolver, memoized in `App.tsx`; keyed by joined `dmc` codes.

**RawMatch / MatchState:**
- Purpose: The worker's grid result and the hook's derived signal surface.
- Examples: `src/features/match/useDiamondArtMatch.ts:20`
- Pattern: Read-only signals + one imperative `restore()` seam.

**MatcherClient:**
- Purpose: Encapsulate worker lifecycle, abort, and palette-hash cache reuse.
- Examples: `src/engine/worker-client.ts`
- Pattern: Thin class wrapping a `Worker`.

## Entry Points

**Application mount:**
- Location: `src/main.tsx`
- Triggers: Page load; `index.html` loads the module.
- Responsibilities: `render(<App/>, #app)`.

**Web Worker:**
- Location: `src/engine/matcher.worker.ts`
- Triggers: `new Worker(new URL('...matcher.worker.ts', import.meta.url))` in the match hook.
- Responsibilities: Message-driven color matching.

## Architectural Constraints

- **Threading:** Single main thread + one dedicated matcher Web Worker. Worker yields via `setTimeout(0)` every ~5% to keep progress responsive and honor aborts.
- **Global state:** Worker holds module-level `rgbaCache` and `isAborted` (`matcher.worker.ts:8-10`); `color.ts` holds a Lab cache cleared via `clearCache()`. `projectStore` is a singleton object over localStorage.
- **Circular imports:** None observed; dependencies flow UI → hooks → engine.
- **Privacy:** No image or user data leaves the client — no network image upload. All persistence is localStorage.

## Anti-Patterns

### App.tsx as a mega-component

**What happens:** `src/App.tsx` (~2250 lines) holds dozens of `useState` atoms and most layout/HUD logic.
**Why it's wrong:** High cognitive load; state changes are hard to trace and easy to regress.
**Do this instead:** Continue extracting cohesive workflows into feature hooks (as done with `useDiamondArtMatch`/`useWizard`) and push presentational chunks into step/panel components.

### Reaching into the worker from the UI

**What happens:** Earlier code drove the worker directly from the App.
**Why it's wrong:** Leaks concurrency/abort/cache concerns into the view.
**Do this instead:** Route all matching through `useDiamondArtMatch` + `MatcherClient` (`src/features/match/useDiamondArtMatch.ts`).

## Error Handling

**Strategy:** Defensive, non-throwing at boundaries — pixel/context failures and storage quota are caught and logged; UI degrades rather than crashes.

**Patterns:**
- `try/catch` around canvas context acquisition and match dispatch (`useDiamondArtMatch.ts:107`).
- Worker posts `{kind:'error'}` on match failure; client logs it (`matcher.worker.ts:22`, `worker-client.ts:36`).
- `projectStore` catches quota errors and evicts the oldest project before retrying (`projectStore.ts:119`).

## Cross-Cutting Concerns

**Logging:** `console.error` at failure boundaries; no logging framework.
**Validation:** TypeScript types + wizard `canEnter` gating (`useWizard.ts:28`); pure resolvers validate shape by construction.
**Authentication:** None — fully local, no accounts.

---

*Architecture analysis: 2026-07-12*
