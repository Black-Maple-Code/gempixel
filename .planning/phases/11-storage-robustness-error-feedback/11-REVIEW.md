---
phase: 11-storage-robustness-error-feedback
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/engine/safeStorage.ts
  - src/hooks/usePersistentState.ts
  - src/App.tsx
  - src/features/wizard/steps/Step3Canvas.tsx
  - src/engine/__tests__/safeStorage.test.ts
  - src/hooks/__tests__/usePersistentState.test.ts
  - src/__tests__/App.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: resolved
resolution:
  reviewed_by: gsd-execute-phase code_review_gate
  warnings_fixed: 3
  info_deferred: 3
  fixed: 2026-07-12
  commits:
    - "27284c7 fix(11): shape-check unmapped-colors log codec (WR-01)"
    - "8eaf073 fix(11): shape-check checkout unmapped-log read (WR-02)"
    - "0bf02ce fix(11): restore empty-template default fallback (WR-03)"
  note: "All 3 Warning findings fixed + regression tests added (suite 170->178 green). Info items (IN-01/02/03) deferred as advisory; IN-03's wrong-type coverage gap was closed by the WR-01/WR-02 tests."
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-12
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 11 adds a clean `safeStorage` guard, a `usePersistentState` hook with format-preserving
codecs, migrates App.tsx's 7 persisted settings onto the hook, routes Step3Canvas through
`safeStorage`, and unifies failure feedback into a dismissible `actionError` banner.

The core storage-safety story is solid: every `safeStorage` method is try/wrapped and never
throws, the "mounts under blocked storage" test proves the render path is crash-safe, and the
banner is rendered as a plain JSX text child (never `dangerouslySetInnerHTML`), so no output-
encoding/XSS gap exists. The bool/int/string codec migrations preserve the legacy on-disk
formats and even fix a latent `NaN` bug (old `parseInt` path returned `NaN`; `codecs.int`
now `Number.isFinite`-guards it).

The defects that remain all sit in the JSON/`json` codec's trust of `JSON.parse` output and one
empty-string fidelity gap in the custom template codec. None is a security or data-loss issue,
but two of them can still throw an uncaught exception under corrupt (manually- or cross-tab-
edited) storage — the exact failure class this phase set out to eliminate — so they are worth
fixing before this is considered "storage-robust."

No structural findings block was supplied.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `json` codec never validates shape — a valid-JSON non-array in `gempixel_unmapped_colors_log` crashes render

**File:** `src/hooks/usePersistentState.ts:38-41`, consumed at `src/features/wizard/steps/Step3Canvas.tsx:405-411`
**Issue:** `codecs.json().parse` returns raw `JSON.parse(r)` with no runtime shape check. The
hook only falls back to `initial` when `parse` *throws*. A value that is valid JSON but the
wrong type does not throw, so it flows through as the hook's value. `unmappedLog` is then
rendered in Step3Canvas as `unmappedLog.length > 0 ? unmappedLog.map(...)`. If the stored value
is, e.g., a JSON string `"\"310\""`, `parse` returns the string `"310"`, `.length` is `3`
(truthy), and `unmappedLog.map` is `undefined` → `TypeError` thrown during render, white-
screening the app. This is exactly the "corrupt stored value must never throw" guarantee the
phase claims. The write-on-mount effect does not heal it either: it re-serializes the string
back to the same corrupt-shaped value. Requires manual/cross-tab corruption (the app itself only
ever writes arrays), hence Warning rather than Blocker.
**Fix:** Make the array-shaped codec validate its shape and fall back rather than trust
`JSON.parse`. Either add a dedicated codec or guard the generic one:
```ts
// Preferred: a shape-checked array codec for logs like unmappedLog
stringArray: (): Codec<string[]> => ({
  parse: (r: string) => {
    const v = JSON.parse(r);
    if (!Array.isArray(v)) throw new Error('not an array'); // -> hook falls back to initial
    return v.map(String);
  },
  serialize: (v: string[]) => JSON.stringify(v),
}),
```

### WR-02: Guarded checkout read catches `parse`-throw but the subsequent spread is unguarded for a wrong-type parse

**File:** `src/App.tsx:994-1004`
**Issue:** The IIFE guards `JSON.parse(raw ?? '[]')` against throwing and falls back to `[]` with
a banner. But if `parse` *succeeds* with a non-iterable value (stored `"5"` → `5`, or `"{}"` →
`{}`), the `try` returns it, and the very next line — `Array.from(new Set([...savedLog,
...newCodes]))` at line 1004, outside the `try` — evaluates `[...5]` / `[...{}]` and throws
`TypeError: … is not iterable`. The declared type `savedLog: string[]` is a lie that hides this.
Same root cause as WR-01 (unvalidated JSON shape), different code path. Net effect: a corrupt log
still "silently kills checkout" via an uncaught throw, which the guard comment says it prevents.
**Fix:** Validate the parsed shape inside the guard so the fallback actually applies:
```ts
const savedLog: string[] = (() => {
  const raw = safeStorage.getItem('gempixel_unmapped_colors_log');
  try {
    const parsed = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed as string[];
  } catch {
    setActionError('Could not read the saved unmapped-colors log; continuing without it.');
    return [];
  }
})();
```

### WR-03: `customTemplateCodec` drops the empty-string → default fallback, a regression vs. the old lazy-init

**File:** `src/App.tsx:28-31` (codec), reachable via `src/App.tsx:244` (`loadProject`)
**Issue:** The pre-migration reader was `saved || DEFAULT` (and `saved.includes('heartfuldiamonds')
? DEFAULT`), so an **empty-string** on disk resolved to `DEFAULT_CANVAS_TEMPLATE`. The new
`customTemplateCodec.parse` only special-cases `heartfuldiamonds`; for any other raw string —
including `''` — it returns the raw value verbatim, so `''` now round-trips to `''` instead of the
default. This path is reachable: `loadProject` does `setCanvasTemplate(project.canvasTemplate ||
'')` for template-less (legacy/imported) projects, the hook persists `''`, and on the next mount
`canvasTemplate` becomes `''` (previously it recovered to the default). An empty template yields a
broken custom-canvas checkout URL.
**Fix:** Preserve the old empty-string fallback in the codec:
```ts
const customTemplateCodec: Codec<string> = {
  parse: (raw: string) =>
    !raw || raw.includes('heartfuldiamonds') ? DEFAULT_CANVAS_TEMPLATE : raw,
  serialize: (value: string) => value,
};
```

## Info

### IN-01: Redundant double-write of the unmapped-colors log in checkout

**File:** `src/App.tsx:1005-1006`
**Issue:** `safeStorage.setItem('gempixel_unmapped_colors_log', JSON.stringify(updatedLog))`
writes the key, then `setUnmappedLog(updatedLog)` triggers the `usePersistentState` write-effect,
which serializes and writes the same key again. The value is identical so it is harmless, but the
manual write is now dead weight since the hook owns persistence for this key.
**Fix:** Drop the explicit `safeStorage.setItem` and rely on `setUnmappedLog` alone (the hook's
effect persists it), keeping a single source of truth for the write.

### IN-02: `isAvailable` probe can leak its probe key and is unused in production

**File:** `src/engine/safeStorage.ts:33-42`
**Issue:** If the probe `setItem('__gp_probe__','1')` succeeds but `removeItem` throws, the key is
left behind (and the method still returns `true`). The method is also unused by the app (the hook
does not call it, per its own doc comment) — it exists only for its unit tests. Low impact.
**Fix:** Wrap the remove so a throwing cleanup does not leak, or remove the method until a caller
needs it. If kept, add a `removeItem`-throws test (see IN-03).

### IN-03: Test suite omits the wrong-type-JSON corruption cases that WR-01/WR-02 depend on

**File:** `src/hooks/__tests__/usePersistentState.test.ts:90-94`, `src/__tests__/App.test.tsx:997-1019`
**Issue:** The json/checkout tests only exercise `parse`-**throw** corruption (`'{bad'`, `'{not
json'`). Neither exercises a value that is *valid JSON of the wrong type* (`'"310"'`, `'5'`,
`'{}'`), which is precisely the case that still throws (WR-01/WR-02). The `safeStorage` suite also
never covers `isAvailable` when `removeItem` throws (IN-02).
**Fix:** Add cases: store `'"310"'`/`'5'` under `gempixel_unmapped_colors_log`, assert the hook
falls back to `[]` (after the WR-01 fix) and that checkout does not throw and produces a valid
array; add an `isAvailable` case with `removeItem` mocked to throw.

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
