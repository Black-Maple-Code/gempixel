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
 * commit so the invariant stays observable. As of 23-05 ALL FOUR canvas-first
 * screens are live (`USE_NEW_UPLOAD` + `USE_NEW_REFINE` + `USE_NEW_SUPPLIES` +
 * `USE_NEW_ORDER === true`) — the four-screen journey is complete behind the
 * flags; the legacy Step bodies stay dormant until the Phase 25 strangler
 * cleanup. Constants only — no jsdom pragma needed (default env is node).
 */
describe('screens/flags — strangler swap state', () => {
  it('has all four screens swapped in (Upload + Refine + Supplies + Order live)', () => {
    expect(USE_NEW_UPLOAD).toBe(true);
    expect(USE_NEW_REFINE).toBe(true);
    expect(USE_NEW_SUPPLIES).toBe(true);
    expect(USE_NEW_ORDER).toBe(true);
  });
});
