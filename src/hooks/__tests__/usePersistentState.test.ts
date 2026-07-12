// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { useEffect } from 'preact/hooks';
import { usePersistentState, codecs } from '../usePersistentState';

const throwBlocked = () => {
  throw new DOMException('blocked', 'SecurityError');
};

let container: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  render(null, container);
  container.remove();
  vi.restoreAllMocks();
});

// Minimal harness: render a component that uses the hook and exposes its current
// value + setter to the test via out-params, mirroring the App.test.tsx container style.
function mountHook<T>(key: string, initial: T, codec: typeof codecs.bool | any) {
  const out: { value?: T; setValue?: (v: T) => void } = {};
  function Probe() {
    const [value, setValue] = usePersistentState<T>(key, initial, codec);
    useEffect(() => {
      out.value = value;
      out.setValue = setValue;
    });
    return null;
  }
  render(h(Probe, null), container);
  return out;
}

describe('codecs — format-preserving', () => {
  it('bool round-trips as "true"/"false"', () => {
    expect(codecs.bool.parse('true')).toBe(true);
    expect(codecs.bool.parse('false')).toBe(false);
    expect(codecs.bool.serialize(true)).toBe('true');
    expect(codecs.bool.serialize(false)).toBe('false');
  });

  it('int(fallback).parse returns the parsed int, NaN-guarded via Number.isFinite (IN-05)', () => {
    expect(codecs.int(15).parse('42')).toBe(42);
    expect(codecs.int(15).parse('NaNsense')).toBe(15); // parseInt -> NaN -> fallback
    expect(codecs.int(15).parse('')).toBe(15);
    expect(codecs.int(1).serialize(7)).toBe('7');
  });

  it('string codec is identity (raw string NOT run through JSON.parse — Pitfall 1)', () => {
    expect(codecs.string.parse('mytag')).toBe('mytag');
    expect(codecs.string.serialize('mytag')).toBe('mytag');
  });

  it('json codec parses/stringifies', () => {
    expect(codecs.json<number[]>().parse('[1,2]')).toEqual([1, 2]);
    expect(codecs.json<number[]>().serialize([1, 2])).toBe('[1,2]');
    expect(() => codecs.json<number[]>().parse('{bad')).toThrow();
  });
});

describe('usePersistentState', () => {
  it('reads an existing stored value on init', () => {
    localStorage.setItem('k', 'true');
    const out = mountHook<boolean>('k', false, codecs.bool);
    expect(out.value).toBe(true);
  });

  it('falls back to initial when storage access is blocked (no throw)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(throwBlocked);
    let out: any;
    expect(() => {
      out = mountHook<boolean>('k', true, codecs.bool);
    }).not.toThrow();
    expect(out.value).toBe(true);
  });

  it('falls back to initial when the stored int value is corrupt (NaN guard)', () => {
    localStorage.setItem('gempixel_substitution_threshold', 'NaNsense');
    const out = mountHook<number>('gempixel_substitution_threshold', 15, codecs.int(15));
    expect(out.value).toBe(15);
  });

  it('falls back to initial when the stored json value is corrupt (parse throws)', () => {
    localStorage.setItem('k', '{bad');
    const out = mountHook<number[]>('k', [], codecs.json<number[]>());
    expect(out.value).toEqual([]);
  });

  it('round-trips bool to exactly "true" on disk', () => {
    const out = mountHook<boolean>('k', false, codecs.bool);
    out.setValue!(true);
    expect(localStorage.getItem('k')).toBe('true');
  });

  it('round-trips int to exactly "15" on disk', () => {
    const out = mountHook<number>('k', 0, codecs.int(0));
    out.setValue!(15);
    expect(localStorage.getItem('k')).toBe('15');
  });

  it('round-trips string to a raw (non-JSON) value on disk', () => {
    const out = mountHook<string>('k', '', codecs.string);
    out.setValue!('mytag');
    expect(localStorage.getItem('k')).toBe('mytag');
  });

  it('does not throw when writing to blocked storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(throwBlocked);
    const out = mountHook<boolean>('k', false, codecs.bool);
    expect(() => out.setValue!(true)).not.toThrow();
  });
});
