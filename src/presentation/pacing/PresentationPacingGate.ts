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

interface ActivityWaiter {
  readonly afterVersion: number;
  readonly deadline: number | null;
  readonly resolve: (status: PresentationPacingWaitStatus) => void;
  readonly timer: ReturnType<typeof setTimeout> | null;
}

export class PresentationPacingGate {
  private readonly pending = new Map<string, { sequence: number; participants: number }>();
  private readonly waiters = new Set<PacingWaiter>();
  private readonly activityWaiters = new Set<ActivityWaiter>();
  private activityVersion = 0;

  get pendingCount(): number {
    return this.pending.size;
  }

  get version(): number {
    return this.activityVersion;
  }

  begin(identity: PresentationPacingIdentity): void {
    this.activityVersion += 1;
    const current = this.pending.get(identity.eventId);
    this.pending.set(identity.eventId, {
      sequence: identity.sequence,
      participants: (current?.participants ?? 0) + 1,
    });
    this.activateActivityWaiters();
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

    const throughSequence = Math.max(...[...this.pending.values()].map((pending) => pending.sequence));
    return this.waitThrough(throughSequence, options);
  }

  waitUntilActivityClearAfter(version: number, options: PresentationPacingWaitOptions = {}): Promise<PresentationPacingWaitStatus> {
    if (this.pending.size > 0 || this.activityVersion > version) return this.waitUntilClear(options);

    const timeoutMs = normalizeTimeout(options.timeoutMs);
    return new Promise((resolve) => {
      let waiter: ActivityWaiter;
      const timer = timeoutMs === null ? null : setTimeout(() => {
        if (!this.activityWaiters.delete(waiter)) return;
        resolve('timed-out');
      }, timeoutMs);
      const deadline = timeoutMs === null ? null : Date.now() + timeoutMs;
      waiter = { afterVersion: version, deadline, resolve, timer };
      this.activityWaiters.add(waiter);
      this.activateActivityWaiters();
    });
  }

  waitUntilClearBefore(sequence: number, options: PresentationPacingWaitOptions = {}): Promise<PresentationPacingWaitStatus> {
    const throughSequence = sequence - 1;
    if (!this.hasPendingThrough(throughSequence)) return Promise.resolve('cleared');
    return this.waitThrough(throughSequence, options);
  }

  private waitThrough(throughSequence: number, options: PresentationPacingWaitOptions): Promise<PresentationPacingWaitStatus> {
    const timeoutMs = normalizeTimeout(options.timeoutMs);
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
    const current = this.pending.get(eventId);
    if (!current) return;
    if (current.participants > 1) {
      this.pending.set(eventId, { ...current, participants: current.participants - 1 });
      return;
    }
    this.pending.delete(eventId);
    this.resolveEligibleWaiters();
  }

  private releaseThrough(sequence: number): void {
    [...this.pending].forEach(([eventId, pending]) => {
      if (pending.sequence <= sequence) this.pending.delete(eventId);
    });
  }

  private resolveIfClear(): void {
    this.resolveEligibleWaiters();
  }

  private resolveEligibleWaiters(): void {
    [...this.waiters].forEach((waiter) => {
      if (!this.hasPendingThrough(waiter.throughSequence)) waiter.resolve('cleared');
    });
  }

  private hasPendingThrough(sequence: number): boolean {
    return [...this.pending.values()].some((pending) => pending.sequence <= sequence);
  }

  private resolveAll(status: PresentationPacingWaitStatus): void {
    [...this.waiters].forEach((waiter) => waiter.resolve(status));
    [...this.activityWaiters].forEach((waiter) => {
      this.activityWaiters.delete(waiter);
      if (waiter.timer) clearTimeout(waiter.timer);
      waiter.resolve(status);
    });
  }

  private activateActivityWaiters(): void {
    [...this.activityWaiters].forEach((waiter) => {
      if (this.activityVersion <= waiter.afterVersion) return;
      this.activityWaiters.delete(waiter);
      if (waiter.timer) clearTimeout(waiter.timer);
      const timeoutMs = waiter.deadline === null ? undefined : Math.max(0, waiter.deadline - Date.now());
      void this.waitUntilClear({ timeoutMs }).then(waiter.resolve);
    });
  }
}

export const presentationPacingGate = new PresentationPacingGate();

function normalizeTimeout(timeoutMs: number | undefined): number | null {
  if (timeoutMs === undefined) return DEFAULT_PRESENTATION_PACING_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs)) return DEFAULT_PRESENTATION_PACING_TIMEOUT_MS;
  return Math.max(0, timeoutMs);
}
