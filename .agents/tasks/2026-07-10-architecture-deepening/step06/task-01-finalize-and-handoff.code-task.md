# Task: Finalize the deepening effort and hand off

## Description
Confirm the whole Architecture Deepening effort is clean and leave a trail for the next agent. This is the single task for **Step 6 (Finalize)** — the closeout after the five carve-outs (Candidates 1–5) have landed. No new feature code; this is a full-suite verification, whole-flow visual pass, checklist update, and handoff note.

## Background
After Steps 1–5, `App.tsx` (originally 3321 lines / 52 `useState`, per `research/current-state.md`) should be a materially smaller thin coordinator composing five named modules — `bagPlanner`, `useDiamondArtMatch`, `projectStore`, `resolveActiveCandidates`, `useWizard` + `Step1..4` — each with its own tests. Design N1: no user-facing behavior change except Step 1's estimate==cart reconciliation. This step proves the whole is green and documents the new module map.

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§2 Requirements, §3 Architecture after, §7 Testing)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 6)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Verify gates; §Test inventory baseline 99 passing)
- `SUMMARY.md` (repo root — append the handoff note here)

**Note:** This step assumes Steps 1–5 are merged green. If any earlier increment is incomplete, stop and report rather than papering over it.

## Technical Requirements
1. Run the full verify gate one final time: `npx tsc --noEmit` && `npm test` (all green, **≥99** — should now be higher with the five new test files) && `npm run build`.
2. Do a `npm run dev` (http://localhost:5173) pass over the **whole** flow: ingest → palette → canvas/pricing → export/cart. Confirm estimate == cart in the Step 3 legend vs the Step 4 cart, and that steps 3–4 stay locked until a match exists.
3. Update the plan's progress checklist in `implementation/plan.md` — mark Steps 1–6 `[x]`.
4. Append a short handoff to `SUMMARY.md` (or the repo's summary doc): the new module map (`src/engine/bagPlanner.ts`, `src/engine/projectStore.ts`, `src/engine/candidates.ts`, `src/features/match/useDiamondArtMatch.ts`, `src/features/wizard/useWizard.ts` + `steps/Step1..4`), confirmation that estimate == cart, the final test count, and any deviations from the plan's ordering.
5. Do **not** introduce new behavior or new dependencies; this is verification + documentation only.

## Dependencies
- Steps 1–5 all merged and green.
- Repo verify tooling (`tsc`, `vitest`, `vite build`, `vite dev`).

## Implementation Approach
1. Confirm each of Steps 1–5 is committed and green (re-run the gate); if not, halt and report which increment is outstanding.
2. Run `tsc --noEmit`, `npm test`, `npm run build`; capture the final passing test count.
3. `npm run dev` whole-flow pass; verify estimate==cart and step gating visually.
4. Mark the checklist `[x]` for all steps; append the handoff note (module map, estimate==cart confirmation, test count, deviations) to `SUMMARY.md`.
5. **Guardrail (Cardinal Rule 4):** commit the doc/checklist updates only after the gate is green: `docs(deepening): finalize architecture-deepening — module map + handoff`.

## Acceptance Criteria

1. **Full gate green** — Given the completed effort, when `npx tsc --noEmit`, `npm test`, `npm run build` run, then all pass with ≥99 tests (higher than baseline) and a clean build.
2. **Whole-flow visual pass** — Given `npm run dev`, when walking ingest→palette→canvas→export, then every step behaves as before and the Step 3 legend bag counts equal the Step 4 cart packing (estimate == cart).
3. **Thinner coordinator** — Given `App.tsx` post-effort, when compared to the 3321-line baseline, then it is materially smaller and composes the five named modules, each of which has its own test file.
4. **Checklist + handoff updated** — Given `implementation/plan.md` and `SUMMARY.md`, when reviewed, then all six steps are `[x]` and the handoff note records the module map, estimate==cart confirmation, final test count, and any deviations.

## Metadata
- **Complexity**: Low
- **Labels**: verification, handoff, docs, finalize
- **Required Skills**: Vitest/Vite verification, technical writing (handoff notes)
