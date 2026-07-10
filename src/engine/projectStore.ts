/**
 * projectStore — all project + recent-image localStorage persistence in one place:
 * serialization, CRUD, and quota eviction. Storage keys and serialized shapes are
 * frozen (existing saved projects must keep loading). Pure logic (no Preact/JSX);
 * quota eviction is internal and unit-tested.
 *
 * Interfaces `ProjectSummary` / `ProjectData` are moved verbatim from App.tsx.
 * `RecentImage` is newly named here from the inline shape App used for recents.
 */

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
}

export interface RecentImage {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
   * Upsert a project. Persists the project blob + registry, evicting the OLDEST
   * *other* project (registry index 0 — projects are appended newest-last) on
   * quota, then retrying. Never throws to the caller.
   */
  save(summary: ProjectSummary, data: ProjectData): void {
    const registry = readRegistry();
    const index = registry.findIndex(p => p.id === summary.id);
    if (index >= 0) registry[index] = summary;
    else registry.push(summary);

    while (true) {
      try {
        localStorage.setItem(projectKey(data.id), JSON.stringify(data));
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
        return;
      } catch (err) {
        // Evict the oldest project that isn't the one being saved and retry.
        const victimIdx = registry.findIndex(p => p.id !== summary.id);
        if (victimIdx < 0) {
          console.error('Failed to save project (storage full)', err);
          return;
        }
        const [victim] = registry.splice(victimIdx, 1);
        try {
          localStorage.removeItem(projectKey(victim.id));
        } catch {
          /* ignore */
        }
      }
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
