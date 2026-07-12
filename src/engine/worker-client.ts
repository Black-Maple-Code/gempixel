import { DmcColor } from './types';

export class MatcherClient {
  private worker: Worker;
  private currentPaletteHash: string = '';
  // Monotonic per-call run id. Each match() stamps its messages with the next id so a
  // superseded in-flight run's late replies can be filtered out client-side (B2).
  private runSeq = 0;

  constructor(workerUrl: URL | string) {
    this.worker = new Worker(workerUrl, { type: 'module' });
  }

  public match(
    bitmap: ImageBitmap,
    cols: number,
    rows: number,
    candidates: DmcColor[],
    onProgress: (percent: number) => void,
    onComplete: (result: { matches: string[]; counts: Record<string, number> }) => void,
    onError?: (message: string) => void
  ): void {
    const paletteHash = candidates.map((c) => c.dmc).sort().join(',');
    const clearCache = paletteHash !== this.currentPaletteHash;
    this.currentPaletteHash = paletteHash;

    const runId = ++this.runSeq;
    // Transfer the ImageBitmap zero-copy ([bitmap] transfer list) — the worker now owns
    // decode/resample/box-sample; this neuters the sender's handle (D-06).
    this.worker.postMessage(
      {
        kind: 'match',
        bitmap,
        cols,
        rows,
        candidates,
        clearCache,
        runId,
      },
      [bitmap]
    );

    this.worker.onmessage = (e) => {
      // Drop stale replies from a superseded run — only the live runId's messages apply (B2).
      if (e.data.runId !== runId) return;
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
