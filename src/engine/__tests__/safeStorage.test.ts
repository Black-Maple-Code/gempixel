// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeStorage } from '../safeStorage';

// jsdom ships a working localStorage; blocked/private-mode is simulated by spying
// on Storage.prototype to throw. Restore after every test so spies never leak.
const throwBlocked = () => {
  throw new DOMException('blocked', 'SecurityError');
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('safeStorage — guarded localStorage wrapper', () => {
  describe('getItem', () => {
    it('returns the stored string when localStorage works', () => {
      localStorage.setItem('k', 'v');
      expect(safeStorage.getItem('k')).toBe('v');
    });

    it('returns null (never throws) when access throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(throwBlocked);
      expect(() => safeStorage.getItem('k')).not.toThrow();
      expect(safeStorage.getItem('k')).toBeNull();
    });

    it('returns null for a missing key', () => {
      expect(safeStorage.getItem('nope')).toBeNull();
    });
  });

  describe('setItem', () => {
    it('returns true on success and persists the value', () => {
      expect(safeStorage.setItem('k', 'v')).toBe(true);
      expect(localStorage.getItem('k')).toBe('v');
    });

    it('returns false (never throws) when access throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(throwBlocked);
      expect(() => safeStorage.setItem('k', 'v')).not.toThrow();
      expect(safeStorage.setItem('k', 'v')).toBe(false);
    });
  });

  describe('removeItem', () => {
    it('removes the key when localStorage works', () => {
      localStorage.setItem('k', 'v');
      safeStorage.removeItem('k');
      expect(localStorage.getItem('k')).toBeNull();
    });

    it('swallows a throwing removeItem (no throw)', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(throwBlocked);
      expect(() => safeStorage.removeItem('k')).not.toThrow();
    });
  });

  describe('isAvailable', () => {
    it('returns true when a probe write+remove round-trips', () => {
      expect(safeStorage.isAvailable()).toBe(true);
    });

    it('returns false when setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(throwBlocked);
      expect(safeStorage.isAvailable()).toBe(false);
    });
  });
});
