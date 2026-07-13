import { DmcColor } from './types';

export class MatcherClient {
  private worker: Worker;
  private currentPaletteHash: string = '';
  // Monotonic per-call run id. Each match() stamps its messages with the next id so a
  // superseded in-flight run's late replies can be filtered out client-side (B2).
  private runSeq = 0;

  // The default branch below MUST keep the `new Worker(new URL('./matcher.worker.ts',
  // import.meta.url), { type: 'module' })` literal inline, as a single verbatim expression.
  // Vite only compiles+bundles the worker (and its transitive ./color, ./ingest, ./types
  // imports) into a hashed .js chunk when it can statically see that whole expression in one
  // place. Splitting the `new URL(...)` into a separate variable — or building it in a
  // separate file and passing it in, as the old call site did — makes Vite emit the worker
  // as a raw hashed .ts asset that fails to instantiate as a module worker in production
  // (served as video/mp2t, bare ESM imports intact). The optional `workerUrl` parameter
  // exists solely to preserve the injected-URL seam used by
  // src/engine/__tests__/worker.test.ts; production always takes the no-arg default branch.
  constructor(workerUrl?: URL | string) {
    if (workerUrl) {
      this.worker = new Worker(workerUrl, { type: 'module' });
    } else {
      this.worker = new Worker(new URL('./matcher.worker.ts', import.meta.url), { type: 'module' });
    }
  }

  public match(
    bitmap: ImageBitmap,
    cols: number,
    rows: number,
    candidates: DmcColor[],
    onProgress: (percent: number) => void,
    onComplete: (result: { matches: string[]; counts: Record<string, number> }) => void,
    onError?: (message: string) => void,
    // Parity cap source (ME-01): the pre-orientation source dimensions the removed
    // getImagePixels used to size its resample canvas (image.naturalWidth/naturalHeight).
    // When omitted the worker falls back to the transferred bitmap's own dimensions.
    srcWidth?: number,
    srcHeight?: number
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
        srcWidth,
        srcHeight,
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
