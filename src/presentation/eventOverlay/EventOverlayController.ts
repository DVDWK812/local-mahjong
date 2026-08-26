import { AnimationScheduler, waitForAnimationTime, type AnimationTask } from '../animation/AnimationScheduler';
import type {
  MeldDeclaredPresentationEvent,
  RiichiDeclaredPresentationEvent,
  RoundEndAnnouncedPresentationEvent,
  WinDeclaredPresentationEvent,
} from '../PresentationEventBus';
import type { PresentationPacingGate } from '../pacing/PresentationPacingGate';

export type EventOverlayAction =
  | RiichiDeclaredPresentationEvent
  | MeldDeclaredPresentationEvent
  | WinDeclaredPresentationEvent
  | RoundEndAnnouncedPresentationEvent;
export type EventOverlayPhase = 'lead-in' | 'enter' | 'hold' | 'exit';
export type EventOverlayIntensity = 'strong' | 'medium' | 'light';

export interface EventOverlayTarget {
  prepare(action: EventOverlayAction): boolean | Promise<boolean>;
  setPhase(action: EventOverlayAction, phase: EventOverlayPhase): void;
  finish(action: EventOverlayAction): void;
  clear(): void;
}

export interface EventOverlayControllerOptions {
  readonly maxQueuedActions?: number;
  readonly onError?: (error: unknown, action: EventOverlayAction) => void;
  readonly onSettled?: (action: EventOverlayAction) => void;
}

export class EventOverlayController {
  private readonly queue: EventOverlayAction[] = [];
  private readonly idleResolvers = new Set<() => void>();
  private readonly settledEventIds = new Set<string>();
  private readonly maxQueuedActions: number;
  private readonly onError: (error: unknown, action: EventOverlayAction) => void;
  private readonly onSettled: (action: EventOverlayAction) => void;
  private draining = false;
  private disposed = false;
  private currentAction: EventOverlayAction | null = null;

  constructor(
    private readonly target: EventOverlayTarget,
    private readonly scheduler: AnimationScheduler,
    private readonly pacingGate: PresentationPacingGate,
    options: EventOverlayControllerOptions = {},
  ) {
    this.maxQueuedActions = Math.max(1, options.maxQueuedActions ?? 6);
    this.onError = options.onError ?? (() => undefined);
    this.onSettled = options.onSettled ?? (() => undefined);
  }

  get queuedActionCount(): number {
    return this.queue.length;
  }

  get runningActionCount(): number {
    return this.currentAction ? 1 : 0;
  }

  enqueue(action: EventOverlayAction): boolean {
    if (this.disposed || this.settledEventIds.has(action.eventId)) return false;
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
          await this.scheduler.sequence(overlayPhases(action).map(({ phase, durationMs }) => this.phaseTask(action, phase, durationMs)));
        }
      } catch (error) {
        this.onError(error, action);
      } finally {
        this.safeFinish(action);
        this.currentAction = null;
      }
    }
  }

  private phaseTask(action: EventOverlayAction, phase: EventOverlayPhase, durationMs: number): AnimationTask {
    return {
      play: async (context) => {
        this.target.setPhase(action, phase);
        await waitForAnimationTime(durationMs, context);
      },
      snapToEnd: () => this.target.setPhase(action, phase),
    };
  }

  private safeFinish(action: EventOverlayAction): void {
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

export function eventOverlayIntensity(action: EventOverlayAction): EventOverlayIntensity {
  if (action.type === 'win_declared') return 'strong';
  if (action.type === 'round_end_announced' || action.type === 'riichi_declared') return 'medium';
  if (action.type === 'meld_declared' && action.meldType === 'kan') return 'medium';
  return 'light';
}

export function eventOverlayLabel(action: EventOverlayAction): string {
  if (action.type === 'win_declared') return action.winType === 'tsumo' ? '自摸' : '荣和';
  if (action.type === 'round_end_announced') {
    if (action.settlementType === 'exhaustive-draw') return '流局';
    if (action.reason === 'kyuushu-kyuuhai') return '九种九牌';
    if (action.reason === 'suufon-renda') return '四风连打';
    if (action.reason === 'suucha-riichi') return '四家立直';
    return action.reason === 'suukan-sanra' ? '四杠散了' : '三家和';
  }
  if (action.type === 'riichi_declared') return action.kind === 'double-riichi' ? '双立直' : '立直';
  if (action.meldType === 'kan') return '杠';
  return action.meldType === 'pon' ? '碰' : '吃';
}

export function overlayPhases(action: EventOverlayAction): ReadonlyArray<{ phase: EventOverlayPhase; durationMs: number }> {
  const intensity = eventOverlayIntensity(action);
  const leadIn = action.type === 'win_declared'
    ? action.winType === 'tsumo' ? 490 : 280
    : action.type === 'round_end_announced' ? 180 : 480;
  const hold = intensity === 'strong' ? 700 : intensity === 'medium' ? 520 : 400;
  return [
    { phase: 'lead-in', durationMs: leadIn },
    { phase: 'enter', durationMs: 140 },
    { phase: 'hold', durationMs: hold },
    { phase: 'exit', durationMs: 140 },
  ];
}
