import { describe, it, expect } from 'vitest';
import {
  USE_NEW_UPLOAD,
  USE_NEW_REFINE,
  USE_NEW_SUPPLIES,
  USE_NEW_ORDER,
} from '../flags';

/**
 * Strangler guard (Pitfall 7): each per-screen swap flag flips to `true` in its
 * own plan, one flag per commit, and this assertion is updated in the SAME
 * commit so the invariant stays observable. As of 23-03 the Upload and Refine
 * screens are live (`USE_NEW_UPLOAD` + `USE_NEW_REFINE === true`); Supplies and
 * Order stay `false` until their plans (23-04/23-05) flip them. Constants only —
 * no jsdom pragma needed (default env is node).
 */
describe('screens/flags — strangler swap state', () => {
  it('has Upload + Refine swapped in and Supplies/Order still legacy', () => {
    expect(USE_NEW_UPLOAD).toBe(true);
    expect(USE_NEW_REFINE).toBe(true);
    expect(USE_NEW_SUPPLIES).toBe(false);
    expect(USE_NEW_ORDER).toBe(false);
  });
});
