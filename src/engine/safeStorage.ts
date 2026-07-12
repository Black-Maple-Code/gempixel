// Guarded localStorage wrapper. Every method swallows access errors so a
// blocked/private-mode browser (Safari private mode, storage disabled,
// SecurityError) can never throw during render or on write. Catch blocks are
// silent — they return the safe fallback with no console noise (per CONVENTIONS.md
// logging rule). This is the single audit point for all localStorage access.
export const safeStorage = {
  /** Reads a key; returns null when the value is missing OR access throws. */
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  /** Writes a key; returns true on success, false when access throws (never throws). */
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  /** Removes a key; silently ignores a throwing removeItem. */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  /** True only if a probe write+remove round-trips. Optional; not required by the hook. */
  isAvailable(): boolean {
    try {
      const k = '__gp_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  },
};
