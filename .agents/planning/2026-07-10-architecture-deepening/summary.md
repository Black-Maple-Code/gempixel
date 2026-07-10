# Summary — GemPixel Architecture Deepening PDD

**Repo:** `gempixel` (`master`). **Created:** 2026-07-10. **Status:** PDD complete; ready for
code-task generation.

## What this is
A design + implementation plan to resolve five architectural deepening opportunities in `gempixel`
as it nears v1 — carving five deep modules out of the 3321-line `src/App.tsx` God component and
fixing one latent supply-cost bug, with no user-facing behavior change except that fix.

## Artifacts (read in this order)
| File | Purpose | Who reads it |
|---|---|---|
| `rough-idea.md` | Full 5-candidate analysis + vocabulary | anyone onboarding |
| `idea-honing.md` | **Binding decisions** (bug reconciliation, delivery, scope, test bar) | all phases |
| `research/current-state.md` | Exact as-is signatures, call sites, test map | code-task gen + coding |
| `design/detailed-design.md` | Target architecture, per-candidate interfaces, testing strategy | code-task gen + coding |
| `implementation/plan.md` | 6 sequential TDD increments + checklist | coding |
| `summary.md` | This file | all phases |

## Binding decisions (from idea-honing.md)
1. **Supply bag optimizer:** cart's dye-lot packer is the single source of truth; the cost estimate
   re-runs it (per-color) so estimate == cart. App's cost-minimizer `optimizeBags` is retired.
2. **Delivery:** 5 sequential atomic commits, each verified green before the next.
3. **Wizard:** full extraction (`useWizard` hook + `Step1..4` components).
4. **Bar:** strict no-behavior-change (except #1) + TDD; all 99 tests stay green; unit tests per new
   module.

## The five modules created
- `src/engine/bagPlanner.ts` (C1) — per-color packing primitive; cart + estimate consume it.
- `src/engine/candidates.ts` (C4) — `resolveActiveCandidates(kit, exclusions)`.
- `src/engine/projectStore.ts` (C3) — localStorage CRUD + quota eviction.
- `src/features/match/useDiamondArtMatch.ts` (C2) — worker lifecycle + match pipeline.
- `src/features/wizard/useWizard.ts` + `steps/Step{1..4}*.tsx` (C5) — wizard machine + step views.

## Next steps (3-phase pipeline, context cleared between each)
1. **Code-task generation** — run `/code-task-generator` against `implementation/plan.md`. It
   processes plan steps one at a time into `.code-task.md` files. Point it at this directory and tell
   it to also load `design/detailed-design.md` + `research/current-state.md`. Optionally
   `/code-task-review` each task against the live `gempixel` tree before coding (line anchors drift).
2. **Coding** — run `/code-assist` per `.code-task.md`, one increment at a time, TDD. Verify gate
   after each: `npx tsc --noEmit` && `npm test` && `npm run build` (+ `npm run dev` for C2/C5).
   Commit clean per Cardinal Rule 4.
3. After all five: full-suite verify + visual pass (plan Step 6).

## Open items / watch-outs
- **Estimate == cart is a *behavior change* for the displayed cost** (intended). When verifying C1,
  confirm the new per-color numbers match the cart, and update any snapshot/print tests that encoded
  the old cost-minimizer output.
- Repo has **no `src/features/` dir yet** — created in Step 4 (C2); keep hook/component vs. engine
  split consistent.
- `gempixel` is GSD-managed (`.planning/`). This work is driven via the Fretted PDD → code-task →
  code-assist pipeline instead; docs live here under `.agents/planning/`. If the user prefers GSD
  execution, the plan maps cleanly onto a GSD milestone (5 phases = 5 increments).
- All line numbers are 2026-07-10 anchors from `master`; **re-grep before editing**.
