# GemPixel — Claude Code Guide

GemPixel is a **privacy-first, client-side diamond-art / gem-art planner**: it maps any
user-loaded image to a grid of DMC / Art Dot colors using CIEDE2000 color science, counts
supplies, and exports printable canvases. It runs entirely in-browser (Preact + Vite +
TypeScript + Tailwind v4; heavy color matching runs in a Web Worker). No image ever leaves
the client.

## This project is GSD-managed

Planning, roadmap, and state live in `.planning/`. The canonical agent guide (stack,
architecture, conventions, developer profile, and the **GSD workflow-enforcement rules**) is
maintained by GSD in [.agents/GEMINI.md](.agents/GEMINI.md) and imported below — treat it as
always in effect. It is named `GEMINI.md` because the project was previously driven from the
Gemini CLI; the content is CLI-agnostic.

@.agents/GEMINI.md

## Working here as Claude Code

- **Do not edit outside a GSD workflow.** Enter through a GSD command so `.planning/`
  artifacts stay in sync: `/gsd-quick` for small fixes, `/gsd-debug` for investigation,
  `/gsd-execute-phase` for planned work, `/gsd-progress` to see where things stand.
- **Milestone v2.0 is complete** — 9/9 phases, 19/19 plans, 100% (`.planning/STATE.md`).
  Starting new work means opening a new milestone (`/gsd-new-milestone`).

## Codebase onboarding

Codebase intel has not been generated yet (there is no `.planning/codebase/`). Before deep
work, run **`/gsd-map-codebase`** from this directory to produce the codebase analysis
documents. Quick manual orientation:

- `src/engine/` — pure logic: `color.ts` (CIELAB / CIEDE2000 matching), `ingest.ts` (image
  load + Box-Sampling downscale), `palette.ts` (static DMC / Art Dot catalogs), `viewer.ts`
  (canvas zoom/pan), `symbols.ts`, `export.ts`, `checkout.ts` (vendor links), `variants.ts`,
  `matcher.worker.ts` + `worker-client.ts` (Web Worker matching), `types.ts`.
- `src/App.tsx` — the 4-step wizard UI, supply checklist, and viewport HUD controller.
- Tests live in `src/engine/__tests__/` and `src/__tests__/` (Vitest + jsdom).

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (Vite, http://localhost:5173) |
| Typecheck + build | `npm run build` (`tsc && vite build`) |
| Typecheck only | `npx tsc --noEmit` |
| Tests | `npm test` (`vitest run`) |
