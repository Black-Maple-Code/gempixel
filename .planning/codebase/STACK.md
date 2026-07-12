# Technology Stack

**Analysis Date:** 2026-07-12

## Languages

**Primary:**
- TypeScript `^5.3.3` - All application logic under `src/` (engine, features, UI). Configured strict mode via `tsconfig.json`.

**Secondary:**
- TSX/JSX - Preact components (`src/App.tsx`, `src/features/wizard/steps/*.tsx`), compiled with `jsxImportSource: "preact"`.
- CSS - Tailwind directives and print stylesheet in `src/index.css`.
- HTML - Single mount page `index.html`.

## Runtime

**Environment:**
- Browser (client-side only). No server runtime; the app runs entirely in-browser and no image or data leaves the client.
- Node.js v18+ required for development tooling (per `README.md`).

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`, lockfileVersion npm)

## Frameworks

**Core:**
- Preact `^10.25.0` - Lightweight (~4KB) virtual-DOM view layer. Chosen over React to avoid ~45KB bundle weight (see `.agents/GEMINI.md` §5).
- Tailwind CSS `^4.0.0` - Utility-first styling via the Vite plugin (`@tailwindcss/vite`); zero runtime JS.

**Testing:**
- Vitest `^3.0.0` - Test runner. Config in `vite.config.ts` (`test` block), environment `node`, globals enabled.
- jsdom `^29.1.1` - DOM emulation for component/integration tests.

**Build/Dev:**
- Vite `^6.0.7` - Dev server, HMR, bundler, native Web Worker bundling.
- `@preact/preset-vite` `^2.9.0` - Preact integration + Fast Refresh.
- `@tailwindcss/vite` `^4.0.0` - Tailwind v4 Vite plugin.
- TypeScript compiler `tsc` - Typecheck gate during build (`tsc && vite build`).

## Key Dependencies

**Critical:**
- `preact` `^10.25.0` - UI rendering.
- `culori` `^4.0.2` - Color science. Imported tree-shakably from `culori/fn` in `src/engine/color.ts` for sRGB→XYZ→CIELAB conversion and CIEDE2000 difference matching. Local type shim at `src/types/culori.d.ts`.

**Infrastructure:**
- Native Browser Web Workers - Concurrency for heavy color matching (`src/engine/matcher.worker.ts`, `src/engine/worker-client.ts`). No library dependency.
- HTML5 Canvas 2D - Grid rendering and viewport (`src/engine/viewer.ts`).
- HTML5 File API / `URL.createObjectURL` - Local image ingest and blob download (`src/engine/ingest.ts`, `src/engine/export.ts`).
- `window.localStorage` - Client persistence (`src/engine/projectStore.ts`).

## Configuration

**Environment:**
- No environment variables. No `.env*` files present. All configuration is compile-time or user-managed via `localStorage`.
- Path alias `@` → `/src` defined in both `vite.config.ts` (`resolve.alias`) and `tsconfig.json` (`paths`).

**Build:**
- `vite.config.ts` - Plugins (`preact()`, `tailwindcss()`), Vitest config, path alias.
- `tsconfig.json` - `target`/`module` ESNext, `moduleResolution: bundler`, strict + `noUnusedLocals`/`noUnusedParameters`/`noImplicitReturns`/`noFallthroughCasesInSwitch`, `noEmit: true`.
- `index.html` - App mount point.

**Scripts (`package.json`):**
- `npm run dev` - Vite dev server (http://localhost:5173)
- `npm run build` - `tsc && vite build` (typecheck + production bundle to `dist/`)
- `npm run preview` - Preview built bundle
- `npm test` - `vitest run`

## Platform Requirements

**Development:**
- Node.js v18+, npm.
- Modern browser supporting Web Workers (module type), Canvas 2D, File API.

**Production:**
- Static hosting only. Build output is a static `dist/` bundle deployable to any static host/CDN. No backend required.

---

*Stack analysis: 2026-07-12*
