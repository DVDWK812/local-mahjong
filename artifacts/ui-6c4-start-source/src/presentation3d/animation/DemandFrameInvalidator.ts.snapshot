export const TABLE_ANIMATION_MAX_RENDER_FPS = 60;

type FrameHandle = number;
type RequestFrame = (callback: FrameRequestCallback) => FrameHandle;
type CancelFrame = (handle: FrameHandle) => void;

/** Coalesces demand-render invalidations and caps transient animation redraws. */
export class DemandFrameInvalidator {
  private pendingFrame: FrameHandle | null = null;
  private lastInvalidationTime = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly intervalMs = 1000 / TABLE_ANIMATION_MAX_RENDER_FPS,
    private readonly requestFrame: RequestFrame = (callback) => requestAnimationFrame(callback),
    private readonly cancelFrame: CancelFrame = (handle) => cancelAnimationFrame(handle),
  ) {}

  request(invalidate: () => void): void {
    if (this.pendingFrame !== null) return;
    const poll = (timestamp: number) => {
      if (timestamp - this.lastInvalidationTime >= this.intervalMs) {
        this.pendingFrame = null;
        this.lastInvalidationTime = timestamp;
        invalidate();
        return;
      }
      this.pendingFrame = this.requestFrame(poll);
    };
    this.pendingFrame = this.requestFrame(poll);
  }

  markInvalidated(timestamp: number): void {
    this.lastInvalidationTime = timestamp;
  }

  cancelPending(): void {
    if (this.pendingFrame === null) return;
    this.cancelFrame(this.pendingFrame);
    this.pendingFrame = null;
  }

  get hasPendingFrame(): boolean {
    return this.pendingFrame !== null;
  }
}
