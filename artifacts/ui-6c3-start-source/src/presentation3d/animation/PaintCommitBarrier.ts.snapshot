type FrameHandle = number;
type RequestFrame = (callback: FrameRequestCallback) => FrameHandle;
type CancelFrame = (handle: FrameHandle) => void;

type PendingPaint = {
  frameHandle: FrameHandle | null;
  resolve: () => void;
};

/** Waits through a React commit frame and the following browser paint. */
export class PaintCommitBarrier {
  private readonly pending = new Set<PendingPaint>();

  constructor(
    private readonly requestFrame: RequestFrame | null = typeof requestAnimationFrame === 'function'
      ? (callback) => requestAnimationFrame(callback)
      : null,
    private readonly cancelFrame: CancelFrame | null = typeof cancelAnimationFrame === 'function'
      ? (handle) => cancelAnimationFrame(handle)
      : null,
  ) {}

  wait(): Promise<void> {
    if (!this.requestFrame) return Promise.resolve();
    return new Promise((resolve) => {
      const entry: PendingPaint = { frameHandle: null, resolve };
      this.pending.add(entry);
      entry.frameHandle = this.requestFrame!(() => {
        entry.frameHandle = this.requestFrame!(() => {
          this.pending.delete(entry);
          entry.frameHandle = null;
          resolve();
        });
      });
    });
  }

  cancelPending(): void {
    for (const entry of this.pending) {
      if (entry.frameHandle !== null) this.cancelFrame?.(entry.frameHandle);
      entry.frameHandle = null;
      entry.resolve();
    }
    this.pending.clear();
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}
