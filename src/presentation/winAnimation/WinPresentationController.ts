import {
  AnimationScheduler,
  waitForAnimationTime,
  type AnimationTask,
} from '../animation/AnimationScheduler';
import type {
  TileDiscardedPresentationEvent,
  WinDeclaredPresentationEvent,
} from '../PresentationEventBus';
import type { PresentationPacingGate } from '../pacing/PresentationPacingGate';

export type WinPresentationPhase = 'slam' | 'push' | 'announce' | 'hold' | 'cleanup';

export type WinPresentationAction = WinDeclaredPresentationEvent & {
  readonly sourceDiscard?: TileDiscardedPresentationEvent;
};

export interface WinPresentationTarget {
  prepare(action: WinPresentationAction): boolean | Promise<boolean>;
  setPhase(action: WinPresentationAction, phase: WinPresentationPhase): void;
  finish(action: WinPresentationAction): void;
  clear(): void;
}

export interface WinPresentationControllerOptions {
  readonly maxQueuedActions?: number;
  readonly onError?: (error: unknown, action: WinPresentationAction) => void;
  readonly onSettled?: (action: WinPresentationAction) => void;
}

const PHASE_DURATIONS: Record<WinPresentationPhase, number> = {
  slam: 210,
  push: 280,
  announce: 160,
  hold: 680,
  cleanup: 100,
};

export class WinPresentationController {
  private readonly queue: WinPresentationAction[] = [];
  private readonly idleResolvers = new Set<() => void>();
  private readonly settledEventIds = new Set<string>();
  private readonly maxQueuedActions: number;
  private readonly onError: (error: unknown, action: WinPresentationAction) => void;
  private readonly onSettled: (action: WinPresentationAction) => void;
  private draining = false;
  private disposed = false;
  private currentAction: WinPresentationAction | null = null;

  constructor(
    private readonly target: WinPresentationTarget,
    private readonly scheduler: AnimationScheduler,
    private readonly pacingGate: PresentationPacingGate,
    options: WinPresentationControllerOptions = {},
  ) {
    this.maxQueuedActions = Math.max(1, options.maxQueuedActions ?? 3);
    this.onError = options.onError ?? (() => undefined);
    this.onSettled = options.onSettled ?? (() => undefined);
  }

  get queuedActionCount(): number {
    return this.queue.length;
  }

  get runningActionCount(): number {
    return this.currentAction ? 1 : 0;
  }

  enqueue(action: WinPresentationAction): boolean {
    if (this.disposed) return false;
    while (this.queue.length >= this.maxQueuedActions) {
      const skipped = this.queue.shift();
      if (skipped) this.safeFinish(skipped);
    }
    this.queue.push(action);
    this.startDrain();
    return true;
  }

  setSpeed(speed: number): void {
    this.scheduler.setSpeed(speed);
  }

  setSkip(skip: boolean): void {
    this.scheduler.setSkip(skip);
  }

  cancelAll(): void {
    this.queue.splice(0).forEach((action) => this.safeFinish(action));
    if (this.currentAction) this.safeFinish(this.currentAction);
    this.scheduler.cancelAll();
    this.target.clear();
    this.notifyIdleIfNeeded();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelAll();
  }

  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.add(resolve));
  }

  private startDrain(): void {
    if (this.draining) return;
    this.draining = true;
    void this.drain().finally(() => {
      this.draining = false;
      this.notifyIdleIfNeeded();
      if (!this.disposed && this.queue.length > 0) this.startDrain();
    });
  }

  private async drain(): Promise<void> {
    while (!this.disposed && this.queue.length > 0) {
      const action = this.queue.shift();
      if (!action) continue;
      this.currentAction = action;
      try {
        await this.pacingGate.waitUntilClearBefore(action.sequence);
        if (this.disposed) continue;
        const prepared = await this.target.prepare(action);
        if (prepared) {
          await this.scheduler.sequence((Object.keys(PHASE_DURATIONS) as WinPresentationPhase[])
            .map((phase) => this.phaseTask(action, phase, action.winType === 'ron' && phase === 'slam' ? 0 : PHASE_DURATIONS[phase])));
        }
      } catch (error) {
        this.onError(error, action);
      } finally {
        this.safeFinish(action);
        this.currentAction = null;
      }
    }
  }

  private phaseTask(action: WinPresentationAction, phase: WinPresentationPhase, durationMs: number): AnimationTask {
    return {
      play: async (context) => {
        this.target.setPhase(action, phase);
        await waitForAnimationTime(durationMs, context);
      },
      snapToEnd: () => this.target.setPhase(action, phase),
    };
  }

  private safeFinish(action: WinPresentationAction): void {
    if (this.settledEventIds.has(action.eventId)) return;
    this.settledEventIds.add(action.eventId);
    try {
      this.target.finish(action);
    } catch (error) {
      this.onError(error, action);
    } finally {
      try {
        this.onSettled(action);
      } catch (error) {
        this.onError(error, action);
      }
    }
  }

  private isIdle(): boolean {
    return !this.draining && !this.currentAction && this.queue.length === 0;
  }

  private notifyIdleIfNeeded(): void {
    if (!this.isIdle()) return;
    this.idleResolvers.forEach((resolve) => resolve());
    this.idleResolvers.clear();
  }
}
