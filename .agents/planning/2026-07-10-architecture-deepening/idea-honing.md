# Idea Honing — Decisions

Decisions captured during scoping (2026-07-10). These are binding for the design doc and plan.

## Q1. Supply Bag Optimizer reconciliation (Candidate 1)
**Decision: Cart packer is the single source of truth.**
The dye-lot packer (currently `src/engine/checkout.ts:35` `optimizeBags(count)` — ≤800 drills →
200-bags only, respects per-color variant availability in `DRILL_VARIANTS`) becomes the one
algorithm. The displayed cost estimate MUST be derived by re-running the *same* packing logic the
cart uses, so the estimate always equals what the cart charges.

**Load-bearing nuance (surfaced during scoping):** the cart packs **per-color** (each DMC code is
packed against its own available bag sizes in `DRILL_VARIANTS`), while today's estimate
(`App.tsx:1142-1143` `optimizeBags(count, priceDb)`) packs the **aggregate grand total**. Because
of the dye-lot rule and per-color variant availability, packing the grand total can yield a
different bag count than summing per-color packs. Therefore "estimate == cart" requires the estimate
to **sum the per-color packing**, not pack the total. The new module must expose a per-color packing
primitive consumed by both the cart compiler and the cost estimator.

**Consequence:** App's brute-force cost-minimizer `optimizeBags(target, prices)` (`App.tsx:169`) is
**retired** as the estimate source. Its "cheapest combination of 200/500/1000/2000" behavior is not
preserved (superseded by the cart packer). `print.test.tsx` tests that assert the cost-minimizer's
output are removed/replaced with tests asserting estimate-matches-cart.

## Q2. Delivery shape
**Decision: 5 sequential increments.** Each candidate is its own atomic commit, fully verified green
(`npx tsc --noEmit` + `npm test` + `npm run build`) before the next begins. Matches the code-assist
TDD flow and Cardinal Rule 4 (commit clean states immediately). Sequencing:
1. Candidate 1 — Supply Bag Optimizer (fixes latent bug)
2. Candidate 2 — Matcher pipeline hook
3. Candidate 3 — Project & recent-image persistence store
4. Candidate 4 — Active-candidates resolver
5. Candidate 5 — Wizard machine + step components

## Q3. Candidate 5 scope
**Decision: Full extraction.** `useWizard` hook (step/validity/transitions) **and** extract
`Step1Ingest`…`Step4Export` into separate pure view components. Accept the larger JSX surgery for the
full readability win; mitigate regression risk with the existing integration tests
(`App.test.tsx`, `integration.test.tsx`) staying green plus visual verification via `npm run dev`.

## Q4. Behavior + testing bar
**Decision: Strict no-behavior-change + TDD.** No user-facing behavior change **except** the
Candidate 1 reconciliation (Q1). TDD: write a failing test at each new seam first (RED → GREEN per
behavior, tracer-bullet — never all-tests-first). All existing tests (99 per `SUMMARY.md`) stay
green after every increment; each extracted module gets its own unit tests at its new seam.
