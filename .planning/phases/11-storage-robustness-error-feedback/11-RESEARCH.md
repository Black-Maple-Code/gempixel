# Phase 11: Storage Robustness & Error Feedback - Research

**Researched:** 2026-07-12
**Domain:** Client-side localStorage safety, Preact state persistence, user-facing error feedback
**Confidence:** HIGH (all findings verified against current source, not external docs)

## Summary

This is a **remediation phase**. Every finding already exists in the authored maintenance review
(`REVIEW-ui.md` W3/W4/W5/IN-01, `REVIEW-worker-data.md`) and I re-verified all of it against the
**current** source — the B1–B4 quick-fixes and the `src/features/` refactor did shift some line
numbers, but the substance holds. No external research was needed; there are **no new npm packages**
(so Package Legitimacy Audit and Environment Availability are N/A — this is a pure code change).

Three tightly-coupled deliverables:
1. **STORE-01/02** — a new `usePersistentState<T>` hook + a pure `safeStorage` guard replace 7
   unguarded lazy-`useState`/`useEffect` pairs in `src/App.tsx`, so a blocked/private-mode browser
   no longer throws during render-phase state init.
2. **ERR-01** — extend the **existing** inline banner pattern (two banners already live at
   `App.tsx:1655` and `1666`) to the download and checkout paths, and guard the unmapped-colors-log
   `JSON.parse` at `App.tsx:1011`.

**Primary recommendation:** Add `src/engine/safeStorage.ts` (pure, try/catch-wrapped get/set,
unit-testable without jsdom) and `src/hooks/usePersistentState.ts` (thin Preact wrapper). Migrate the
7 settings using **per-type codecs that preserve the current on-disk format** (do NOT switch to a
blanket JSON codec — it silently drops existing raw-string values). For ERR-01, introduce ONE generic
`actionError`/`setActionError` banner, fold the existing `saveErrorMsg` into it, and leave the
hook-owned `matchError` as-is.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORE-01 | App mounts/functions when localStorage is blocked; no read/write throws during mount (W3) | `safeStorage` wraps both access layers; `usePersistentState` lazy-init falls back to `initial` — see "usePersistentState API" + full key inventory below |
| STORE-02 | All persisted settings read/write through one safe helper; duplicated boilerplate removed (W3, IN-01) | 7 keys enumerated below migrate to `usePersistentState`; codec table preserves formats |
| ERR-01 | Failed save/download/checkout shows a clear message instead of silent no-op; unmapped-log parse guarded (W4, W5) | Exact failure paths + recommended single-banner approach below |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| localStorage access guarding | Browser / Client (pure helper) | — | No server exists; storage is the only persistence. Pure guard belongs in `src/engine/` (testable without render) |
| Setting state + persistence lifecycle | Client (Preact hook) | — | `useState` + write-effect is a view-layer concern; wrap in `src/hooks/` |
| Error surfacing | Client (App.tsx JSX banner) | — | Single inline banner region in the orchestrator component |

## Standard Stack

No new dependencies. Everything uses the existing stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `preact/hooks` | ^10.25 (installed) | `useState`, `useEffect` for the hook | Already the app's state primitive |
| Native `localStorage` / `Storage` | — | Persistence | Per CLAUDE.md: browser-native only, no storage libs |
| Vitest + jsdom | installed | Tests | Existing test harness (`src/__tests__/`, `src/engine/__tests__/`) |

**Do NOT add** `use-local-storage-state`, `usehooks-ts`, `zustand`, or any persistence library — it
violates the CLAUDE.md "lightweight, browser-native first" constraint and the ~4KB bundle goal. The
hook is ~30 lines.

## Runtime State Inventory

This is a code-and-behavior change, not a rename/migration. Persisted **key names and formats stay
identical** (that is a hard requirement — see Pitfalls). No data migration is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 9 `gempixel_*` localStorage keys (7 settings migrate to the helper; `theme` + `unmappedLog` are special cases below). Project blobs/registry/recents in `projectStore.ts` are **out of scope**. | Code edit only — keys & serialized formats unchanged |
| Live service config | None — no server, no external service config | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

## Complete Persisted-Key Inventory (verified against current `src/App.tsx`)

These are every localStorage key touched in `App.tsx`. Column "Migrate?" = becomes `usePersistentState`.

| # | Key | Variable / setter | Current read | Current write | Value shape | Migrate? |
|---|-----|-------------------|--------------|---------------|-------------|----------|
| 1 | `gempixel_theme` | `theme`/`setTheme` | L99 (guarded) | L107 in effect (guarded) — **also sets `document.documentElement.dataset.theme`** | `'dark'\|'light'` | Partial — see note A |
| 2 | `gempixel_enable_substitution` | `enableSubstitution` | L131 **unguarded** | L159 effect **unguarded** | bool as `"true"`/`"false"` | **Yes** |
| 3 | `gempixel_substitution_threshold` | `substitutionThreshold` | L136 **unguarded** | L163 effect **unguarded** | int; **NaN risk** (IN-05) | **Yes** |
| 4 | `gempixel_enable_smoothing` | `enableSmoothing` | L141 **unguarded** | L167 effect **unguarded** | bool as `"true"`/`"false"` | **Yes** |
| 5 | `gempixel_smoothing_strength` | `smoothingStrength` | L146 **unguarded** | L171 effect **unguarded** | int | **Yes** |
| 6 | `gempixel_unmapped_colors_log` | `unmappedLog`/`setUnmappedLog` | L151 (guarded, JSON) | written imperatively in checkout L1014 (**unguarded**), re-parsed L1011 (**unguarded**), `removeItem` in `Step3Canvas.tsx:395` (**unguarded**) | JSON `string[]` | Partial — see note B |
| 7 | `gempixel_affiliate_tag` | `affiliateTag` | L191 **unguarded** | L205 effect **unguarded** | raw string | **Yes** |
| 8 | `gempixel_affiliate_app` | `affiliateApp` | L194 **unguarded** | L209 effect **unguarded** | raw string union `'ref'\|'rfsn'\|'none'` | **Yes** |
| 9 | `gempixel_canvas_template` | `canvasTemplate` | L197 **unguarded** | L213 effect **unguarded** | raw URL string; **has migration logic** (heartfuldiamonds→adiamondpainting, L198-201) | **Yes — carry the migration** |

**Note A (theme):** Already guarded, but its write effect also mutates the DOM
(`document.documentElement.dataset.theme = theme`). If migrated, use `usePersistentState` for the
**storage half only** and keep a separate `useEffect` for the DOM side-effect. Simplest low-risk
option: migrate the storage read/write and retain the one-line DOM effect. IN-01 says "centralize
ALL," so migrating theme's storage is in-spirit; just don't fold the DOM write into the generic hook.

**Note B (unmappedLog):** Its lazy read is already guarded, but it is **not** a simple
state-mirrors-to-storage value — it is written imperatively inside `handleShopifyCheckout` (L1011-1015)
and cleared via a button in `Step3Canvas`. It does not fit the plain `usePersistentState` write-effect
shape. Recommended: use `usePersistentState` (json codec) for the **initial read** to remove the
inline try/catch, but keep the imperative writes going through `safeStorage.setItem` directly (or a
`safeStorage.getJSON`/`setJSON` pair). The W4 fix (guarding the L1011 re-parse) is what ERR-01 requires
regardless — see ERR-01 below.

**Count check:** rows 2,3,4,5,7,8,9 = **7 settings** → matches IN-01's "~7 near-identical read/write
pairs." `projectStore.ts` is already fully guarded (B3) and is **not** part of this phase.

## usePersistentState API Design

### Layer 1 — pure guard: `src/engine/safeStorage.ts`

Pure module, no Preact import → unit-testable without a jsdom render. Guards **both** failure surfaces:
(a) `localStorage` access itself throwing (Safari private mode, storage disabled, `SecurityError`), and
(b) value parsing throwing (corrupt JSON, NaN).

```ts
// src/engine/safeStorage.ts
// Guarded localStorage wrapper. Every method swallows access errors so a
// blocked/private-mode browser can never throw during render or on write.
export const safeStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): boolean {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
  /** True only if a probe write+remove round-trips. Optional; not required by the hook. */
  isAvailable(): boolean {
    try { const k = '__gp_probe__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch { return false; }
  },
};
```

### Layer 2 — the hook: `src/hooks/usePersistentState.ts`

```ts
// src/hooks/usePersistentState.ts
import { useState, useEffect } from 'preact/hooks';
import { safeStorage } from '../engine/safeStorage';

export interface Codec<T> {
  parse: (raw: string) => T;      // may throw; caller falls back to `initial`
  serialize: (value: T) => string;
}

// Built-in codecs preserve the CURRENT on-disk formats — do not switch to blanket JSON.
export const codecs = {
  bool: { parse: (r: string) => r === 'true', serialize: (v: boolean) => v.toString() } as Codec<boolean>,
  int: (fallback: number): Codec<number> => ({
    parse: (r) => { const n = parseInt(r, 10); return Number.isFinite(n) ? n : fallback; }, // IN-05 NaN guard
    serialize: (v) => v.toString(),
  }),
  string: { parse: (r: string) => r, serialize: (v: string) => v } as Codec<string>,
  json: <T,>(): Codec<T> => ({ parse: (r) => JSON.parse(r) as T, serialize: (v) => JSON.stringify(v) }),
};

export function usePersistentState<T>(key: string, initial: T, codec: Codec<T>) {
  const [value, setValue] = useState<T>(() => {
    const raw = safeStorage.getItem(key);      // guard (a): access
    if (raw === null) return initial;
    try { return codec.parse(raw); }           // guard (b): parse/format
    catch { return initial; }
  });
  useEffect(() => {
    safeStorage.setItem(key, codec.serialize(value)); // guarded; swallows on blocked storage
  }, [value]);
  return [value, setValue] as const;
}
```

**Why per-type codecs, not a single JSON codec (CRITICAL):** The current values are stored in mixed
formats — booleans/ints as `.toString()` (`"true"`, `"15"`) and strings raw (`affiliateTag = "mytag"`,
`canvasTemplate = "https://..."`). A raw string like `"mytag"` is **not valid JSON**, so a blanket
`JSON.parse` codec would throw on it and silently reset the value to `initial` — a **regression** that
wipes a user's saved affiliate tag (monetization) and canvas template. Typed codecs read the existing
format losslessly. This directly serves the developer's "no regressions" directive.

### Migration mapping (drop-in replacements)

| Key | Replace with |
|-----|--------------|
| `enableSubstitution` | `usePersistentState('gempixel_enable_substitution', true, codecs.bool)` |
| `substitutionThreshold` | `usePersistentState('gempixel_substitution_threshold', 15, codecs.int(15))` |
| `enableSmoothing` | `usePersistentState('gempixel_enable_smoothing', true, codecs.bool)` |
| `smoothingStrength` | `usePersistentState('gempixel_smoothing_strength', 1, codecs.int(1))` |
| `affiliateTag` | `usePersistentState('gempixel_affiliate_tag', '', codecs.string)` |
| `affiliateApp` | `usePersistentState<'ref'\|'rfsn'\|'none'>('gempixel_affiliate_app', 'ref', codecs.string as any)` |
| `canvasTemplate` | Use a **custom codec** whose `parse` runs the heartfuldiamonds→adiamondpainting normalization (L198-201) so the migration is not lost |

Each replacement deletes one lazy-`useState(() => localStorage.getItem…)` initializer **and** its
matching `useEffect(() => localStorage.setItem…)` — removing all 7 boilerplate pairs (IN-01).

**Location rationale:** Repo hooks (`useWizard`, `useDiamondArtMatch`) are **feature-scoped** under
`src/features/<feature>/`. `usePersistentState` is a cross-cutting generic, not a feature, so a new
`src/hooks/` directory is the cleanest home; `safeStorage` goes in `src/engine/` alongside the other
pure, unit-tested modules (and can later be reused by `projectStore.ts`). Alternative: put both under
`src/features/persistence/` to match the existing folder shape — acceptable, but mixes a generic hook
into the feature namespace. Recommend `src/hooks/usePersistentState.ts` + `src/engine/safeStorage.ts`.

## ERR-01: Failure Paths & Single Surfacing Approach

### Existing surfaces (verified)
- **`matchError`** — from `useDiamondArtMatch` (`error` state, hook L86/126/133), rendered
  `App.tsx:1655`. Owned by the hook; auto-clears on next match. **Leave as-is** (CR-01/W5 already
  fixed by B1 quick-task 260711-wvv).
- **`saveErrorMsg`/`setSaveErrorMsg`** — local state `App.tsx:78`, rendered `App.tsx:1666`, already
  set on quota failure in the save handler (L378-381, cleared at L330). Working (B3).
- **`checkoutWarning`** — `App.tsx:991` richer object for unmapped/URL-too-long. **Different concern
  (informational), keep separate.**

### Failure paths to wire (currently `console.error`-only or unguarded)

| Path | Location | Current behavior | Fix |
|------|----------|------------------|-----|
| Canvas-only download | `handleDownloadCanvasOnly` catch, `App.tsx:878-880` | `console.error` only | set action-error banner |
| Combined sheet download | `handleDownloadCombinedCanvasSheet` catch, `App.tsx:903-905` | `console.error` only | set action-error banner |
| Checkout unmapped-log parse | `handleShopifyCheckout`, `App.tsx:1011` | **unguarded `JSON.parse`** — corrupt value throws, checkout silently dies (W4) | wrap in try/catch → default `[]` (reuse the L151 lazy-init pattern); on throw also set the banner |
| Save quota | `App.tsx:378-381` | already surfaced via `saveErrorMsg` | fold into unified banner (no behavior change) |
| Clear-log button | `Step3Canvas.tsx:395` `removeItem` | unguarded | route through `safeStorage.removeItem` (silent is fine here) |

### Recommended surfacing — one generic banner (option list per your preference)

- **Option A (minimal):** reuse `setSaveErrorMsg` for downloads/checkout too. Least code, but the name
  lies and couples unrelated failures to a "save" label.
- **Option B — RECOMMENDED:** introduce a generic `const [actionError, setActionError] = useState<string | null>(null)`.
  Migrate the two `saveErrorMsg` usages to it, render **one** banner (replace both L1666 and reuse the
  existing rose-styled markup). Set it in the two download catches and the checkout parse-failure
  catch. Clear it at the **start** of each action handler (mirror the `setSaveErrorMsg('')` at L330).
  Keep `matchError` (hook-owned) and `checkoutWarning` (informational) separate. This gives exactly
  two banner regions total instead of three ad-hoc ones — cleaner, no overlap (your design directive).
- **Option C (most invasive):** unify `matchError` in too by lifting the hook's error via a shared
  setter. Not recommended now — the hook's auto-clear-on-next-match lifecycle differs and this risks
  regressing the B1 fix.

**Banner UX notes (design-conscious):** the two current banners have **no dismiss control** and no
auto-timeout. Since `actionError` is set from imperative one-shot actions (not a reactive match
lifecycle), add a small close "×" or an auto-clear timeout so a stale download error doesn't linger.
Ensure it does not visually stack/overlap with `matchError` (both currently absolute/fixed near
`top-4 left-1/2`) — give `actionError` a distinct offset or share one region.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Safe storage access | Ad-hoc try/catch at each of 9 call sites | One `safeStorage` module | Removes the exact duplication W3/IN-01 flag; single audit point |
| Persistence lifecycle | Repeated lazy-init + write-effect pairs | `usePersistentState` | Collapses 7 pairs into 7 one-liners |
| Storage library | `use-local-storage-state` etc. | The ~30-line hook above | CLAUDE.md bans non-native deps; keeps bundle ~4KB |

## Common Pitfalls

### Pitfall 1: Blanket JSON codec silently wipes raw-string settings
**What goes wrong:** Switching all keys to `JSON.parse`/`stringify` throws on already-stored raw
strings (`affiliateTag`, `canvasTemplate`), falling back to `initial` → user's saved values vanish.
**How to avoid:** Use the per-type codecs above; only `unmappedLog` uses the json codec.
**Warning sign:** `App.test.tsx:586` seeds `gempixel_unmapped_colors_log` as a JSON array — that key
must stay json; the raw-string keys must stay raw.

### Pitfall 2: Renaming keys or changing serialized format
**What goes wrong:** Any key rename or format change breaks users' existing persisted settings AND the
existing tests that seed exact keys/values (`App.test.tsx` lines 295-296, 586, 616; `projectStore.test.ts`).
**How to avoid:** Keys and formats are frozen. This phase changes **how** storage is accessed, never
**what** is stored.

### Pitfall 3: Touching the load/save/projectStore path (Phase 10 territory)
**What goes wrong:** `loadProject`, `projectStore.save/load`, and cost-recompute belong to LOAD-01/02
(Phase 10, still pending) and the B3 quota fix. Editing them here risks regressing that work.
**How to avoid:** Scope STORE-01/02 to the 7 App.tsx **setting** persistence sites + `safeStorage`.
Leave `projectStore.ts` (already fully guarded) alone.

### Pitfall 4: Dropping the canvasTemplate migration
**What goes wrong:** `canvasTemplate`'s current initializer rewrites legacy `heartfuldiamonds` URLs
(L198-201). A naive migration to `codecs.string` loses that.
**How to avoid:** Give `canvasTemplate` a custom codec whose `parse` applies the same normalization.

### Pitfall 5: The write-effect fires on first mount
**What goes wrong:** `usePersistentState`'s effect writes `initial` back to storage on mount. Harmless
when storage works (idempotent), harmless when blocked (`safeStorage` swallows). Do **not** add a
"skip first write" guard unless a test demands it — extra complexity for no benefit here.

## Validation Architecture

GemPixel uses **Vitest + jsdom**. jsdom ships a *working* `localStorage`, so blocked/throwing storage
must be simulated by spying on `Storage.prototype`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (+ jsdom via `// @vitest-environment jsdom`) |
| Config | `vitest run` (`npm test`); tests co-located in `__tests__/` |
| Quick run | `npx vitest run src/engine/__tests__/safeStorage.test.ts` (once created) |
| Full suite | `npm test` |

### Simulating a throwing/blocked localStorage in jsdom
```ts
import { vi, afterEach } from 'vitest';
// Blocked storage (Safari private mode / storage disabled):
const throwBlocked = () => { throw new DOMException('blocked', 'SecurityError'); };
vi.spyOn(Storage.prototype, 'getItem').mockImplementation(throwBlocked);
vi.spyOn(Storage.prototype, 'setItem').mockImplementation(throwBlocked);
afterEach(() => vi.restoreAllMocks());
// Corrupt value (parse failure): use the real store, seed junk:
localStorage.setItem('gempixel_substitution_threshold', 'NaNsense');
localStorage.setItem('gempixel_unmapped_colors_log', '{not json');
```

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | File |
|-----|----------|-----------|---------|------|
| STORE-01 | `<App/>` mounts with `Storage.prototype.getItem/setItem` throwing — no throw, shell renders | unit (render) | `npx vitest run src/__tests__/App.test.tsx` | ❌ Wave 0 (add case) |
| STORE-01 | `safeStorage.getItem` returns `null` when access throws; `setItem` returns `false`, never throws | unit | `npx vitest run src/engine/__tests__/safeStorage.test.ts` | ❌ Wave 0 |
| STORE-02 | corrupt stored value (`'NaNsense'`, `'{bad'`) → `usePersistentState` falls back to `initial`, no throw | unit | `npx vitest run src/hooks/__tests__/usePersistentState.test.ts` | ❌ Wave 0 |
| STORE-02 | round-trip: `setValue` → format on disk matches legacy (`"true"`, `"15"`, raw string) so old tests still pass | unit | same | ❌ Wave 0 |
| ERR-01 | download handler with `triggerCanvasDownload` mocked to throw → action-error banner text appears | integration (render) | `App.test.tsx` | ❌ Wave 0 |
| ERR-01 | corrupt `gempixel_unmapped_colors_log` + checkout click → no crash, banner shown, checkout proceeds with `[]` | integration | `App.test.tsx` | ❌ Wave 0 |
| ERR-01 | save quota (`projectStore.save` → `{ok:false}`) still shows a message (regression guard) | integration | `App.test.tsx` | ❌ Wave 0 (confirm) |

### Sampling Rate
- **Per task commit:** the touched unit file (`vitest run <file>`)
- **Per wave merge / phase gate:** `npm test` fully green — the existing `App.test.tsx` and
  `projectStore.test.ts` MUST stay green (they assert exact keys/formats).

### Wave 0 Gaps
- [ ] `src/engine/__tests__/safeStorage.test.ts` — covers STORE-01 (guard both surfaces)
- [ ] `src/hooks/__tests__/usePersistentState.test.ts` — covers STORE-02 (fallback + round-trip format)
- [ ] New cases in `src/__tests__/App.test.tsx` — blocked-storage mount (STORE-01), download-failure &
      corrupt-log-checkout banners (ERR-01)
- [ ] Existing `App.test.tsx` `beforeEach(localStorage.clear())` interaction: spies must be restored in
      `afterEach` so they don't leak into unrelated tests.

## Security Domain

Minimal surface — client-only, no auth/session/network. Relevant ASVS slice:

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V5 Input Validation | yes | Guarded `JSON.parse` with `[]` fallback (W4); NaN guard on int codec (IN-05); treat all stored values as untrusted (another tab/manual edit can corrupt them) |
| V6 Cryptography | no | — |
| Output encoding | yes (existing) | Banners are **text-only** (never `dangerouslySetInnerHTML`) — the existing `matchError` comment at L1650 already mandates this; the new `actionError` banner MUST follow suit so a crafted error string cannot inject markup |

Note: `canvasTemplate` scheme validation (`javascript:`/`data:` open-redirect, W10/SEC-01) is
**Phase 14**, not here — but be aware `usePersistentState` will now own reading that value.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | *(none)* — every claim verified against current source this session | — | — |

All line numbers and signatures were read from the live files (`App.tsx`, `projectStore.ts`,
`useDiamondArtMatch.ts`, `App.test.tsx`) on 2026-07-12. No `[ASSUMED]` claims.

## Open Questions

1. **Should `theme` be migrated or left as-is?**
   - Known: already guarded; its write-effect also mutates the DOM.
   - Recommendation: migrate the storage half via `usePersistentState` + keep a one-line DOM effect,
     OR leave `theme` untouched (it already satisfies STORE-01). Planner/discuss can pick; both are
     low-risk. Migrating fully honors IN-01's "centralize ALL" more literally.
2. **`actionError` dismissal — close button vs auto-timeout?**
   - Recommendation: a small "×" close is most predictable; a 6–8s auto-clear is acceptable. Decide in
     UI planning (design-conscious dev).

## Sources

### Primary (HIGH confidence — live source, this session)
- `src/App.tsx` (L78, 95-215, 330-388, 855-916, 985-1023, 1640-1670) — key inventory, handlers, banners
- `src/engine/projectStore.ts` (L103-189) — confirmed `save()` returns `SaveResult` `{ok:true}|{ok:false,reason:'quota'}`; already fully guarded (out of scope)
- `src/features/match/useDiamondArtMatch.ts` (L44, 86, 109, 124-133, 181) — `error` state already exists (CR-01/W5 fixed)
- `src/__tests__/App.test.tsx` (L1-50, 254-296, 586, 616) — test harness + exact seeded keys/formats
- `.planning/codebase/CONVENTIONS.md` — hook/file naming, error-handling patterns
- `.planning/codebase/REVIEW-ui.md` (W3/W4/W5/IN-01/IN-05) and `REVIEW-worker-data.md` (CR-02/B3)

### Secondary / Tertiary
- None needed — no external research for this remediation phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all existing and installed
- Key inventory & handlers: HIGH — read line-by-line from current source
- Error surfacing design: HIGH — existing banners verified; recommendation is additive
- Validation approach: HIGH — matches existing Vitest/jsdom harness

**Research date:** 2026-07-12
**Valid until:** stable — internal refactor; valid until `src/App.tsx` structure changes materially
