// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { useDiamondArtMatch, type MatchInputs, type MatchState } from '../useDiamondArtMatch';
import { DMC_PALETTE } from '../../../engine/palette';

// Mirror App.test.tsx's MatcherClient mock; the mocked match invokes progress+complete
// synchronously so the hook's state settles without a real Web Worker.
const { instances } = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('../../../engine/worker-client', () => ({
  MatcherClient: class MockMatcherClient {
    match = vi.fn(
      (
        _pixels: Uint8ClampedArray,
        _candidates: unknown,
        onProgress: (p: number) => void,
        onComplete: (r: { matches: string[]; counts: Record<string, number> }) => void
      ) => {
        onProgress(100);
        onComplete({ matches: ['A', 'A', 'B'], counts: { A: 2, B: 1 } });
      }
    );
    terminate = vi.fn();
    constructor() {
      instances.push(this);
    }
  },
}));

// jsdom has no canvas 2d context; stub it so getImagePixels can produce pixels.
beforeEach(() => {
  instances.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  } as any);
});
afterEach(() => vi.restoreAllMocks());

// Render harness: capture the latest MatchState the hook returns.
function mount(getInputs: () => MatchInputs) {
  const container = document.createElement('div');
  let latest: MatchState;
  function Harness() {
    latest = useDiamondArtMatch(getInputs());
    return null;
  }
  render(<Harness />, container);
  return {
    container,
    get state() {
      return latest;
    },
    rerender() {
      render(<Harness />, container);
    },
    unmount() {
      render(null, container);
    },
  };
}

const c0 = DMC_PALETTE[0];
const c1 = DMC_PALETTE[1];
const fakeImage = { naturalWidth: 4, naturalHeight: 4, width: 4, height: 4 } as unknown as HTMLImageElement;

const baseInputs = (over: Partial<MatchInputs> = {}): MatchInputs => ({
  image: null,
  cols: 4,
  rows: 4,
  activeCandidates: [c0, c1],
  enableSubstitution: false,
  substitutionThreshold: 2,
  ...over,
});

describe('useDiamondArtMatch', () => {
  it('dispatches a match and flows progress -> result -> loading false', async () => {
    const h = mount(() => baseInputs({ image: fakeImage }));
    await new Promise(r => setTimeout(r, 0));
    h.rerender();
    expect(h.state.progress).toBe(100);
    expect(h.state.loading).toBe(false);
    expect(h.state.matchResult).not.toBeNull();
    expect(h.state.matchResult!.counts).toEqual({ A: 2, B: 1 });
  });

  it('restore() seeds a match result and symbolMap regenerates', async () => {
    const h = mount(() => baseInputs());
    h.state.restore({ matches: [c0.dmc, c0.dmc, c1.dmc], counts: { [c0.dmc]: 2, [c1.dmc]: 1 } });
    await new Promise(r => setTimeout(r, 0));
    h.rerender();
    expect(h.state.matchResult!.counts[c0.dmc]).toBe(2);
    expect(Object.keys(h.state.symbolMap).length).toBeGreaterThan(0);
  });

  it('applies substituteLowCountColors when enableSubstitution flips on', async () => {
    let sub = false;
    const h = mount(() => baseInputs({ enableSubstitution: sub }));
    // c0 count 3 (> threshold 2) is a valid target; c1 count 1 is the low color.
    h.state.restore({ matches: [c0.dmc, c0.dmc, c0.dmc, c1.dmc], counts: { [c0.dmc]: 3, [c1.dmc]: 1 } });
    await new Promise(r => setTimeout(r, 0));
    h.rerender();
    const before = h.state.matchResult!.counts;
    expect(before[c1.dmc]).toBe(1); // low-count color present un-substituted

    sub = true; // threshold 2 -> c1 (count 1) gets substituted into c0
    h.rerender();
    await new Promise(r => setTimeout(r, 0));
    h.rerender();
    expect(h.state.matchResult!.counts[c1.dmc]).toBeUndefined();
  });

  it('terminates the worker on unmount (no leak)', async () => {
    const h = mount(() => baseInputs({ image: fakeImage }));
    await new Promise(r => setTimeout(r, 0));
    h.rerender(); // flush the worker-init effect
    await new Promise(r => setTimeout(r, 0));
    expect(instances.length).toBeGreaterThan(0);
    h.unmount();
    expect(instances[0].terminate).toHaveBeenCalled();
  });
});
