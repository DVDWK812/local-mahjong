import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';

export type DoraSweep3DVariant = 'normal' | 'combined';

export type DoraSweep3DTarget = Readonly<{
  key: string;
  variant: DoraSweep3DVariant;
}>;

export type DoraSweep3DTrigger = Readonly<{
  eventId: string;
  targets: readonly DoraSweep3DTarget[];
}>;

export type DoraSweep3DSnapshot = Readonly<{
  eventId: string;
  key: string;
  variant: DoraSweep3DVariant;
  startTime: number;
  durationMs: number;
  progress: number;
}>;

type ActiveSweep = {
  eventId: string;
  key: string;
  variant: DoraSweep3DVariant;
  startTime: number;
  durationMs: number;
  progress: number;
};

type VisibleDora = {
  key: string;
  variant: DoraSweep3DVariant;
  nextPulseAt: number | null;
};

export type DoraSweep3DDeadlineResult = Readonly<{
  activeCountBefore: number;
  activeCount: number;
  startedCount: number;
  startTime: number;
}>;

/** Pure pulse/deadline lifecycle; rendering and timer ownership remain outside the controller. */
export class DoraSweep3DController {
  private readonly active = new Map<string, ActiveSweep>();
  private readonly visible = new Map<string, VisibleDora>();

  registerVisible(target: DoraSweep3DTarget, now: number, pulseImmediately = true): number {
    const existing = this.visible.get(target.key);
    if (existing) {
      existing.variant = target.variant;
      return this.active.size;
    }
    this.visible.set(target.key, {
      ...target,
      nextPulseAt: repeatDeadlineAfter(now),
    });
    if (pulseImmediately) this.startSweep(target, `visible:${target.key}:${now}`, now);
    return this.active.size;
  }

  unregisterVisible(key: string): number {
    this.visible.delete(key);
    this.active.delete(key);
    return this.active.size;
  }

  trigger(trigger: DoraSweep3DTrigger, startTime: number): number {
    trigger.targets.forEach((target) => {
      const visible = this.visible.get(target.key);
      if (!visible || this.active.has(target.key)) return;
      visible.variant = target.variant;
      visible.nextPulseAt = repeatDeadlineAfter(startTime);
      this.startSweep(target, trigger.eventId, startTime);
    });
    return this.active.size;
  }

  activateDue(now: number): DoraSweep3DDeadlineResult {
    const activeCountBefore = this.active.size;
    let startedCount = 0;
    this.visible.forEach((visible) => {
      if (visible.nextPulseAt === null || visible.nextPulseAt > now) return;
      const deadline = visible.nextPulseAt;
      this.startSweep(visible, `repeat:${deadline}`, now);
      visible.nextPulseAt = nextFutureDeadline(deadline, now);
      startedCount += 1;
    });
    return {
      activeCountBefore,
      activeCount: this.active.size,
      startedCount,
      startTime: now,
    };
  }

  advance(now: number): number {
    this.active.forEach((sweep, key) => {
      const progress = Math.max(0, Math.min(1, (now - sweep.startTime) / sweep.durationMs));
      sweep.progress = progress;
      if (progress >= 1) this.active.delete(key);
    });
    return this.active.size;
  }

  cancel(eventId: string): number {
    this.active.forEach((sweep, key) => {
      if (sweep.eventId === eventId) this.active.delete(key);
    });
    return this.active.size;
  }

  clear(): void {
    this.active.clear();
    this.visible.clear();
  }

  get(key: string): DoraSweep3DSnapshot | null {
    const sweep = this.active.get(key);
    return sweep ? { ...sweep } : null;
  }

  snapshots(): readonly DoraSweep3DSnapshot[] {
    return [...this.active.values()].map((sweep) => ({ ...sweep }));
  }

  get activeCount(): number {
    return this.active.size;
  }

  get visibleCount(): number {
    return this.visible.size;
  }

  hasVisible(key: string): boolean {
    return this.visible.has(key);
  }

  get nextPulseAt(): number | null {
    let next: number | null = null;
    this.visible.forEach((visible) => {
      if (visible.nextPulseAt !== null && (next === null || visible.nextPulseAt < next)) {
        next = visible.nextPulseAt;
      }
    });
    return next;
  }

  private startSweep(target: DoraSweep3DTarget, eventId: string, startTime: number): void {
    this.active.set(target.key, {
      eventId,
      key: target.key,
      variant: target.variant,
      startTime,
      durationMs: durationForVariant(target.variant),
      progress: 0,
    });
  }
}

export class DoraSweep3DDeadlineScheduler {
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly controller: DoraSweep3DController,
    private readonly onDeadline: (result: DoraSweep3DDeadlineResult) => void,
    private readonly now: () => number = () => performance.now(),
  ) {}

  arm(): void {
    this.cancel();
    const deadline = this.controller.nextPulseAt;
    if (deadline === null) return;
    this.timeout = setTimeout(() => {
      this.timeout = null;
      const result = this.controller.activateDue(this.now());
      this.onDeadline(result);
      this.arm();
    }, Math.max(0, deadline - this.now()));
  }

  cancel(): void {
    if (this.timeout === null) return;
    clearTimeout(this.timeout);
    this.timeout = null;
  }

  get pending(): boolean {
    return this.timeout !== null;
  }
}

function durationForVariant(variant: DoraSweep3DVariant): number {
  return variant === 'combined'
    ? TABLE_PRESENTATION_TUNING.doraSweep3D.combinedDurationMs
    : TABLE_PRESENTATION_TUNING.doraSweep3D.normalDurationMs;
}

function repeatDeadlineAfter(startTime: number): number | null {
  return TABLE_PRESENTATION_TUNING.doraSweep3D.repeatEnabled === 1
    ? startTime + TABLE_PRESENTATION_TUNING.doraSweep3D.repeatIntervalMs
    : null;
}

function nextFutureDeadline(previousDeadline: number, now: number): number | null {
  if (TABLE_PRESENTATION_TUNING.doraSweep3D.repeatEnabled !== 1) return null;
  const interval = TABLE_PRESENTATION_TUNING.doraSweep3D.repeatIntervalMs;
  const elapsedIntervals = Math.floor(Math.max(0, now - previousDeadline) / interval) + 1;
  return previousDeadline + elapsedIntervals * interval;
}
