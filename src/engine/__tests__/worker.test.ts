import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { MatcherClient } from '../worker-client';
import { DmcColor } from '../types';
import * as colorModule from '../color';

// Mock candidates
const mockCandidates: DmcColor[] = [
  {
    dmc: "310",
    name: "Black",
    hex: "#000000",
    r: 0,
    g: 0,
    b: 0,
    lab: { l: 0, a: 0, b: 0 },
    kits: ["100"],
  },
  {
    dmc: "BLANC",
    name: "White",
    hex: "#FFFFFF",
    r: 255,
    g: 255,
    b: 255,
    lab: { l: 100, a: 0, b: 0 },
    kits: ["100"],
  },
];

let workerOnMessage: ((e: MessageEvent) => void) | null = null;
let activeWorkers: MockWorker[] = [];

class MockWorker implements Worker {
  public url: string | URL;
  public options?: WorkerOptions;
  public onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
  public onmessageerror: ((this: Worker, ev: MessageEvent) => any) | null = null;
  public onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null;
  public terminated = false;

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    activeWorkers.push(this);
  }

  postMessage(message: any) {
    // Simulate the asynchronous processing of the worker
    setTimeout(() => {
      if (this.terminated) return;

      if (workerOnMessage) {
        const event = {
          data: message,
          target: this,
        } as unknown as MessageEvent;

        try {
          workerOnMessage(event);
        } catch (err) {
          if (this.onmessage) {
            this.onmessage({
              data: { kind: 'error', error: String(err) }
            } as MessageEvent);
          }
        }
      }
    }, 0);
  }

  terminate() {
    this.terminated = true;
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

let originalPostMessage: any;

beforeAll(async () => {
  originalPostMessage = globalThis.postMessage;

  // Mock global postMessage to dispatch to active workers
  (globalThis as any).postMessage = (data: any) => {
    for (const w of activeWorkers) {
      if (!w.terminated && w.onmessage) {
        w.onmessage({ data } as MessageEvent);
      }
    }
  };

  // Mock global Worker
  (globalThis as any).Worker = MockWorker;

  // Import the worker code so it registers on globalThis.onmessage
  await import('../matcher.worker');
  workerOnMessage = (globalThis as any).onmessage;
});

afterAll(() => {
  globalThis.postMessage = originalPostMessage;
});

beforeEach(() => {
  activeWorkers = [];
  vi.restoreAllMocks();
});

describe('MatcherClient and Web Worker Integration', () => {
  it('successfully instantiates MatcherClient and launches MockWorker', () => {
    const client = new MatcherClient(new URL('http://localhost/matcher.worker.ts'));
    expect(activeWorkers.length).toBe(1);
    expect(activeWorkers[0].terminated).toBe(false);
    client.terminate();
    expect(activeWorkers[0].terminated).toBe(true);
  });

  it('executes color matching successfully via match() and returns result', async () => {
    const client = new MatcherClient(new URL('http://localhost/matcher.worker.ts'));

    // 2x2 pixels: Black, White, Black, White
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);

    const progressValues: number[] = [];

    const result = await new Promise<{ matches: string[]; counts: Record<string, number> }>((resolve) => {
      client.match(
        pixels,
        mockCandidates,
        (percent) => {
          progressValues.push(percent);
        },
        (res) => {
          resolve(res);
        },
        2 // cols = 2, so 2 rows total
      );
    });

    expect(result.matches).toEqual(["310", "BLANC", "310", "BLANC"]);
    expect(result.counts).toEqual({ "310": 2, "BLANC": 2 });
    expect(progressValues).toContain(50);
    expect(progressValues).toContain(100);
    client.terminate();
  });

  it('supports abort signaling to cancel active matching runs', async () => {
    const client = new MatcherClient(new URL('http://localhost/matcher.worker.ts'));

    // Large pixel array to allow yielding and aborting mid-run
    // 10 pixels total, 1 pixel per row (cols = 1)
    const pixels = new Uint8ClampedArray(40); // 10 pixels of RGBA [0,0,0,0]

    let completeCalled = false;
    let progressValues: number[] = [];

    client.match(
      pixels,
      mockCandidates,
      (percent) => {
        progressValues.push(percent);
        // Abort on first progress update
        if (percent > 0) {
          activeWorkers[0].postMessage({ kind: 'abort' });
        }
      },
      () => {
        completeCalled = true;
      },
      1 // 1 pixel per row, total 10 rows
    );

    // Wait some time to let async processing proceed
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(completeCalled).toBe(false);
    expect(progressValues.length).toBeLessThan(10); // should abort before reaching 100%
    client.terminate();
  });

  it('persists RGBA cache across consecutive runs and clears it on palette change', async () => {
    const client = new MatcherClient(new URL('http://localhost/matcher.worker.ts'));

    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255, // Red
    ]);

    // Spy on matchColor in colorModule to verify if it gets called
    const matchColorSpy = vi.spyOn(colorModule, 'matchColor');

    // Run 1: with mockCandidates (Black, White). Red blends to solid Red.
    const res1 = await new Promise<{ matches: string[] }>((resolve) => {
      client.match(pixels, mockCandidates, () => {}, (res) => resolve(res), 1);
    });

    expect(matchColorSpy).toHaveBeenCalledTimes(1);
    const initialCallCount = matchColorSpy.mock.calls.length;

    // Run 2: same palette, should hit cache and NOT call matchColor
    const res2 = await new Promise<{ matches: string[] }>((resolve) => {
      client.match(pixels, mockCandidates, () => {}, (res) => resolve(res), 1);
    });

    expect(res2.matches).toEqual(res1.matches);
    expect(matchColorSpy.mock.calls.length).toBe(initialCallCount); // no new calls! Cache hit!

    // Run 3: new palette candidate list, should clear cache and call matchColor again
    const newCandidates: DmcColor[] = [
      ...mockCandidates,
      {
        dmc: "606",
        name: "Bright Red",
        hex: "#FF0000",
        r: 255,
        g: 0,
        b: 0,
        lab: { l: 53.23, a: 80.11, b: 67.22 },
        kits: ["200"],
      },
    ];

    const res3 = await new Promise<{ matches: string[] }>((resolve) => {
      client.match(pixels, newCandidates, () => {}, (res) => resolve(res), 1);
    });

    // Should map to the new candidate "606"
    expect(res3.matches).toEqual(["606"]);
    expect(matchColorSpy.mock.calls.length).toBe(initialCallCount + 1); // 1 more call because of cache clear!

    client.terminate();
  });
});
