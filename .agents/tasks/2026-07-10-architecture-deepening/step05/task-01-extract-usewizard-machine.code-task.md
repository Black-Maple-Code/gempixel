# Task: Extract the `useWizard` machine (step / validity / transitions)

## Description
Extract the 4-step wizard's step number, transition, and validity logic out of `App.tsx` into a `src/features/wizard/useWizard.ts` hook that is the **single source of truth** for "can I enter step N?". This is task 1 of 5 for **Step 5 (Candidate 5)** — it lands the hook and rewires the nav footer/dots to it, with the four step render blocks staying inline for now (tasks 02–05 extract each into a pure component). Doing the hook first lets the risky JSX surgery proceed one step at a time against a stable state machine.

## Background
Today the wizard logic is scattered across `App.tsx` (`research/current-state.md` §Candidate 5):
- `~:299` `wizardStep: number` (1–4); `~:492` reset to 1.
- `~:417` `isStepValid(step)` (e.g. `step === 3 || step === 4 → !!matchResult`).
- Nav footer with dots + Back/Next spans **two separate renderings** — a mobile/sidebar footer (`~:2382-2435`) and a desktop top progress bar (`~:2438-2484`) — each with its own dots array and Next button, i.e. **4** duplicated `isStepValid(...) || isTestEnv` inline checks total (`~:2399`, `~:2426`, `~:2448`, `~:2479`), not 2; an `isTestEnv` bypass exists for tests.

Per design §4 Candidate 5 / R5 / §6 C5: `useWizard({ hasImage, hasMatch, isTestEnv })` returns `{ step, canEnter, next, back, goTo, reset }`, and `canEnter` becomes the one validity source replacing the duplicated dot/button checks. No behavior change (design N1). Hooks live under `src/features/` (created in Step 4).

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 5, §6 Error Handling C5)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 5)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 5 anchors; §Test inventory — `App.test.tsx` wizard nav `< Back`, `isTestEnv`)

**Note:** You MUST read design §4 Candidate 5 before implementing. Anchors are heavily pre-drift (Steps 1–4 edited `App.tsx`) — re-grep `wizardStep`, `isStepValid`, the `~:2382-2480` nav footer, and the `isTestEnv` bypass before editing.

## Technical Requirements
1. Create `src/features/wizard/useWizard.ts` exporting (design §4 Candidate 5):
   - `interface WizardApi { step: number; canEnter(step: number): boolean; next(): void; back(): void; goTo(step: number): void; reset(): void; }`
   - `function useWizard(deps: { hasImage: boolean; hasMatch: boolean; isTestEnv: boolean }): WizardApi`
2. `canEnter` MUST encode the exact current rules from `isStepValid` (`~:417`): steps 3 and 4 require a match (`hasMatch`); preserve any step-1/2 gating and the `isTestEnv` bypass verbatim. `goTo`/`next`/`back` guard invalid transitions through `canEnter` (design §6 C5). `reset()` returns to step 1 (`~:492`).
3. Replace the duplicated validity checks across **both** nav footer renderings — the mobile/sidebar footer (`~:2382-2435`: dots at `~:2396-2419`, Next button at `~:2422-2430`) and the desktop top progress bar (`~:2438-2484`: dots at `~:2444-2473`, Next button at `~:2476-2484`) — with `wizard.canEnter(n)` / `wizard.step` at all 4 sites. The four inline step render blocks (`~:1370/1693/1908/2238`) stay inline this task; App drives them with `wizard.step` (e.g. `{wizard.step === 1 && (<...inline...>)}`). Also update the print-only legend checklist guard at `~:3299` (`{wizardStep === 3 && matchResult && (...)}`, the printable checklist container) to `{wizard.step === 3 && matchResult && (...)}` — this is a **fifth** `wizardStep` reference outside the four step blocks and the nav footer; missing it will break the build once App's `wizardStep` state is removed (Requirement 4).
4. Remove App's `wizardStep` `useState` and `isStepValid` once the hook owns them; do not mirror `wizard.step` into a second local state.

## Dependencies
- `hasImage` / `hasMatch` are **not** existing named values in `App.tsx` (confirmed via grep — no `hasImage`/`hasMatch` identifier exists anywhere in the file). They must be **derived inline** at the `useWizard(...)` call site from state that already exists: `hasImage: !!(image || activeProjectId)` (mirrors `isStepValid` step 2, `~:416`), `hasMatch: !!matchResult` (mirrors steps 3/4, `~:417`). `isTestEnv` DOES already exist as a value (`~:238`: `typeof window !== 'undefined' && navigator.userAgent.includes('jsdom')`) and can be passed through as-is.
- `src/__tests__/App.test.tsx` + `integration.test.tsx` (wizard nav `< Back`, dot gating) — must stay green.

## Implementation Approach
1. Re-grep `wizardStep`, `isStepValid`, the nav footer block, and how `isTestEnv` is derived today.
2. **Write the failing tests first (TDD, RED→GREEN per behavior):** create `src/features/wizard/__tests__/useWizard.test.ts`: transitions (`next`/`back`/`goTo`), `canEnter` gating (no match → cannot reach 3/4), `isTestEnv` bypass allows navigation in tests.
3. Implement `useWizard`; port `isStepValid`'s logic into `canEnter` unchanged.
4. Rewire the nav footer dots + Back/Next to the hook; keep the four step blocks inline, gated by `wizard.step`. Remove the old `wizardStep` state + `isStepValid`.
5. **Guardrail — UI-touching:** `npm run dev` — click through all four steps; confirm Back/Next and the progress dots enable/disable identically to before and that steps 3–4 stay locked until a match exists.
6. **Verify gate (Cardinal Rule 4):** `npx tsc --noEmit` && `npm test` (≥99) && `npm run build` && `npm run dev` pass. Commit only when green: `refactor(wizard): extract useWizard state machine`.

## Acceptance Criteria

1. **Transitions**
   - Given `useWizard` at step 1
   - When `next()`/`back()`/`goTo(n)` are called
   - Then `step` moves per the rules and never past a step `canEnter` forbids.

2. **Validity gating**
   - Given `hasMatch === false`
   - When checking `canEnter(3)` / `canEnter(4)`
   - Then both are false (steps 3–4 require a match), matching the old `isStepValid`.

3. **Test-env bypass**
   - Given `isTestEnv === true`
   - When navigation is attempted
   - Then the bypass behaves exactly as the pre-refactor `isTestEnv` path.

4. **Footer reads one source, no behavior change**
   - Given the rewired nav footer
   - When rendering dots + Back/Next
   - Then both derive from `wizard.canEnter`/`wizard.step` (no duplicated checks), and `npm run dev` shows identical enable/disable behavior; App has no `wizardStep` `useState` or `isStepValid`.

5. **Suite + build green**
   - When `npx tsc --noEmit`, `npm test` (≥99, incl. `useWizard.test.ts` + `App.test.tsx` nav), `npm run build` run
   - Then all pass.

## Metadata
- **Complexity**: Medium
- **Labels**: features, wizard, state-machine, candidate-5
- **Required Skills**: Preact hooks, TypeScript, Vitest (TDD)
