/**
 * projectStore — all project + recent-image localStorage persistence in one place:
 * serialization, CRUD, and quota eviction. Storage keys and serialized shapes are
 * frozen (existing saved projects must keep loading). Pure logic (no Preact/JSX);
 * quota eviction is internal and unit-tested.
 *
 * Interfaces `ProjectSummary` / `ProjectData` are moved verbatim from App.tsx.
 * `RecentImage` is newly named here from the inline shape App used for recents.
 */

import type { CanvasVendor } from './checkout';

const REGISTRY_KEY = 'gempixel_workspace_registry';
const RECENTS_KEY = 'gempixel_recent_images';
const projectKey = (id: string) => `gempixel_project_${id}`;

export interface ProjectSummary {
  id: string;
  name: string;
  thumbnail: string;
  dateModified: string;
  dateCreated: string;
}

export interface ProjectData {
  id: string;
  name: string;
  dateCreated: string;
  dateModified: string;
  imageName: string;
  dimensions: { cols: number; rows: number };
  drillStyle: 'square' | 'round';
  selectedBaseKit: 'all' | '100' | '200';
  safetyMargin: number;
  laborMarkup: number;
  kitBaseCost: number;
  drillPacketCost: number;
  excludedDmcCodes: string[];
  pricesPerBagSize: Record<200 | 500 | 1000 | 2000, number>;
  drillType: 'standard' | 'ab' | 'glow' | 'crystal';
  canvasTemplate: string;
  affiliateTag: string;
  affiliateApp: 'ref' | 'rfsn' | 'none';
  gridData: number[] | null;
  /**
   * Selected canvas print vendor. Optional so existing saved blobs (persisted
   * before VENDOR-02) keep loading — additive/frozen-shape discipline. A restored
   * legacy/unknown value (e.g. a removed vendor) is remapped via `normalizeVendor`
   * at load time.
   */
  selectedVendor?: CanvasVendor;
}

export interface RecentImage {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Discriminated result of {@link projectStore.save}. On a quota failure the
 * caller must surface a warning; `save()` never evicts or overwrites another
 * stored project (CR-02 / B3).
 */
export type SaveResult = { ok: true } | { ok: false; reason: 'quota' };

/**
 * Generate an RFC-4122 v4 UUID from a CSPRNG. The id is used directly as a
 * localStorage key (`gempixel_project_<id>`) and the registry primary key, so a
 * collision would silently overwrite an existing project — never use Math.random
 * (WR-02 / W9). Prefers `crypto.randomUUID`, falling back to `crypto.getRandomValues`.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

export function generateThumbnail(canvas: HTMLCanvasElement): string {
  try {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 80;
    thumbCanvas.height = 60;
    const ctx = thumbCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, 80, 60);
      return thumbCanvas.toDataURL('image/jpeg', 0.6);
    }
  } catch (err) {
    console.error('Failed to generate thumbnail', err);
  }
  return '';
}

function readRegistry(): ProjectSummary[] {
  try {
    const str = localStorage.getItem(REGISTRY_KEY);
    return str ? JSON.parse(str) : [];
  } catch (err) {
    console.error('Failed to read workspace registry', err);
    return [];
  }
}

export const projectStore = {
  list(): ProjectSummary[] {
    return readRegistry();
  },

  load(id: string): ProjectData | null {
    try {
      const dataStr = localStorage.getItem(projectKey(id));
      return dataStr ? JSON.parse(dataStr) : null;
    } catch (err) {
      console.error('Failed to load project data', err);
      return null;
    }
  },

  /**
   * Upsert a project (in-place by id, else append). Writes the project blob +
   * registry inside a single try and returns `{ ok: true }`. On a
   * QuotaExceededError it returns `{ ok: false, reason: 'quota' }` WITHOUT
   * throwing and WITHOUT deleting or overwriting any other stored project —
   * every previously saved project and the persisted registry stay intact
   * (CR-02 / B3). Callers surface the quota status to the user; a
   * written-but-unregistered blob is a harmless unreferenced orphan, not data loss.
   */
  save(summary: ProjectSummary, data: ProjectData): SaveResult {
    const registry = readRegistry();
    const index = registry.findIndex(p => p.id === summary.id);
    if (index >= 0) registry[index] = summary;
    else registry.push(summary);

    try {
      localStorage.setItem(projectKey(data.id), JSON.stringify(data));
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      return { ok: true };
    } catch (err) {
      console.error('Failed to save project (storage full)', err);
      return { ok: false, reason: 'quota' };
    }
  },

  remove(id: string): void {
    try {
      const registry = readRegistry().filter(p => p.id !== id);
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (err) {
      console.error('Failed to remove from registry', err);
    }
    try {
      localStorage.removeItem(projectKey(id));
    } catch (err) {
      console.error('Failed to delete project data', err);
    }
  },

  recents: {
    list(): RecentImage[] {
      try {
        const str = localStorage.getItem(RECENTS_KEY);
        return str ? JSON.parse(str) : [];
      } catch {
        return [];
      }
    },

    /**
     * Persist the recent-image list (newest-first). On quota, drop the oldest
     * entry (last element) and retry; never throws. Callers own the in-memory
     * list (React state) and hand the whole list here to persist.
     */
    save(list: RecentImage[]): void {
      const working = [...list];
      while (working.length > 0) {
        try {
          localStorage.setItem(RECENTS_KEY, JSON.stringify(working));
          return;
        } catch {
          working.pop();
        }
      }
      try {
        localStorage.removeItem(RECENTS_KEY);
      } catch {
        /* ignore */
      }
    },
  },
};
