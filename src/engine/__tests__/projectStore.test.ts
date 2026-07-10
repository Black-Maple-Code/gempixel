// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  projectStore,
  generateUUID,
  generateThumbnail,
  type ProjectSummary,
  type ProjectData,
  type RecentImage,
} from '../projectStore';

function makeSummary(id: string): ProjectSummary {
  return { id, name: `Project ${id}`, thumbnail: '', dateModified: '2026-07-10', dateCreated: '2026-07-10' };
}
function makeData(id: string): ProjectData {
  return {
    id,
    name: `Project ${id}`,
    dateCreated: '2026-07-10',
    dateModified: '2026-07-10',
    imageName: 'img.png',
    dimensions: { cols: 80, rows: 53 },
    drillStyle: 'square',
    selectedBaseKit: 'all',
    safetyMargin: 10,
    laborMarkup: 0,
    kitBaseCost: 0,
    drillPacketCost: 0.25,
    excludedDmcCodes: [],
    pricesPerBagSize: { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 },
    drillType: 'standard',
    canvasTemplate: '',
    affiliateTag: '',
    affiliateApp: 'ref',
    gridData: null,
  };
}
function makeRecent(id: string): RecentImage {
  return { id, name: `img-${id}`, dataUrl: `data:${id}`, width: 100, height: 80 };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('projectStore (projects)', () => {
  it('save -> list -> load round-trips the same data and keys', () => {
    projectStore.save(makeSummary('a'), makeData('a'));
    expect(projectStore.list().map(p => p.id)).toEqual(['a']);
    expect(projectStore.load('a')).toEqual(makeData('a'));
    // Storage keys unchanged (backwards compatibility)
    expect(localStorage.getItem('gempixel_workspace_registry')).not.toBeNull();
    expect(localStorage.getItem('gempixel_project_a')).not.toBeNull();
  });

  it('upserts an existing project in place rather than duplicating', () => {
    projectStore.save(makeSummary('a'), makeData('a'));
    projectStore.save({ ...makeSummary('a'), name: 'Renamed' }, makeData('a'));
    const list = projectStore.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Renamed');
  });

  it('remove deletes from list and load returns null', () => {
    projectStore.save(makeSummary('a'), makeData('a'));
    projectStore.remove('a');
    expect(projectStore.list()).toEqual([]);
    expect(projectStore.load('a')).toBeNull();
  });

  it('load returns null for missing / corrupt JSON', () => {
    expect(projectStore.load('missing')).toBeNull();
    localStorage.setItem('gempixel_project_bad', '{not valid json');
    expect(projectStore.load('bad')).toBeNull();
  });

  it('evicts the OLDEST project (registry index 0) on quota, never the one being saved', () => {
    projectStore.save(makeSummary('old'), makeData('old')); // appended first -> oldest
    const realSet = Storage.prototype.setItem;
    let threw = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (!threw && k === 'gempixel_project_new') {
        threw = true;
        throw new DOMException('full', 'QuotaExceededError');
      }
      realSet.call(this, k, v);
    });
    expect(() => projectStore.save(makeSummary('new'), makeData('new'))).not.toThrow();
    vi.restoreAllMocks();

    const ids = projectStore.list().map(p => p.id);
    expect(ids).toContain('new');
    expect(ids).not.toContain('old');
    expect(projectStore.load('old')).toBeNull();
    expect(projectStore.load('new')).not.toBeNull();
  });
});

describe('projectStore.recents', () => {
  it('save -> list round-trips the recent-image list', () => {
    const list = [makeRecent('1'), makeRecent('2')];
    projectStore.recents.save(list);
    expect(projectStore.recents.list()).toEqual(list);
    expect(localStorage.getItem('gempixel_recent_images')).not.toBeNull();
  });

  it('evicts the oldest recent (last element) on quota without throwing', () => {
    const realSet = Storage.prototype.setItem;
    let threw = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (!threw && k === 'gempixel_recent_images') {
        threw = true;
        throw new DOMException('full', 'QuotaExceededError');
      }
      realSet.call(this, k, v);
    });
    // newest-first: '1' newest, '3' oldest
    expect(() => projectStore.recents.save([makeRecent('1'), makeRecent('2'), makeRecent('3')])).not.toThrow();
    vi.restoreAllMocks();
    expect(projectStore.recents.list().map(r => r.id)).toEqual(['1', '2']);
  });

  it('list returns [] for missing / corrupt JSON', () => {
    expect(projectStore.recents.list()).toEqual([]);
    localStorage.setItem('gempixel_recent_images', 'nope');
    expect(projectStore.recents.list()).toEqual([]);
  });
});

describe('projectStore helpers', () => {
  it('generateUUID returns a v4-shaped id', () => {
    expect(generateUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generateThumbnail returns a string and never throws without a 2d context', () => {
    expect(typeof generateThumbnail(document.createElement('canvas'))).toBe('string');
  });
});
