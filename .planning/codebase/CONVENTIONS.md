# Coding Conventions

**Analysis Date:** 2026-07-12

## Naming Patterns

**Files:**
- Engine / logic modules: `camelCase.ts` — `color.ts`, `bagPlanner.ts`, `worker-client.ts`, `projectStore.ts`. Multi-word engine files may use camelCase (`bagPlanner`) or kebab-case (`worker-client`); camelCase dominates.
- Web Worker entry: suffixed `.worker.ts` — `matcher.worker.ts` (Vite recognizes this for `new Worker(new URL(...))`).
- Preact components: `PascalCase.tsx` — `App.tsx`, `Step1Ingest.tsx`, `Step2Palette.tsx`.
- Hooks: `useCamelCase.ts` — `useWizard.ts`, `useDiamondArtMatch.ts`.
- Ambient type decls: `*.d.ts` under `src/types/` — `culori.d.ts`, `assets.d.ts`.
- Test files: co-located under `__tests__/`, named `<module>.test.ts` / `.test.tsx`.

**Functions:**
- `camelCase`, verb-first: `matchColor`, `rgbToLab`, `blendAlpha`, `substituteLowCountColors`, `calculateSafetyPurchase`, `getColorDistance`.
- Exported pure functions are the norm in `src/engine/`; each carries a JSDoc block describing behavior.

**Variables:**
- `camelCase` locals: `minDistance`, `bestMatch`, `activeCandidates`.
- Quantized/derived values use a short suffix convention: `rQ`, `gQ`, `bQ` (quantized), `aNormalized`, `rBlended`.
- Module-level constants and static tables: `SCREAMING_SNAKE_CASE` — `DMC_PALETTE`, `PRINTKK_BASE_SIZES`.

**Types:**
- `PascalCase` interfaces/types: `DmcColor`, `LabCoordinates`, `WizardApi`, `Step1IngestProps`, `RecentImage`, `MatchInputs`, `MatchState`.
- Component prop interfaces are named `<Component>Props` and declared immediately above the component.
- String-literal unions used heavily instead of enums: `'cover' | 'contain'`, `'cm' | 'inch' | 'grid'`, `'square' | 'round'`.

## Code Style

**Formatting:**
- No formatter config detected (no `.prettierrc`, `.editorconfig`). Style is applied by hand and is consistent.
- 2-space indentation, semicolons required, single quotes for strings/imports.
- Trailing commas in multi-line literals and prop lists.

**Linting:**
- No ESLint/Biome config present. Static correctness is enforced entirely by the TypeScript compiler.
- `tsconfig.json` runs in `strict` mode plus: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`. Treat `tsc --noEmit` as the lint gate.
- Unused params are prefixed with `_` to satisfy `noUnusedParameters` (e.g. `_pixels`, `_candidates` in mocks).

## Import Organization

**Order (observed, not tool-enforced):**
1. Third-party / framework imports — `preact`, `preact/hooks`, `culori/fn`, `vitest`.
2. Local engine/type imports via relative paths — `import { DmcColor } from './types'`.
3. `import type { ... }` used for type-only imports (`import type { RecentImage }`).

**Path Aliases:**
- `@/*` → `src/*` configured in both `tsconfig.json` and `vite.config.ts`. Available but relative paths (`../../../engine/...`) are used predominantly in current code.

## Error Handling

**Patterns:**
- Guard-and-throw for programmer errors on hot paths: `matchColor` throws `new Error('No active candidates provided for color matching.')` when no match is found.
- Defensive `continue` / early-return guards over throwing for skippable data (`substituteLowCountColors` skips missing candidates rather than failing).
- Worker boundary converts thrown errors into messages: caught errors are re-posted as `{ kind: 'error', error: String(err) }` rather than propagating.
- Undefined-safe extraction from third-party results: `result.l !== undefined ? result.l : 0` after culori conversions.

## Logging

**Framework:** None. No logging library; the app is privacy-first and client-only. Avoid introducing `console.*` noise in engine code.

## Comments

**When to Comment:**
- Every exported engine function has a JSDoc `/** ... */` summary of what it does and its parameters.
- Inline comments explain *why*, especially non-obvious performance or correctness decisions — e.g. RGB quantization to `& 0xFC` for cache-hit rate, `// Strict inequality (<) resolves color ties stably`, and worker cache-clear notes (`// D-03: clear cache at the start of each matching run`).
- Component blocks use `{/* ... */}` JSX comments to label UI regions ("Source Image", "Drill Style").
- Comments frequently reference planning/decision IDs (e.g. `D-03`, "Candidate 1 consolidation") tying code to GSD artifacts.

**JSDoc/TSDoc:**
- Descriptive JSDoc (no `@param`/`@returns` tags typically); prose form. Hooks get a multi-line JSDoc explaining the state machine and edge cases (see `useWizard.ts`).

## Function Design

**Size:** Engine functions are small and single-purpose. `src/App.tsx` (2250 lines) is the notable exception — a large orchestrator component (see CONCERNS if generated).

**Parameters:**
- Pure functions take primitives or explicit arrays: `matchColor(r, g, b, activeCandidates)`.
- Hooks take a single `deps` object with a named-field interface: `useWizard(deps: { hasImage; hasMatch; isTestEnv })`.

**Return Values:**
- Prefer returning plain object literals with named fields over tuples: `{ codes, counts }`, `{ safety, packets, purchase }`, `{ r, g, b }`.
- Pure functions return new objects/arrays rather than mutating inputs (`[...gridCodes]`, `{ ...counts }` on no-op paths).

## Module Design

**Exports:**
- Named exports only; no default exports for engine or component modules.
- One responsibility per engine module; UI logic split into `features/wizard/steps/*` presentational components plus hooks.

**Component Architecture:**
- Wizard step components (`Step1Ingest`, etc.) are **pure presentational**: all state and handlers arrive via a `Props` interface — "no local state mirroring engine state". State lives in `App.tsx` and hooks.
- Styling is Tailwind utility classes inline in JSX; a dark slate/indigo theme with custom shades (`slate-850`, `slate-350`) and print utilities (`no-print`).

**Barrel Files:** Not used; modules are imported directly by path.

---

*Convention analysis: 2026-07-12*
