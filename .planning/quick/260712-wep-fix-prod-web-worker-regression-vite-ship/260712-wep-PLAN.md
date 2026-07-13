---
phase: 260712-wep
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/engine/worker-client.ts
  - src/features/match/useDiamondArtMatch.ts
autonomous: true
requirements: [QUICK-260712-wep]

must_haves:
  truths:
    - "Loading an image on production (gem-pixel.com) renders the gem-art grid — the color-matching worker instantiates and returns matches instead of firing onerror."
    - "The production build emits the worker as a hashed JavaScript chunk (matcher.worker-<hash>.js), never as a raw hashed .ts asset served with a video/mp2t MIME type."
    - "The existing 205-test suite stays green; worker.test.ts still passes through the injected-URL constructor branch."
  artifacts:
    - "src/engine/worker-client.ts — MatcherClient constructor arg is optional and defaults to the statically-detectable literal Worker pattern."
    - "src/features/match/useDiamondArtMatch.ts — MatcherClient is constructed with no argument so the default (bundled) worker path is used."
    - "dist/assets/matcher.worker-<hash>.js — bundled worker output produced by npm run build (no bare relative ESM imports remain in it)."
  key_links:
    - "The literal new Worker(new URL('./matcher.worker.ts', import.meta.url), { type: 'module' }) inside worker-client.ts is the single expression Vite statically detects to compile+bundle the worker and its ./color, ./ingest, ./types imports."
    - "The optional constructor parameter preserves the test-injection seam that worker.test.ts relies on (new MatcherClient(new URL('http://localhost/matcher.worker.ts')))."
---

<objective>
Fix a production-only regression where the color-matching Web Worker ships as raw, un-transpiled TypeScript. On gem-pixel.com the worker is served at /assets/matcher.worker-<hash>.ts (literal TS source with bare imports, Content-Type video/mp2t); instantiating it as a module worker fires onerror immediately, so loading an image silently renders nothing. Local `npm run dev` works only because the Vite dev server transpiles .ts requests on the fly.

Root cause: Vite compiles+bundles a worker only when it statically sees the literal `new Worker(new URL('./x.ts', import.meta.url))` in a single expression. Here the two halves are split across files — useDiamondArtMatch.ts builds the new URL(...) and passes it as a value into MatcherClient, whose constructor calls new Worker(value). Vite cannot connect them, so it copies matcher.worker.ts verbatim as a static asset.

Purpose: Restore image→grid rendering in production without changing runtime behavior, while keeping the test-injection seam intact.
Output: A default, statically-detectable worker-instantiation path in MatcherClient and a no-arg call site, so the build bundles the worker to a hashed .js chunk.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/engine/worker-client.ts
@src/features/match/useDiamondArtMatch.ts
@src/engine/matcher.worker.ts
@src/engine/__tests__/worker.test.ts
@vite.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Default MatcherClient to the statically-detectable Worker pattern and drop the decoupled URL at the call site</name>
  <files>src/engine/worker-client.ts, src/features/match/useDiamondArtMatch.ts</files>
  <action>
In src/engine/worker-client.ts, change the MatcherClient constructor (currently at lines 10-12) so its parameter is OPTIONAL (workerUrl?: URL | string). When workerUrl is provided, instantiate the worker from it exactly as today (new Worker(workerUrl, { type: 'module' })). When workerUrl is omitted, instantiate from the literal in-place expression new Worker(new URL('./matcher.worker.ts', import.meta.url), { type: 'module' }) — this literal must appear verbatim as a single expression inside the else branch, because that is the only form Vite statically detects to compile and bundle the worker (and its transitive ./color, ./ingest, ./types imports) into a hashed .js chunk. Do NOT hoist the new URL(...) into a variable and do NOT pass it through a helper — decoupling it is exactly the regression being fixed.

Add a short code comment directly above this constructor stating why the inline literal form is mandatory: Vite only compiles+bundles the worker when it can statically see the whole new Worker(new URL(...)) expression in one place; splitting the URL construction into a separate variable or a separate file (as the old call site did) makes Vite emit the worker as a raw hashed .ts asset, which fails to instantiate in production. The optional parameter exists solely to preserve the injected-URL seam used by src/engine/__tests__/worker.test.ts.

In src/features/match/useDiamondArtMatch.ts, at the worker-lifecycle useEffect (line 112), remove the new URL('../../engine/matcher.worker.ts', import.meta.url) argument so the line constructs the client with no argument (new MatcherClient()). This routes production through the new default bundled-worker branch. Leave the terminate-on-cleanup logic and the rest of the effect unchanged.

Do not alter any other behavior: the match() method, message/error handlers, run-id supersede logic, and the test-injection paths must stay byte-for-byte the same aside from the constructor signature and the single call-site edit.
  </action>
  <verify>
    <automated>npm test</automated>
  </verify>
  <done>MatcherClient constructor accepts an optional workerUrl and defaults to the inline new Worker(new URL('./matcher.worker.ts', import.meta.url), { type: 'module' }) literal; useDiamondArtMatch.ts constructs new MatcherClient() with no argument; npm test passes with all 205 tests green (worker.test.ts still instantiates via the injected-URL branch).</done>
</task>

<task type="auto">
  <name>Task 2: Prove the production build bundles the worker to a hashed .js chunk</name>
  <files>dist/assets/ (build output — inspected, not edited)</files>
  <action>
Run the production build and inspect the emitted worker artifact to confirm the regression is fixed. This task changes no source files — it produces the build and asserts the output shape. Run npm run build (tsc typecheck then vite build) and confirm it completes without error. Then inspect dist/assets for the worker chunk: exactly one hashed JavaScript file matching matcher.worker-<hash>.js must exist, and NO hashed TypeScript asset matching matcher.worker-<hash>.ts may exist. Finally confirm the emitted chunk is bundled JavaScript — its dependencies were inlined by Vite — by verifying the worker chunk contains no surviving bare relative ESM import of the color module (the un-bundled raw-TS symptom). Use the exact grep in the verify block. If any assertion fails, the worker was not statically detected by Vite; re-check that the constructor literal in worker-client.ts is a single inline expression and that the call site passes no argument.
  </action>
  <verify>
    <automated>npm run build && ls dist/assets/matcher.worker-*.js >/dev/null && ! ls dist/assets/matcher.worker-*.ts >/dev/null 2>&1 && ! grep -REn "from ['\"]\./color['\"]" dist/assets/matcher.worker-*.js</automated>
  </verify>
  <done>npm run build succeeds; dist/assets contains a matcher.worker-<hash>.js file and no matcher.worker-<hash>.ts file; the worker chunk contains no bare relative import of ./color, confirming Vite bundled the worker and its dependencies into hashed JavaScript.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| main thread → Web Worker | ImageBitmap + palette payload crosses via postMessage; unchanged by this fix |
| build output → browser | Vite emits static assets the browser fetches and executes |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-wep-01 | Denial of Service | worker instantiation on gem-pixel.com | high | mitigate | Emit the worker as a bundled hashed .js module (this plan) so it instantiates instead of firing onerror and stranding the render — the regression itself is the availability defect being closed. |
| T-wep-02 | Tampering | dependency surface | low | accept | No packages added, removed, or upgraded; change is source-only refactor of an existing worker-instantiation expression. No package legitimacy gate required. |

No new external inputs, endpoints, or trust boundaries are introduced; the ImageBitmap/palette payload path across the worker boundary is unchanged.
</threat_model>

<verification>
- npm test: all 205 tests green; worker.test.ts passes via the injected-URL constructor branch (new MatcherClient(new URL(...))).
- npm run build: tsc typecheck and vite build both succeed.
- dist/assets contains matcher.worker-<hash>.js and does NOT contain matcher.worker-<hash>.ts.
- The emitted worker chunk has no surviving bare relative import of ./color (dependencies bundled by Vite).
</verification>

<success_criteria>
- MatcherClient constructor arg is optional and defaults to the inline new Worker(new URL('./matcher.worker.ts', import.meta.url), { type: 'module' }) literal, with a comment explaining why the inline form is mandatory.
- useDiamondArtMatch.ts constructs the client with no argument.
- npm test stays green (205 tests); npm run build succeeds.
- Production build ships the worker as a hashed .js chunk, not raw .ts — loading an image on gem-pixel.com renders the gem-art grid again.
</success_criteria>

<output>
Create `.planning/quick/260712-wep-fix-prod-web-worker-regression-vite-ship/260712-wep-SUMMARY.md` when done
</output>
