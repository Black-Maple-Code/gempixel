import { useState, useEffect } from 'preact/hooks';
import { safeStorage } from '../engine/safeStorage';

/**
 * A serialization contract for a single persisted setting. `parse` MAY throw on a
 * corrupt/untrusted raw value — the caller (usePersistentState) catches and falls
 * back to `initial`. Codecs preserve the CURRENT on-disk formats; do NOT switch to
 * a blanket JSON codec (it would throw on already-stored raw strings — Pitfall 1).
 */
export interface Codec<T> {
  /** May throw; caller falls back to `initial` on failure. */
  parse: (raw: string) => T;
  serialize: (value: T) => string;
}

/**
 * Built-in codecs that read/write the legacy on-disk formats losslessly:
 * bool as 'true'/'false', int as a decimal string (NaN-guarded), string raw,
 * and json via JSON.stringify.
 */
export const codecs = {
  bool: {
    parse: (r: string) => r === 'true',
    serialize: (v: boolean) => v.toString(),
  } as Codec<boolean>,
  int: (fallback: number): Codec<number> => ({
    // parseInt -> NaN when the stored value is corrupt; Number.isFinite guards it (IN-05).
    parse: (r: string) => {
      const n = parseInt(r, 10);
      return Number.isFinite(n) ? n : fallback;
    },
    serialize: (v: number) => v.toString(),
  }),
  string: {
    parse: (r: string) => r,
    serialize: (v: string) => v,
  } as Codec<string>,
  json: <T>(): Codec<T> => ({
    parse: (r: string) => JSON.parse(r) as T,
    serialize: (v: T) => JSON.stringify(v),
  }),
  // Shape-checked array-of-strings codec (WR-01). On-disk format is identical to
  // codecs.json (JSON.stringify of an array), but parse validates that the decoded
  // value is actually an array and throws otherwise, so a valid-JSON-but-wrong-type
  // stored value (e.g. '"310"' -> "310", '5' -> 5) makes the hook fall back to
  // `initial` instead of yielding a non-array that later crashes a `.map`/spread.
  stringArray: (): Codec<string[]> => ({
    parse: (r: string) => {
      const v = JSON.parse(r);
      if (!Array.isArray(v)) throw new Error('not an array'); // -> hook falls back to initial
      return v.map(String);
    },
    serialize: (v: string[]) => JSON.stringify(v),
  }),
};

/**
 * usePersistentState — a useState that mirrors its value to localStorage through
 * the guarded `safeStorage`. Falls back to `initial` when storage access is blocked
 * (private mode) or the stored value is corrupt (codec.parse throws), never throwing
 * during render (STORE-01). All persistence flows through `safeStorage` — this hook
 * never touches `localStorage` directly (STORE-02).
 *
 * Returns a `[value, setValue]` tuple `as const` — a deliberate exception to the
 * repo's object-return convention, mirroring native `useState` so it is a drop-in
 * replacement for the lazy-init + write-effect pairs it generalizes.
 */
export function usePersistentState<T>(key: string, initial: T, codec: Codec<T>) {
  const [value, setValue] = useState<T>(() => {
    const raw = safeStorage.getItem(key); // guard (a): access throws -> null
    if (raw === null) return initial;
    try {
      return codec.parse(raw); // guard (b): corrupt value / format
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    safeStorage.setItem(key, codec.serialize(value)); // guarded; swallows on blocked storage
  }, [value]);

  return [value, setValue] as const;
}
