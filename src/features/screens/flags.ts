/**
 * flags.ts — the per-screen strangler swap gates for Phase 23 (D-02).
 *
 * Each of the four canvas-first screens (Upload · Refine · Supplies · Order) is
 * introduced behind its own compile-time boolean. While a flag is `false`, the
 * matching `data-step-panel` slot in App.tsx keeps rendering its legacy Step
 * body, so runtime behavior is byte-for-byte unchanged and the full Vitest
 * suite stays green.
 *
 * Strangler invariant (Pitfall 7): a subsequent plan flips EXACTLY ONE flag to
 * `true` per commit, updating `__tests__/flags.test.ts` in the same commit so
 * the "one flag per commit" rule is observable. These are plain `const`
 * booleans by design — no typed record, no env plumbing, no runtime input
 * (there is no feature-flag system in the repo, and none should be introduced).
 */
export const USE_NEW_UPLOAD = true;
export const USE_NEW_REFINE = true;
export const USE_NEW_SUPPLIES = true;
export const USE_NEW_ORDER = true;
