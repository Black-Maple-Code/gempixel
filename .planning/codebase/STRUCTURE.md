# Codebase Structure

**Analysis Date:** 2026-07-12

## Directory Layout

```
gempixel/
├── index.html            # Vite entry HTML; mounts #app
├── src/
│   ├── main.tsx          # App bootstrap: render(<App/>, #app)
│   ├── App.tsx           # Root component: state, layout, wizard/HUD (~2250 lines)
│   ├── index.css         # Tailwind v4 entry + global styles
│   ├── logo.png          # App logo asset
│   ├── engine/           # Pure domain logic + worker (no Preact)
│   │   └── __tests__/     # Vitest unit tests for engine modules
│   ├── features/         # Stateful UI workflows (hooks + components)
│   │   ├── match/         # useDiamondArtMatch pipeline hook + tests
│   │   └── wizard/        # useWizard state machine + steps/ + tests
│   ├── types/            # Ambient TS declarations (assets, culori)
│   └── __tests__/        # App / integration / print tests
├── dist/                 # Vite build output (generated)
├── scratch/              # Ad-hoc experiments (not shipped)
├── .planning/            # GSD planning, roadmap, state, codebase docs
├── .agents/              # GSD agent guide (GEMINI.md), planning/tasks history
├── package.json          # Deps: preact, culori; dev: vite, vitest, tailwind v4
├── tsconfig.json         # TS config (strict)
├── vite.config.ts        # Vite + Preact preset + Tailwind plugin
├── CLAUDE.md             # Claude Code project guide
└── GEMINI.md / README.md / SUMMARY.md  # Project docs
```

## Directory Purposes

**`src/engine/`:**
- Purpose: All domain logic — color science, ingest, planning, export, persistence, worker.
- Contains: Pure TS modules (`.ts`), static catalogs, the Web Worker.
- Key files: `color.ts`, `ingest.ts`, `palette.ts`, `candidates.ts`, `smoothing.ts`, `symbols.ts`, `bagPlanner.ts`, `checkout.ts`, `export.ts`, `variants.ts`, `viewer.ts`, `projectStore.ts`, `matcher.worker.ts`, `worker-client.ts`, `types.ts`.

**`src/features/`:**
- Purpose: Cohesive, stateful UI workflows extracted from `App.tsx`.
- Contains: Preact hooks (`use*.ts`) and step components (`.tsx`).
- Key files: `match/useDiamondArtMatch.ts`, `wizard/useWizard.ts`, `wizard/steps/Step[1-4]*.tsx`.

**`src/types/`:**
- Purpose: Ambient module/asset type declarations.
- Contains: `assets.d.ts`, `culori.d.ts`.

**Test directories (`__tests__/`):**
- Purpose: Co-located Vitest suites per layer.
- Contains: `*.test.ts` / `*.test.tsx` mirroring source module names.

## Key File Locations

**Entry Points:**
- `index.html`: HTML host, loads `src/main.tsx`.
- `src/main.tsx`: Mounts `<App/>`.
- `src/engine/matcher.worker.ts`: Web Worker entry.

**Configuration:**
- `vite.config.ts`: Build/dev + Preact + Tailwind.
- `tsconfig.json`: TypeScript compiler options.
- `src/index.css`: Tailwind v4 + globals.

**Core Logic:**
- `src/engine/color.ts`: CIELAB / CIEDE2000 matching + substitution.
- `src/engine/ingest.ts`: Dimensioning + box-sampling downscale.
- `src/engine/palette.ts` / `variants.ts`: Static DMC / Art Dot catalogs.
- `src/features/match/useDiamondArtMatch.ts`: Image→grid pipeline.
- `src/App.tsx`: UI composition and state.

**Persistence:**
- `src/engine/projectStore.ts`: localStorage projects + recent images.

**Testing:**
- `src/engine/__tests__/`, `src/features/**/__tests__/`, `src/__tests__/`.

## Naming Conventions

**Files:**
- Engine modules: `camelCase.ts` (e.g., `bagPlanner.ts`, `worker-client.ts` uses kebab for the client pair).
- Worker: `*.worker.ts` suffix (`matcher.worker.ts`).
- Components: `PascalCase.tsx` (e.g., `Step1Ingest.tsx`, `App.tsx`).
- Hooks: `useX.ts` (e.g., `useWizard.ts`, `useDiamondArtMatch.ts`).
- Tests: `<name>.test.ts(x)` in a sibling `__tests__/` dir.
- Ambient types: `*.d.ts` in `src/types/`.

**Directories:**
- Feature folders: `camelCase` grouping a workflow (`match/`, `wizard/`).
- Test folders: `__tests__/` co-located with the code under test.

## Where to Add New Code

**New engine capability (color/planning/export logic):**
- Primary code: `src/engine/<name>.ts` (keep pure — no Preact, avoid DOM unless render/export).
- Tests: `src/engine/__tests__/<name>.test.ts`.

**New stateful UI workflow:**
- Hook: `src/features/<feature>/use<Feature>.ts` exposing a read-only signal surface.
- Tests: `src/features/<feature>/__tests__/`.

**New wizard step:**
- Component: `src/features/wizard/steps/Step<N><Name>.tsx`.
- Wire into `App.tsx` imports and `useWizard.canEnter` gating.

**New vendor / checkout target:**
- Extend `VENDOR_REGISTRY` and compile helpers in `src/engine/checkout.ts`.

**Utilities / shared types:**
- Domain types: `src/engine/types.ts`.
- Ambient/asset declarations: `src/types/*.d.ts`.

## Special Directories

**`dist/`:**
- Purpose: Vite production build output.
- Generated: Yes. Committed: No (build artifact).

**`scratch/`:**
- Purpose: Throwaway experiments.
- Generated: No. Committed: Not shipped code.

**`.planning/` and `.agents/`:**
- Purpose: GSD planning, roadmap, state, agent guide, and this codebase map.
- Generated: Partly (by GSD). Committed: Yes.

---

*Structure analysis: 2026-07-12*
