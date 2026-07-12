---
phase: quick-260711-wvv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/engine/worker-client.ts
  - src/features/match/useDiamondArtMatch.ts
  - src/App.tsx
  - src/features/match/__tests__/useDiamondArtMatch.test.tsx
autonomous: true
requirements: [B1, W5]
must_haves:
  truths:
    - "A worker-side matching error clears the loading overlay (loading becomes false) instead of spinning forever."
    - "A worker-side matching error surfaces a visible, user-readable message near the viewport."
    - "Triggering a new match clears any previously shown error."
  artifacts:
    - src/engine/worker-client.ts
    - src/features/match/useDiamondArtMatch.ts
    - src/App.tsx
    - src/features/match/__tests__/useDiamondArtMatch.test.tsx
  key_links:
    - "MatcherClient.match routes {kind:'error'} messages AND worker.onerror to a new onError callback."
    - "useDiamondArtMatch passes onError -> setLoading(false)+setError, and exposes error in its return."
    - "App.tsx renders the hook's error near the loading overlay (~1629-1636) and it clears on the next match."
---

<objective>
Fix blocker B1 (worker matching errors leave the UI stuck loading forever) and the W5 error
surface for this one path. Today `matcher.worker.ts` posts `{kind:'error'}` on a worker-side
exception, but `worker-client.ts` only `console.error`s it — there is no `onError` seam and no
`worker.onerror` — so `useDiamondArtMatch` never clears `loading`, the overlay strands the UI,
and the only recovery is a full page reload with no message shown to the user.

Deliver a lightweight `onError` seam end-to-end: worker-client → hook → App error banner, plus
a regression test that proves the error path clears loading and exposes the error.

Purpose: Restore the tool's core function (viewing the chart) under worker failure, and give
users a visible failure surface instead of a silent infinite spinner.
Output: onError callback in MatcherClient, error state in the hook, an inline error banner in
App.tsx, and an extended hook test covering the error path.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/codebase/REVIEW.md
@.planning/codebase/REVIEW-worker-data.md
@src/engine/worker-client.ts
@src/engine/matcher.worker.ts
@src/features/match/useDiamondArtMatch.ts
@src/features/match/__tests__/useDiamondArtMatch.test.tsx

Scope guard: fix ONLY B1 + the W5 error surface for this worker-error path. Do NOT touch the
abort race (B2), quota eviction (B3), symbol overflow (B4), or refactor the App God component.
`matcher.worker.ts` already posts `{kind:'error', error}` correctly — do not change the worker.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add onError seam through MatcherClient and wire hook error state</name>
  <files>src/engine/worker-client.ts, src/features/match/useDiamondArtMatch.ts</files>
  <behavior>
    - When the worker posts {kind:'error', error}, MatcherClient invokes the onError callback with the error string (and still console.errors it).
    - When the worker emits an uncaught error event (worker.onerror), MatcherClient invokes onError with a readable message.
    - The hook's onError sets loading=false and stores the error message; the hook exposes `error` in its return.
    - The synchronous catch in the match-trigger effect also sets the error (not just console.error), for parity.
    - Starting a new match (effect re-run) clears the previous error before setting loading=true.
  </behavior>
  <action>
    In src/engine/worker-client.ts (per B1 / WR-01): extend `MatcherClient.match` with an optional
    `onError?: (message: string) => void` parameter placed after `onComplete` (so the callbacks stay
    grouped) and before the existing optional `cols?` param — final order:
    `(pixels, candidates, onProgress, onComplete, onError?, cols?)`. In the `onmessage` handler, keep
    the existing `console.error('Worker error:', e.data.error)` for the `kind:'error'` branch and add
    `onError?.(e.data.error)` after it. Additionally register `this.worker.onerror = (ev) => { ... }`
    inside `match` (so it closes over this call's `onError`): console.error the event and call
    `onError?.(ev.message || 'Worker crashed')`. Do NOT add run-id/abort logic (that is B2, out of scope).

    In src/features/match/useDiamondArtMatch.ts (per B1 / W5): add `const [error, setError] = useState<string | null>(null)`.
    In the match-trigger effect (currently lines ~100-128), add `setError(null)` alongside the existing
    `setLoading(true); setProgress(0);` so a new match clears a stale error. Pass an onError argument to
    `clientRef.current?.match(...)` (positioned before `cols`) that does `setLoading(false)` and
    `setError(message)` (log too). In the surrounding synchronous `catch (err)` block, add
    `setError(err instanceof Error ? err.message : String(err))` next to the existing `setLoading(false)`.
    Add `error: string | null` to the `MatchState` interface and include `error` in the hook's returned object.
    Keep the existing eslint-disable and dependency array as-is (do not add new trigger deps).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>tsc passes; MatcherClient.match accepts onError and routes both {kind:'error'} and worker.onerror to it; the hook exposes `error`, clears it on a new match, and sets loading=false + error on worker/synchronous failure.</done>
</task>

<task type="auto">
  <name>Task 2: Surface the match error as an inline banner in App.tsx</name>
  <files>src/App.tsx</files>
  <action>
    Update the `useDiamondArtMatch` destructure (line ~404) to also pull the new error, aliased to avoid
    ambiguity: `const { matchResult, symbolMap, loading, progress, restore, error: matchError } = useDiamondArtMatch({...})`.
    (`matchError` is a confirmed-free identifier — no existing `error` variable in App.tsx.)

    Near the loading overlay block (the `{loading && ( ... )}` at ~1629-1636), add a sibling
    `{matchError && ( ... )}` block that renders a small, absolutely-positioned inline banner over the
    viewport carrying the message text, e.g. "Color matching failed: {matchError}". Match the app's existing
    dark-panel / danger styling conventions used elsewhere in this file (rounded panel, border, small text,
    include the `no-print` class and a sensible z-index above the HUD). Render `{matchError}` as JSX text
    content only — never via dangerouslySetInnerHTML. Because loading is now cleared on error (Task 1), the
    spinner overlay will not co-display with the banner. No new state, effects, or dismiss control are needed:
    the banner clears automatically when the next match starts (the hook resets error on re-trigger).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>App.tsx reads `error` from the hook as `matchError` and conditionally renders a text-only inline banner adjacent to the loading overlay; tsc passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Regression test for the worker-error path in the hook</name>
  <files>src/features/match/__tests__/useDiamondArtMatch.test.tsx</files>
  <behavior>
    - A test drives the hook down the error path (mock invokes the new onError instead of onComplete) and asserts loading becomes false and the exposed error string is present.
    - The existing happy-path and restore/substitution/smoothing/unmount tests remain green.
  </behavior>
  <action>
    Extend the hand-rolled MockMatcherClient in this file to support the error path without breaking the
    existing synchronous complete path. Add a hoisted, mutable control object via `vi.hoisted` (e.g.
    `control = { mode: 'complete' as 'complete' | 'error' }`) alongside the existing `instances` array, and
    reset `control.mode = 'complete'` in the existing `beforeEach`. Update the mock's `match` signature to
    accept the new onError param in the same position Task 1 defined it
    (`(_pixels, _candidates, onProgress, onComplete, onError, _cols)`); when `control.mode === 'error'`, call
    `onError?.('worker exploded')` and return early; otherwise keep the current `onProgress(100)` +
    `onComplete({...})` behavior unchanged.

    Add one new test: set `control.mode = 'error'`, mount with `{ image: fakeImage }`, await a macrotask,
    rerender, then assert `h.state.loading === false` and `h.state.error === 'worker exploded'`. Do not add a
    worker.onerror test (the whole client is mocked, so the onerror wiring is covered by tsc/build, not this
    unit test) — note that briefly in a comment.
  </action>
  <verify>
    <automated>npx vitest run src/features/match/__tests__/useDiamondArtMatch.test.tsx</automated>
  </verify>
  <done>The new error-path test passes and all pre-existing tests in the file still pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Web Worker → main thread | Worker posts a message whose `error` string is surfaced into the DOM. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-01 | Information Disclosure / Tampering | Error banner in App.tsx | low | mitigate | Render the worker error message as JSX text content only (never dangerouslySetInnerHTML), so a crafted error string cannot inject markup/script. |
| T-quick-SC | Tampering | package installs | n/a | accept | No new npm/pip/cargo dependencies are added by this change; no package legitimacy gate required. |
</threat_model>

<verification>
- `npx tsc --noEmit` passes (type contract for onError + error state holds end-to-end).
- `npm test` (vitest run) passes, including the new worker-error-path test.
- `npm run build` (tsc && vite build) passes.
- Manual (optional): force a worker throw during matching → overlay clears and the inline error banner shows; triggering a new match clears the banner.
</verification>

<success_criteria>
- Worker-side matching errors clear `loading` (no infinite spinner; no reload-only recovery).
- A visible, text-only error banner surfaces the failure near the viewport and clears on the next match.
- Only B1 + the W5 surface for this path are touched (B2/B3/B4 and the God-component refactor untouched).
- `npm run build` and `npm test` both pass.
</success_criteria>

<output>
Create `.planning/quick/260711-wvv-fix-blocker-b1-worker-matching-errors-le/260711-wvv-SUMMARY.md` when done.
</output>
