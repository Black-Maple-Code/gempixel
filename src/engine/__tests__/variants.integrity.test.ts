import { describe, it, expect } from 'vitest';
import { DRILL_VARIANTS } from '../variants';
import { DMC_PALETTE } from '../palette';

/**
 * DATA-01 — Drill-variant table integrity guard.
 *
 * The 5,107-line hand/scraped DRILL_VARIANTS SKU table decides which physical
 * product each color orders. A duplicate variant ID orders the wrong color; an
 * empty mapping silently drops a color from the supply plan (Pitfalls 9, 15).
 *
 * This test ratchets against future drift: it PASSES today with every KNOWN
 * hole explicitly allow-listed, and FAILS the moment a NEW duplicate ID or a
 * NEW empty mapping appears. The allow-lists below encode SAFE reversible
 * defaults pending a data-owner adjudication (see 15-03 checkpoint).
 */

const SHAPES = ['square', 'round'] as const;

/**
 * Variant-ID pairs that intentionally point at the same physical SKU, pending
 * adjudication. Each inner array is the exact set of DMC codes that share an ID.
 * TODO adjudicate: intended alias vs data bug — confirm with data owner
 */
const ALLOWLISTED_SHARED_ID_CODES: ReadonlyArray<readonly string[]> = [
  ['731', '732'],
  ['781', '782'],
  ['776', '3326'],
];

/**
 * Palette color+shape pairs with a known empty mapping, surfaced-as-unmapped
 * rather than guessed (locked decision — do NOT invent a mapping here).
 * TODO adjudicate: intended alias vs data bug — confirm with data owner
 */
const ALLOWLISTED_EMPTY_MAPPINGS: ReadonlyArray<readonly [string, string]> = [
  ['471', 'square'],
  ['798', 'round'],
  ['BLANC', 'round'],
  ['ECRU', 'round'],
];

// Normalized "sorted, joined" keys for fast set membership.
const allowedSharedKeys = new Set(
  ALLOWLISTED_SHARED_ID_CODES.map((pair) => [...pair].sort().join('|')),
);
const allowedEmptyKeys = new Set(
  ALLOWLISTED_EMPTY_MAPPINGS.map(([code, shape]) => `${code}|${shape}`),
);

describe('DRILL_VARIANTS integrity (DATA-01)', () => {
  it('every variant ID is a positive integer', () => {
    const offenders: string[] = [];
    for (const [code, shapes] of Object.entries(DRILL_VARIANTS)) {
      for (const shape of SHAPES) {
        const mapping = shapes[shape] ?? {};
        for (const [size, id] of Object.entries(mapping)) {
          if (!(Number.isInteger(id) && (id as number) > 0)) {
            offenders.push(`${code}/${shape}/${size} = ${id}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('variant IDs are unique across DMC codes except the allow-listed shared pairs', () => {
    // Build variantId -> set(owning DMC codes).
    const idOwners = new Map<number, Set<string>>();
    for (const [code, shapes] of Object.entries(DRILL_VARIANTS)) {
      for (const shape of SHAPES) {
        const mapping = shapes[shape] ?? {};
        for (const id of Object.values(mapping)) {
          const numId = id as number;
          if (!idOwners.has(numId)) idOwners.set(numId, new Set());
          idOwners.get(numId)!.add(code);
        }
      }
    }

    // Any ID owned by >1 code must match an allow-listed pair EXACTLY.
    const unexpected: string[] = [];
    for (const [id, owners] of idOwners) {
      if (owners.size > 1) {
        const key = [...owners].sort().join('|');
        if (!allowedSharedKeys.has(key)) {
          unexpected.push(`id ${id} shared by ${[...owners].sort().join(', ')}`);
        }
      }
    }
    // Fails on any NEW duplicate ID beyond the allow-list.
    expect(unexpected).toEqual([]);
  });

  it('no palette color has an empty mapping except the allow-listed holes', () => {
    const unexpectedEmpty: string[] = [];
    for (const { dmc } of DMC_PALETTE) {
      const entry = DRILL_VARIANTS[dmc];
      if (!entry) continue; // coverage is asserted separately
      for (const shape of SHAPES) {
        const mapping = entry[shape] ?? {};
        if (Object.keys(mapping).length === 0) {
          if (!allowedEmptyKeys.has(`${dmc}|${shape}`)) {
            unexpectedEmpty.push(`${dmc}/${shape}`);
          }
        }
      }
    }
    // Fails on any NEW empty mapping beyond the allow-list.
    expect(unexpectedEmpty).toEqual([]);
  });

  it('every palette color is mapped in at least one shape (full coverage)', () => {
    const unmapped: string[] = [];
    for (const { dmc } of DMC_PALETTE) {
      const entry = DRILL_VARIANTS[dmc];
      const hasAny =
        !!entry &&
        SHAPES.some((shape) => Object.keys(entry[shape] ?? {}).length > 0);
      if (!hasAny) unmapped.push(dmc);
    }
    expect(unmapped).toEqual([]);
  });

  it('the allow-lists contain exactly the known holes', () => {
    // Guards the guard: keeps the allow-lists from silently growing.
    expect(ALLOWLISTED_SHARED_ID_CODES).toEqual([
      ['731', '732'],
      ['781', '782'],
      ['776', '3326'],
    ]);
    expect(ALLOWLISTED_EMPTY_MAPPINGS).toEqual([
      ['471', 'square'],
      ['798', 'round'],
      ['BLANC', 'round'],
      ['ECRU', 'round'],
    ]);
  });
});
