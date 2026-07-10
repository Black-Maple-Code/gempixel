import { DmcColor } from './types';
import { DMC_PALETTE } from './palette';

/**
 * Resolve the set of DMC colors currently "in play" for matching: the base
 * catalog filtered by the selected kit, minus any user-excluded colors.
 *
 * Pure — no Preact, no DOM, no side effects. Names a load-bearing concept so
 * the App can memoize it (one allocation per kit/exclusion change instead of
 * per render). Identity is `dmc` (a string code); kit membership is `kits`.
 */
export function resolveActiveCandidates(
  kit: 'all' | '100' | '200',
  excluded: Set<string>
): DmcColor[] {
  const base = kit === 'all' ? DMC_PALETTE : DMC_PALETTE.filter(c => c.kits.includes(kit));
  return excluded.size === 0 ? base.slice() : base.filter(c => !excluded.has(c.dmc));
}
