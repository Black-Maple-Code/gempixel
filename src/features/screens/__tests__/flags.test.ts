import { describe, it, expect } from 'vitest';
import {
  USE_NEW_UPLOAD,
  USE_NEW_REFINE,
  USE_NEW_SUPPLIES,
  USE_NEW_ORDER,
} from '../flags';

/**
 * Strangler guard (Pitfall 7): all four per-screen swap flags default `false`,
 * so App.tsx renders the legacy Step bodies and the suite stays green. A plan
 * that flips a flag to `true` updates the matching assertion below in the SAME
 * commit, keeping the "one flag per commit" invariant observable. Constants
 * only — no jsdom pragma needed (default env is node).
 */
describe('screens/flags — strangler swap defaults', () => {
  it('defaults every USE_NEW_* flag to false', () => {
    expect(USE_NEW_UPLOAD).toBe(false);
    expect(USE_NEW_REFINE).toBe(false);
    expect(USE_NEW_SUPPLIES).toBe(false);
    expect(USE_NEW_ORDER).toBe(false);
  });
});
