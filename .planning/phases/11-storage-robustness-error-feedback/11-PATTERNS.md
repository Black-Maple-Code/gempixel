# Phase 11: Storage Robustness & Error Feedback - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 7 (4 new, 3 modified)
**Analogs found:** 7 / 7 (all have in-repo analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engine/safeStorage.ts` (new) | utility (pure engine module) | transform / file-I/O (localStorage) | `src/engine/checkout.ts`, `src/engine/color.ts` | role-match (pure named-export module) |
| `src/hooks/usePersistentState.ts` (new) | hook | request-response (state↔storage) | `src/features/match/useDiamondArtMatch.ts` | role-match (Preact hook w/ useState+useEffect) |
| `src/engine/__tests__/safeStorage.test.ts` (new) | test (unit) | — | `src/engine/__tests__/checkout.test.ts` | exact (Vitest engine unit test) |
| `src/hooks/__tests__/usePersistentState.test.ts` (new) | test (unit) | — | `src/engine/__tests__/checkout.test.ts` + jsdom seeding from `App.test.tsx` | role-match (hook unit test) |
| `src/App.tsx` (modified) | component (orchestrator) | request-response + event-driven | existing banners `App.tsx:1655/1666`; existing lazy-init state `App.tsx:97-215` | exact (self-analog) |
| `src/features/wizard/steps/Step3Canvas.tsx` (modified) | component (presentational) | event-driven (button) | existing `removeItem` call at `Step3Canvas.tsx:395` | exact (self-analog) |
| `src/__tests__/App.test.tsx` (modified) | test (integration/render) | — | existing `App.test.tsx` mount + storage-seed cases | exact (self-analog) |

## Pattern Assignments

### `src/engine/safeStorage.ts` (utility, pure module)

**Analog:** `src/engine/checkout.ts` — pure, side-effect-free, named-export-only engine module with JSDoc per export. No Preact import.

**Module/export shape** (`checkout.ts:1-38`): relative-path imports at top, then `export interface`, then `export function` / `export const` — named exports only, no default. Each export carries a `/** ... */` JSDoc summary.
```typescript
import { DRILL_VARIANTS, VariantMapping } from './variants';
// ...
export interface CartItemInput { /* ... */ }
/**
 * Compiles an optimized cart permalink ...
 */
export function compileShopifyCartLink(/* ... */): CompilerResult { /* ... */ }
```

**Error-handling convention** (repo, per `CONVENTIONS.md` + `checkout.ts:96-100`): defensive try/catch that swallows and returns a safe default rather than throwing on skippable/untrusted paths.
```typescript
try {
  new URL(compiled);
} catch (e) {
  console.error('Invalid compiled canvas partner URL:', compiled);
}
```
Note: engine code should avoid `console.*` noise (`CONVENTIONS.md` Logging) — `safeStorage` catch blocks should silently return the fallback (`null` / `false`), matching the RESEARCH sketch at `11-RESEARCH.md:120-135`. Use the exact object-literal `safeStorage` shape from RESEARCH §"Layer 1" (getItem→`null` on throw, setItem→`false` on throw, removeItem→ignore, optional `isAvailable()` probe).

---

### `src/hooks/usePersistentState.ts` (hook)

**Analog:** `src/features/match/useDiamondArtMatch.ts` — the established hook shape.

**Import + hook-doc convention** (`useDiamondArtMatch.ts:1-18`): framework import first (`preact/hooks`), then relative engine imports; a multi-line `/** ... */` JSDoc above the hook describing the state machine.
```typescript
import { useState, useRef, useEffect, useMemo, useCallback } from 'preact/hooks';
import { substituteLowCountColors } from '../../engine/color';
```
New file lives at `src/hooks/`, so the import becomes `import { safeStorage } from '../engine/safeStorage';` (see RESEARCH §"Location rationale", `11-RESEARCH.md:196-202`).

**Lazy-init `useState` + write `useEffect` core pattern** — this is exactly what the hook must generalize. The 7 current inline occurrences to collapse live at `App.tsx:129-155` (reads) and `App.tsx:158-172, 204-214` (write effects). Example being replaced (`App.tsx:129-133`):
```typescript
const [enableSubstitution, setEnableSubstitution] = useState<boolean>(() => {
  const saved = localStorage.getItem('gempixel_enable_substitution');
  return saved === null ? true : saved === 'true';
});
// ...
useEffect(() => {
  localStorage.setItem('gempixel_enable_substitution', enableSubstitution.toString());
}, [enableSubstitution]);
```

**Return convention:** `useDiamondArtMatch` returns a named-field object (`CONVENTIONS.md` "prefer object literals over tuples"), BUT `usePersistentState` intentionally mirrors `useState`'s `[value, setValue]` tuple — return `as const` per RESEARCH sketch (`11-RESEARCH.md:161-172`). This is the deliberate exception; document it in the hook JSDoc.

**Codec table (format-preserving) — CRITICAL:** use the per-type codecs from `11-RESEARCH.md:151-159` and migration mapping `11-RESEARCH.md:186-192`. Do NOT use a blanket JSON codec (Pitfall 1). The int codec must NaN-guard (IN-05). `canvasTemplate` needs a custom codec carrying the `heartfuldiamonds→adiamondpainting` normalization currently at `App.tsx:198-201`.

---

### `src/App.tsx` — banner + migration + guarded parse (modified)

**Analog: EXISTING banners in the same file** (`App.tsx:1655-1659` `matchError`, `App.tsx:1666-1670` `saveErrorMsg`). Match this Tailwind markup exactly for the new `actionError` banner (text-only, never `dangerouslySetInnerHTML`):
```tsx
{saveErrorMsg && (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] no-print max-w-md px-4 py-2.5 rounded-lg bg-rose-950/95 border border-rose-500/60 text-xs font-medium text-rose-100 shadow-lg backdrop-blur">
    {saveErrorMsg}
  </div>
)}
```
Per RESEARCH §ERR-01 Option B (`11-RESEARCH.md:229-234`): introduce `const [actionError, setActionError] = useState<string | null>(null)`, fold the two `saveErrorMsg` usages into it, render ONE banner. Give it a distinct vertical offset from `matchError` (which sits `top-4`) so they never overlap (developer's UX directive; RESEARCH `11-RESEARCH.md:239-243`). Add a dismiss "×" or auto-clear.

**Clear-at-start-of-handler convention** (`App.tsx:330`): the save handler clears the banner before acting — mirror this in each download/checkout handler.
```typescript
setSaveErrorMsg('');   // → setActionError(null) at the top of each action
```

**Set-on-failure convention** (`App.tsx:378-381`): quota failure sets the message and aborts.
```typescript
if (!result.ok) {
  setSaveErrorMsg('Storage is full. ...');
  return false;
}
```

**Download catches to wire** (`App.tsx:878-880` and `903-905`) — currently `console.error`-only; add `setActionError(...)`:
```typescript
} catch (err) {
  console.error('Failed to download canvas grid:', err);
  // add: setActionError('Could not generate the download. Please try again.');
}
```

**Unguarded checkout parse to guard** (`App.tsx:1011-1015`) — W4. The `JSON.parse` and imperative `setItem` are unguarded; corrupt value kills checkout silently:
```typescript
const savedLog = JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') || '[]');
// ...
localStorage.setItem('gempixel_unmapped_colors_log', JSON.stringify(updatedLog));
```
Fix: read via the guarded path (reuse the L149-155 lazy-init try/catch shape → `[]` fallback, or `safeStorage.getItem` + guarded parse), write the imperative update via `safeStorage.setItem`, and on parse failure also `setActionError(...)`. Keep `checkoutWarning` (`App.tsx:991-995`, informational) separate.

**Import add:** follow the `App.tsx:1-14` block ordering — add `import { usePersistentState, codecs } from './hooks/usePersistentState';` and `import { safeStorage } from './engine/safeStorage';` with the other relative imports.

**Theme note (`App.tsx:97-111`):** if migrated, use the hook for storage only and keep the one-line DOM effect `document.documentElement.dataset.theme = theme` separate (RESEARCH Note A, `11-RESEARCH.md:91-95`).

---

### `src/features/wizard/steps/Step3Canvas.tsx` — clear-log button (modified)

**Analog: the existing call at `Step3Canvas.tsx:394-397`** (self). Route the unguarded `removeItem` through `safeStorage`; silent failure is acceptable here.
```typescript
onClick={() => {
  localStorage.removeItem('gempixel_unmapped_colors_log');   // → safeStorage.removeItem(...)
  setUnmappedLog([]);
}}
```
Add `import { safeStorage } from '../../../engine/safeStorage';` (this file is 3 levels under `src/`). Step components are pure-presentational (`CONVENTIONS.md` Component Architecture) — do not add state here; the `setUnmappedLog` prop already arrives from `App.tsx`.

---

### `src/engine/__tests__/safeStorage.test.ts` (new, unit)

**Analog:** `src/engine/__tests__/checkout.test.ts:1-8` — plain Vitest (no jsdom directive needed for the pure module, but `Storage`/`localStorage` mocking requires jsdom; add `// @vitest-environment jsdom` at top like `App.test.tsx:1`).
```typescript
import { describe, it, expect, vi } from 'vitest';
import { compileShopifyCartLink } from '../checkout';
```
Cover both guard surfaces (RESEARCH `11-RESEARCH.md:314, 327`): spy `Storage.prototype.getItem/setItem` to throw (`11-RESEARCH.md:300-304`), assert `getItem→null`, `setItem→false`, no throw. Restore mocks in `afterEach(() => vi.restoreAllMocks())` so spies don't leak.

---

### `src/hooks/__tests__/usePersistentState.test.ts` (new, unit)

**Analog:** Vitest structure from `checkout.test.ts`; jsdom seeding from `App.test.tsx`. Render the hook via `preact` render into a container (same harness as `App.test.tsx:37-47`) or a minimal test component.

**localStorage seeding convention** (`App.test.tsx:295-296`, `254`): seed exact keys/values, `localStorage.clear()` in `beforeEach`.
```typescript
localStorage.setItem('gempixel_workspace_registry', JSON.stringify([mockProjectSummary]));
```
Cover STORE-02: corrupt value (`'NaNsense'`, `'{bad'`) → falls back to `initial` (`11-RESEARCH.md:315`); round-trip format fidelity — after `setValue`, on-disk value matches legacy (`"true"`, `"15"`, raw string) so existing tests stay green (`11-RESEARCH.md:316`, Pitfall 1/2).

---

### `src/__tests__/App.test.tsx` — new cases (modified)

**Analog: the existing suite (self).** Reuse the mount harness (`App.test.tsx:1-47`): jsdom directive, mocked `worker-client` + `viewer`, `beforeEach` container create, `afterEach` `render(null, container)`.

Add cases (`11-RESEARCH.md:329-332`):
- STORE-01 blocked-storage mount: spy `Storage.prototype.getItem/setItem` to throw before `render(<App/>)`; assert shell renders (mirror the `h1`/`GemPixel` assertion at `App.test.tsx:54-56`) and no throw. Restore in `afterEach`.
- ERR-01 download failure: mock `triggerCanvasDownload` (from `../engine/export`) to throw → assert `actionError` banner text appears.
- ERR-01 corrupt-log checkout: seed `gempixel_unmapped_colors_log = '{not json'` (`11-RESEARCH.md:307`), click checkout → no crash, banner shown, checkout proceeds with `[]`.
- Regression guard: save-quota still surfaces a message.

## Shared Patterns

### Guarded storage access
**Source:** new `src/engine/safeStorage.ts` (models the existing inline guards at `App.tsx:98-102, 106-110, 150-154`).
**Apply to:** `App.tsx` (all 9 key sites), `Step3Canvas.tsx:395`. Single audit point replacing 9 ad-hoc try/catch blocks (W3/IN-01).

### Error surfacing (text-only banner)
**Source:** `App.tsx:1666-1670` (rose-styled fixed banner).
**Apply to:** the new unified `actionError` banner; download catches (`App.tsx:878, 903`), checkout parse failure (`App.tsx:1011`). MUST stay text-only (never `dangerouslySetInnerHTML`) per Security V6/output-encoding (`11-RESEARCH.md:342`) and the `matchError` comment at `App.tsx:1650-1654`.

### Clear-then-act handler discipline
**Source:** `App.tsx:330` (`setSaveErrorMsg('')` at handler top).
**Apply to:** every action handler that can set `actionError` — clear at start so stale errors don't linger.

### Vitest + jsdom test harness
**Source:** `App.test.tsx:1-47` (jsdom directive, worker/viewer mocks, container lifecycle) and `checkout.test.ts:1-8` (engine unit style).
**Apply to:** both new test files + new `App.test.tsx` cases. Always `vi.restoreAllMocks()` in `afterEach` so `Storage.prototype` spies don't leak (`11-RESEARCH.md:333`).

## No Analog Found

None — every file has a strong in-repo analog. `usePersistentState`'s `[value, setValue]` tuple return is the one intentional deviation from the repo's object-return convention (mirrors native `useState`); flagged above.

## Metadata

**Analog search scope:** `src/engine/`, `src/engine/__tests__/`, `src/features/match/`, `src/features/wizard/steps/`, `src/hooks/` (new), `src/__tests__/`, `src/App.tsx`
**Files scanned:** `checkout.ts`, `useDiamondArtMatch.ts`, `App.tsx` (targeted ranges), `Step3Canvas.tsx`, `checkout.test.ts`, `App.test.tsx`, `CONVENTIONS.md`
**Pattern extraction date:** 2026-07-12
</content>
</invoke>
