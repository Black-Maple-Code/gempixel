import { DmcColor } from './types';

export class MatcherClient {
  private worker: Worker;
  private currentPaletteHash: string = '';

  constructor(workerUrl: URL | string) {
    this.worker = new Worker(workerUrl, { type: 'module' });
  }

  public match(
    pixels: Uint8ClampedArray,
    candidates: DmcColor[],
    onProgress: (percent: number) => void,
    onComplete: (result: { matches: string[]; counts: Record<string, number> }) => void,
    onError?: (message: string) => void,
    cols?: number
  ): void {
    const paletteHash = candidates.map((c) => c.dmc).sort().join(',');
    const clearCache = paletteHash !== this.currentPaletteHash;
    this.currentPaletteHash = paletteHash;

    this.worker.postMessage({ kind: 'abort' });
    this.worker.postMessage({
      kind: 'match',
      pixels,
      candidates,
      clearCache,
      cols,
    });

    this.worker.onmessage = (e) => {
      if (e.data.kind === 'progress') {
        onProgress(e.data.percent);
      } else if (e.data.kind === 'result') {
        onComplete({ matches: e.data.matches, counts: e.data.counts });
      } else if (e.data.kind === 'error') {
        console.error('Worker error:', e.data.error);
        onError?.(e.data.error);
      }
    };

    // Uncaught worker exceptions (e.g. a crash outside the worker's try/catch) never
    // arrive as a {kind:'error'} message, so surface them via onError too — otherwise
    // the caller's loading state would strand forever (B1).
    this.worker.onerror = (ev) => {
      console.error('Worker crashed:', ev);
      onError?.(ev.message || 'Worker crashed');
    };
  }

  public terminate(): void {
    this.worker.terminate();
  }
}
