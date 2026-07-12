# Testing Patterns

**Analysis Date:** 2026-07-12

## Test Framework

**Runner:**
- Vitest `^3.0.0`
- Config: `vite.config.ts` (`test` block, references `vitest/globals`)

**Assertion Library:**
- Vitest built-in `expect` (globals enabled — `describe`, `it`, `expect`, `vi` are available without import, though tests still import them explicitly).

**Run Commands:**
```bash
npm test                 # Run all tests once (vitest run)
npx vitest               # Watch mode (not scripted; run directly)
npx vitest run <path>    # Run a single test file
npx tsc --noEmit         # Type-check gate (run alongside tests)
```
Note: `package.json` defines only `"test": "vitest run"`. There is no coverage or watch script.

## Test File Organization

**Location:**
- Co-located in `__tests__/` directories next to the code under test:
  - `src/engine/__tests__/` — engine unit tests (12 files)
  - `src/features/wizard/__tests__/`, `src/features/match/__tests__/` — hook tests
  - `src/__tests__/` — app-level integration/print tests

**Naming:**
- `<module>.test.ts` for pure logic, `<module>.test.tsx` for anything rendering Preact.

**Structure:**
```
src/
├── engine/
│   ├── color.ts
│   └── __tests__/color.test.ts
├── features/
│   ├── wizard/__tests__/useWizard.test.ts
│   └── match/__tests__/useDiamondArtMatch.test.tsx
└── __tests__/          # App.test.tsx, integration.test.tsx, print.test.tsx
```

## Test Environment

**Default:** `node` (set in `vite.config.ts` `test.environment`). Pure engine math runs under Node for speed.

**Per-file override:** Tests needing a DOM opt in with a top-of-file pragma:
```ts
// @vitest-environment jsdom
```
Used by `App.test.tsx`, `integration.test.tsx`, and `useDiamondArtMatch.test.tsx`. `jsdom` is a devDependency.

## Test Structure

**Suite Organization:**
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { matchColor, clearCache } from '../color';

describe('Color Engine Math & Matching', () => {
  const mockCandidates: DmcColor[] = [ /* inline fixtures */ ];

  beforeEach(() => { clearCache(); });

  describe('matchColor and Caching', () => {
    it('matches RGB values to the nearest mock DMC color candidate', () => {
      expect(matchColor(10, 10, 10, mockCandidates).dmc).toBe('310');
    });
  });
});
```

**Patterns:**
- Nested `describe` blocks: outer = module/feature, inner = function or behavior group.
- `it(...)` descriptions are full sentences describing the guaranteed behavior.
- `beforeEach` resets shared module state (e.g. `clearCache()`, `vi.restoreAllMocks()`, resetting worker arrays).
- Comments inside tests explain expected math (e.g. blend `0*0.5 + 255*0.5 = 127.5 => 128`), keeping numeric assertions self-documenting.

## Mocking

**Framework:** Vitest `vi` — `vi.fn`, `vi.mock`, `vi.spyOn`, `vi.hoisted`, `vi.restoreAllMocks`.

**Module mocking (Preact/component tests):**
```ts
vi.mock('../engine/viewer', () => ({
  CanvasViewer: vi.fn().mockImplementation(() => ({
    setData: mockSetData,
    destroy: mockDestroy,
    /* ...spied methods... */
  })),
}));
```
Hook tests use `vi.hoisted(() => ({ instances: [] }))` to capture mock instances created during module init:
```ts
const { instances } = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('../../../engine/worker-client', () => ({ MatcherClient: class { /* ... */ } }));
```

**Spying (verify without replacing):**
```ts
const matchColorSpy = vi.spyOn(colorModule, 'matchColor');
// ... assert cache behavior:
expect(matchColorSpy.mock.calls.length).toBe(initialCallCount); // cache hit → no new call
```

**Hand-rolled Web Worker mock:** `worker.test.ts` defines a full `class MockWorker implements Worker`, installs it and a fake `globalThis.postMessage` in `beforeAll`, dynamically imports `matcher.worker` so it registers `globalThis.onmessage`, and drives message flow with `setTimeout(..., 0)` to simulate async worker processing. Restores globals in `afterAll`.

**What to Mock:**
- The `CanvasViewer` (no real canvas 2d context under jsdom).
- `MatcherClient` / Web Worker for hook and App tests — the mock calls `onProgress`/`onComplete` synchronously so state settles without a real worker.
- `globalThis.Worker` and `postMessage` for worker-integration tests.
- Canvas 2d context is stubbed so `getImagePixels` can produce pixels.

**What NOT to Mock:**
- Pure engine math (`color`, `bagPlanner`, `checkout`, `smoothing`) — tested against real implementations with inline fixtures.
- The color-science library `culori` — exercised for real to validate CIELAB/CIEDE2000 output.

## Fixtures and Factories

**Test Data:** Inline `mockCandidates: DmcColor[]` literals declared at the top of each suite (fully-shaped `DmcColor` objects with `dmc`, `name`, `hex`, `r/g/b`, `lab`, `kits`). No shared factory or fixtures directory — each test file redeclares the small set of candidates it needs (comment: "to avoid Wave 2 dependencies").

**Location:** Co-located inside the test file; no `fixtures/` directory exists.

## Coverage

**Requirements:** None enforced. No coverage script, no threshold config, no `@vitest/coverage-*` dependency.

**Approximate suite size:** ~145 `it(...)` cases across 17 test files. Engine modules are densely covered; the large `src/App.tsx` orchestrator is exercised indirectly via `App.test.tsx` / `integration.test.tsx` plus exported helpers (`calculateSafetyPurchase` tested directly in `print.test.tsx`).

**View Coverage:**
```bash
npx vitest run --coverage   # requires adding @vitest/coverage-v8 first
```

## Test Types

**Unit Tests:**
- Bulk of the suite. Pure engine functions under the `node` environment with inline fixtures (`color.test.ts`, `bagPlanner.test.ts`, `checkout.test.ts`, `smoothing.test.ts`, `symbols.test.ts`).

**Integration Tests:**
- `src/__tests__/integration.test.tsx` and `App.test.tsx` render `App` under jsdom with `CanvasViewer` and `MatcherClient` mocked, asserting wizard flow and wiring.
- `worker.test.ts` is an integration test across `MatcherClient` ↔ `matcher.worker` ↔ `color` using the mock Worker.

**E2E Tests:** None. No Playwright/Cypress. `print.test.tsx` validates print/supply math, not browser E2E.

## Common Patterns

**Async / worker testing (Promise-wrapped callbacks):**
```ts
const result = await new Promise<{ matches: string[]; counts: Record<string, number> }>((resolve) => {
  client.match(pixels, mockCandidates, onProgress, (res) => resolve(res), cols);
});
expect(result.matches).toEqual(['310', 'BLANC', '310', 'BLANC']);
```
Progress is captured into an array and asserted with `toContain(50)` / `toContain(100)`. Abort paths wait with `await new Promise(r => setTimeout(r, 50))` then assert `completeCalled === false`.

**Numeric / color testing:**
```ts
expect(blackLab.l).toBeCloseTo(0, 1);   // tolerance-based for float color math
expect(result).toEqual({ r: 255, g: 255, b: 255 }); // exact for integer blends
```
Use `toBeCloseTo` for CIELAB/CIEDE2000 outputs, `toEqual` for deterministic integer/structural results.

**Error testing:** Guard-throw functions asserted via thrown-error expectations; abort/no-op paths asserted by observing state (counts unchanged, callback not fired).

---

*Testing analysis: 2026-07-12*
