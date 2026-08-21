export interface PresentationPacingIdentity {
  readonly eventId: string;
  readonly sequence: number;
}

export interface PresentationPacingWaitOptions {
  readonly timeoutMs?: number;
}

export type PresentationPacingWaitStatus = 'cleared' | 'timed-out';
export const DEFAULT_PRESENTATION_PACING_TIMEOUT_MS = 2500;

interface PacingWaiter {
  readonly throughSequence: number;
  readonly resolve: (status: PresentationPacingWaitStatus) => void;
  readonly timer: ReturnType<typeof setTimeout> | null;
}

export class PresentationPacingGate {
  private readonly pending = new Map<string, number>();
  private readonly waiters = new Set<PacingWaiter>();

  get pendingCount(): number {
    return this.pending.size;
  }

  begin(identity: PresentationPacingIdentity): void {
    this.pending.set(identity.eventId, identity.sequence);
  }

  complete(eventId: string): void {
    this.release(eventId);
  }

  cancel(eventId: string): void {
    this.release(eventId);
  }

  clear(): void {
    this.pending.clear();
    this.resolveAll('cleared');
  }

  waitUntilClear(options: PresentationPacingWaitOptions = {}): Promise<PresentationPacingWaitStatus> {
    if (this.pending.size === 0) return Promise.resolve('cleared');

    const timeoutMs = normalizeTimeout(options.timeoutMs);
    const throughSequence = Math.max(...this.pending.values());
    return new Promise((resolve) => {
      let waiter: PacingWaiter;
      const settle = (status: PresentationPacingWaitStatus) => {
        if (!this.waiters.delete(waiter)) return;
        if (waiter.timer) clearTimeout(waiter.timer);
        resolve(status);
      };
      const timer = timeoutMs === null ? null : setTimeout(() => {
        this.releaseThrough(throughSequence);
        settle('timed-out');
        this.resolveIfClear();
      }, timeoutMs);
      waiter = { throughSequence, resolve: settle, timer };
      this.waiters.add(waiter);
    });
  }

  private release(eventId: string): void {
    if (!this.pending.delete(eventId)) return;
    this.resolveIfClear();
  }

  private releaseThrough(sequence: number): void {
    [...this.pending].forEach(([eventId, pendingSequence]) => {
      if (pendingSequence <= sequence) this.pending.delete(eventId);
    });
  }

  private resolveIfClear(): void {
    if (this.pending.size !== 0) return;
    this.resolveAll('cleared');
  }

  private resolveAll(status: PresentationPacingWaitStatus): void {
    [...this.waiters].forEach((waiter) => waiter.resolve(status));
  }
}

export const presentationPacingGate = new PresentationPacingGate();

function normalizeTimeout(timeoutMs: number | undefined): number | null {
  if (timeoutMs === undefined) return DEFAULT_PRESENTATION_PACING_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs)) return DEFAULT_PRESENTATION_PACING_TIMEOUT_MS;
  return Math.max(0, timeoutMs);
}
