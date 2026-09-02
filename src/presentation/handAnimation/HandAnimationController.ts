import {
  AnimationScheduler,
  waitForAnimationTime,
  type AnimationTask,
} from '../animation/AnimationScheduler';
import type { MeldDeclaredPresentationEvent, RiichiDeclaredPresentationEvent, TileDiscardedPresentationEvent, TileDrawnPresentationEvent } from '../PresentationEventBus';
import type { PresentationRect } from './DiscardSourceSnapshot';

export type HandAnimationAction = TileDrawnPresentationEvent | RiichiDeclaredPresentationEvent | MeldDeclaredPresentationEvent | (TileDiscardedPresentationEvent & {
  readonly discardSourceRect?: PresentationRect;
});
export type HandAnimationPhase = 'approach' | 'grasp' | 'travel' | 'release' | 'retreat';

export interface HandAnimationTarget {
  beforeEnqueue?(action: HandAnimationAction): boolean | void;
  prepare(action: HandAnimationAction): boolean | Promise<boolean>;
  setPhase(action: HandAnimationAction, phase: HandAnimationPhase): void;
  finish(action: HandAnimationAction): void;
  clear(): void;
}

export interface HandAnimationControllerOptions {
  readonly maxQueuedActions?: number;
  readonly onError?: (error: unknown, action: HandAnimationAction) => void;
  readonly onSettled?: (action: HandAnimationAction) => void;
  /** Optional presentation-only cadence after the visual lifecycle; defaults to no hold. */
  readonly postAnimationHoldMs?: number | ((action: HandAnimationAction) => number);
}

export const HAND_ANIMATION_PHASES: ReadonlyArray<{ phase: HandAnimationPhase; durationMs: number }> = [
  { phase: 'approach', durationMs: 150 },
  { phase: 'grasp', durationMs: 90 },
  { phase: 'travel', durationMs: 240 },
  { phase: 'release', durationMs: 90 },
  { phase: 'retreat', durationMs: 170 },
];

export class HandAnimationController {
  private readonly queue: HandAnimationAction[] = [];
  private readonly idleResolvers = new Set<() => void>();
  private readonly maxQueuedActions: number;
  private readonly onError: (error: unknown, action: HandAnimationAction) => void;
  private readonly onSettled: (action: HandAnimationAction) => void;
  private readonly postAnimationHoldMs: (action: HandAnimationAction) => number;
  private draining = false;
  private disposed = false;
  private currentAction: HandAnimationAction | null = null;

  constructor(
    private readonly target: HandAnimationTarget,
    private readonly scheduler: AnimationScheduler = new AnimationScheduler(),
    options: HandAnimationControllerOptions = {},
  ) {
    this.maxQueuedActions = Math.max(1, options.maxQueuedActions ?? 6);
    this.onError = options.onError ?? (() => undefined);
    this.onSettled = options.onSettled ?? (() => undefined);
    const postAnimationHoldMs = options.postAnimationHoldMs;
    this.postAnimationHoldMs = typeof postAnimationHoldMs === 'function'
      ? postAnimationHoldMs
      : () => postAnimationHoldMs ?? 0;
  }

  get queuedActionCount(): number {
    return this.queue.length;
  }

  get runningActionCount(): number {
    return this.currentAction ? 1 : 0;
  }

  enqueue(action: HandAnimationAction): boolean {
    if (this.disposed) return false;
    try {
      if (this.target.beforeEnqueue?.(action) === false) {
        this.safeFinish(action);
        return false;
      }
    } catch (error) {
      this.onError(error, action);
      this.safeFinish(action);
      return false;
    }
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
        const prepared = await this.target.prepare(action);
        if (prepared) {
          const holdMs = this.postAnimationHoldMs(action);
          await this.scheduler.sequence([
            ...HAND_ANIMATION_PHASES.map(({ phase, durationMs }) => this.phaseTask(action, phase, durationMs)),
            ...(holdMs > 0 ? [this.holdTask(holdMs)] : []),
          ]);
        }
      } catch (error) {
        this.onError(error, action);
      } finally {
        this.safeFinish(action);
        this.currentAction = null;
      }
    }
  }

  private phaseTask(action: HandAnimationAction, phase: HandAnimationPhase, durationMs: number): AnimationTask {
    return {
      play: async (context) => {
        this.target.setPhase(action, phase);
        await waitForAnimationTime(durationMs, context);
      },
      snapToEnd: () => this.target.setPhase(action, phase),
    };
  }

  private holdTask(durationMs: number): AnimationTask {
    return {
      play: (context) => waitForAnimationTime(durationMs, context),
      snapToEnd: () => undefined,
    };
  }

  private safeFinish(action: HandAnimationAction): void {
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
