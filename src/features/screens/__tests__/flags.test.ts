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
 * commit so the invariant stays observable. As of 23-02 the Upload screen is
 * live (`USE_NEW_UPLOAD === true`); the remaining three stay `false` until
 * their plans (23-03..23-05) flip them. Constants only — no jsdom pragma needed
 * (default env is node).
 */
describe('screens/flags — strangler swap state', () => {
  it('has Upload swapped in and the other three still legacy', () => {
    expect(USE_NEW_UPLOAD).toBe(true);
    expect(USE_NEW_REFINE).toBe(false);
    expect(USE_NEW_SUPPLIES).toBe(false);
    expect(USE_NEW_ORDER).toBe(false);
  });
});
