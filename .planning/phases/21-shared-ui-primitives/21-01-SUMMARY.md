---
phase: 21-shared-ui-primitives
plan: 01
subsystem: ui-primitives
tags: [preact, tailwind-v4, design-system, primitives]
requires: []
provides:
  - "src/ui/cn.ts::cn — zero-dep class-join helper (foundation for every src/ui primitive)"
  - "src/ui/Button.tsx::Button + ButtonProps + ButtonVariant ('primary'|'save'|'ghost')"
  - "src/ui/Pill.tsx::Pill + PillProps + PillVariant ('neutral'|'ok'|'tag')"
affects:
  - "Phase 23 screen composition (consumes Button/Pill instead of inline Tailwind soup)"
tech-stack:
  added: []
  patterns:
    - "variant → Record<Variant,string> token-class map + cn() merge (className last, ...rest spread)"
    - "className narrowed to plain string in *Props to sidestep Preact's Signalish<string> incompatibility with cn()"
    - "arbitrary-value radius (rounded-[20px] / rounded-[var(--radius-pill)]) because radius tokens are not exposed via @theme inline"
key-files:
  created:
    - src/ui/cn.ts
    - src/ui/Button.tsx
    - src/ui/Pill.tsx
    - src/ui/__tests__/Button.test.tsx
    - src/ui/__tests__/Pill.test.tsx
  modified: []
decisions:
  - "Redeclared className as plain string in ButtonProps/PillProps (Omit'd from ComponentProps) — Preact types native className as Signalish<string>, which the plain-string cn() join rejects under strict tsc."
metrics:
  duration: ~18m
  completed: 2026-07-14
  tasks: 2
  files: 5
  tests-added: 14
  tests-total: 269
status: complete
---

# Phase 21 Plan 01: Shared UI Primitives Foundation (cn + Button + Pill) Summary

Zero-dependency `cn()` class-join helper plus two pure, token-driven Preact primitives — `Button` (primary/save/ghost) and `Pill` (neutral/ok/tag) — each props-only, styled entirely from existing Atelier tokens, with co-located raw-`preact` render tests. This is the Wave-1 `src/ui/` foundation every later primitive imports.

## What Was Built

- **`src/ui/cn.ts`** — `cn(...classes)` returns `classes.filter(Boolean).join(' ')`. JSDoc documents that it only joins and does NOT resolve Tailwind conflicts (precedence is stylesheet-generation order; use `!` for hard overrides), and that tailwind-merge is deliberately not added per D-03.
- **`src/ui/Button.tsx`** — `Button` + `ButtonProps` + `ButtonVariant`. Native `<button type="button">`, `VARIANTS` map (`primary`=`bg-accent text-on-accent`, `save`=AtelierShell dark-pill recipe `bg-ink text-on-accent rounded-[20px] …`, `ghost`=`border border-border text-ink`), base classes + variant + `className` merged last via `cn()`, `...rest` spread. No internal state.
- **`src/ui/Pill.tsx`** — `Pill` + `PillProps` + `PillVariant`. Plain `<span>` chip, `VARIANTS` map (`neutral`=`bg-panel-2 text-muted border`, `ok`=`bg-[#EAF2EF] text-accent` accent-tint, `tag`=`bg-panel-2 text-faint uppercase … font-mono`), shared `rounded-[var(--radius-pill)]`, same cn/className-last/...rest shape.
- **Tests** — `Button.test.tsx` (8) and `Pill.test.tsx` (6) using the StepBar jsdom harness (`// @vitest-environment jsdom`, raw `preact` `render()`, container in beforeEach, `render(null, container)` cleanup). No `@testing-library/preact`.

## How It Works / Key Decisions

- Both primitives follow one D-02 shape: `variant` keys into a local `Record<Variant,string>` of token utilities; `cn(base, VARIANTS[variant], className)` guarantees consumer `className` is source-order last; `...rest` forwards native attributes (`onClick`, `disabled`, `aria-*`).
- Radius tokens (`--radius-pill` 20px, `--radius-control` 8px) live on `:root` but are NOT in `@theme inline`, so `rounded-pill`/`rounded-control` utilities don't exist — used arbitrary values `rounded-[20px]` / `rounded-[var(--radius-pill)]` / `rounded-[var(--radius-control)]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `className` typed as Preact `Signalish<string>` broke strict tsc**
- **Found during:** Task 1 (GREEN typecheck)
- **Issue:** `ButtonProps extends Omit<ComponentProps<'button'>, 'variant'>` inherits `className: Signalish<string | undefined>`; passing it to the plain-string `cn()` failed `TS2345` under strict mode.
- **Fix:** Also `Omit` `'className'` from `ComponentProps` and redeclare `className?: string` (documented in JSDoc). Applied identically to `PillProps`. These primitives take literal class strings only, so no capability is lost.
- **Files modified:** src/ui/Button.tsx, src/ui/Pill.tsx
- **Commits:** bd0c863 (Button), 7a81183 (Pill)

## Threat Surface

No new threat surface. Per the plan threat register: T-21-01 (text `children` XSS) mitigated — Preact escapes text children, no `dangerouslySetInnerHTML`; T-21-02 (supply chain) mitigated — zero dependencies added (verified: `git diff package.json package-lock.json` empty). No new network/storage/auth/routing surface.

## Verification

- `npx tsc --noEmit` → exit 0 (strict, incl. noUnusedLocals/noUnusedParameters).
- `npx vitest run` → 269/269 passing across 25 files (255 baseline + 14 new; ≥255 SC4).
- `git diff --exit-code -- package.json package-lock.json` → empty (D-03 / SC3).
- `ls src/ui/StepNav*` → none (D-01).
- Acceptance greps: Button `bg-ink`≥1, `rounded-[20px]`≥1, `useState`==0; Pill `rounded-[var(--radius-pill)]`≥1, `useState`==0.

## TDD Gate Compliance

Both tasks followed RED → GREEN. Gate commits present in git log:
- Button: `test(21-01)` 408e498 (RED) → `feat(21-01)` bd0c863 (GREEN)
- Pill: `test(21-01)` 1f8f0f6 (RED) → `feat(21-01)` 7a81183 (GREEN)

No REFACTOR commits needed (implementations minimal).

## Self-Check: PASSED

- Files exist: src/ui/cn.ts, src/ui/Button.tsx, src/ui/Pill.tsx, src/ui/__tests__/Button.test.tsx, src/ui/__tests__/Pill.test.tsx — all present.
- Commits exist: 408e498, bd0c863, 1f8f0f6, 7a81183 — all in git log.
