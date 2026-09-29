import {
  AnimationScheduler,
  waitForAnimationTime,
  type AnimationTask,
} from '../animation/AnimationScheduler';
import type { NorthCommittedPresentationEvent, MeldDeclaredPresentationEvent, RiichiDeclaredPresentationEvent, TileDiscardedPresentationEvent, TileDrawnPresentationEvent } from '../PresentationEventBus';
import type { PresentationRect } from './DiscardSourceSnapshot';
import { handAudioCue, presentationAudioCues, type AnimationCueFrame } from '../PresentationAudioCue';

export type HandAnimationAction = NorthCommittedPresentationEvent | TileDrawnPresentationEvent | RiichiDeclaredPresentationEvent | MeldDeclaredPresentationEvent | (TileDiscardedPresentationEvent & {
  readonly discardSourceRect?: PresentationRect;
});
export type HandAnimationPhase = 'approach' | 'grasp' | 'travel' | 'release' | 'retreat';

export interface HandAnimationTarget {
  animationTasks?(action: HandAnimationAction, onFrame?: AnimationCueFrame): readonly AnimationTask[] | undefined;
  beforeEnqueue?(action: HandAnimationAction): boolean | void;
  prepare(action: HandAnimationAction): boolean | Promise<boolean>;
  setPhase(action: HandAnimationAction, phase: HandAnimationPhase): void;
  finish(action: HandAnimationAction): void;
  clear(): void;
}

export interface HandAnimationControllerOptions {
  readonly snapOnPlaybackChange?: boolean;
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

const liveHandControllers = new Set<HandAnimationController>();
/** Match announces input opening independently of animation completion. Stalled visuals yield now. */
export function finishHandsForAuthoritativeInput(): void {
  liveHandControllers.forEach(controller => controller.cancelAll());
}

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
  private generation = 0;
  private closeAudioRun: (() => void) | null = null;
  private skip = false;
  private reducedMotion = false;

  constructor(
    private readonly target: HandAnimationTarget,
    private readonly scheduler: AnimationScheduler = new AnimationScheduler(),
    private readonly options: HandAnimationControllerOptions = {},
  ) {
    liveHandControllers.add(this);
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
    if (this.options.snapOnPlaybackChange) this.cancelAll();
  }

  setSkip(skip: boolean): void {
    this.skip = skip;
    if (skip) this.closeAudioRun?.();
    this.scheduler.setSkip(skip || this.reducedMotion);
    if (skip && this.options.snapOnPlaybackChange) this.cancelAll();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.scheduler.setSkip(this.skip || reduced);
    if (reduced && this.currentAction) this.cancelAll();
  }

  cancelAll(): void {
    this.closeAudioRun?.();
    this.generation += 1;
    this.queue.splice(0).forEach((action) => this.safeFinish(action));
    this.scheduler.cancelAll();
    this.target.clear();
    this.notifyIdleIfNeeded();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    liveHandControllers.delete(this);
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
      const generation = this.generation;
      const audioRun = presentationAudioCues.run(action);
      this.closeAudioRun = audioRun.close;
      const onFrame: AnimationCueFrame = (phase, progress, profile) => {
        if (generation !== this.generation || this.disposed) return;
        const cue = handAudioCue(action, phase, progress, profile);
        if (cue) audioRun.emit(cue, phase, progress);
      };
      try {
        const prepared = await this.target.prepare(action);
        if (prepared && generation === this.generation && !this.disposed) {
          const holdMs = this.postAnimationHoldMs(action);
          const status = await this.scheduler.sequence([
            ...(this.target.animationTasks?.(action, onFrame)
              ?? HAND_ANIMATION_PHASES.map(({ phase, durationMs }) => this.phaseTask(action, phase, durationMs, onFrame))),
            ...(holdMs > 0 ? [this.holdTask(holdMs)] : []),
          ]);
          if (status === 'skipped' && this.reducedMotion && !this.skip
            && generation === this.generation && !this.disposed) {
            const kind = action.type === 'tile_drawn' ? 'draw-contact'
              : action.type === 'tile_discarded' ? 'discard-impact'
              : action.type === 'meld_declared' ? 'meld-impact' : action.type === 'riichi_declared' ? 'riichi-stick-impact' : undefined;
            if (kind) audioRun.emit(kind, 'reduced-motion-settled', 1);
          }
        }
      } catch (error) {
        this.onError(error, action);
      } finally {
        audioRun.close();
        this.closeAudioRun = null;
        this.safeFinish(action);
        this.currentAction = null;
      }
    }
  }

  private phaseTask(action: HandAnimationAction, phase: HandAnimationPhase, durationMs: number, onFrame: AnimationCueFrame): AnimationTask {
    return {
      play: async (context) => {
        this.target.setPhase(action, phase);
        if (!context.signal.aborted) onFrame(phase, 0);
        await waitForAnimationTime(durationMs, context);
        if (!context.signal.aborted) onFrame(phase, 1);
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
