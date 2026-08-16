import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimationScheduler } from '../animation/AnimationScheduler';
import type { PresentationEvent } from '../PresentationEventBus';
import { HandAnimationController, type HandAnimationAction, type HandAnimationPhase, type HandAnimationTarget } from './HandAnimationController';
import { RiverTileMask, type MaskableRiverTile } from './RiverTileMask';

function drawn(sequence: number, playerId: 0 | 1 | 2 | 3 = 0): PresentationEvent {
  return { eventId: `draw-${sequence}`, sequence, type: 'tile_drawn', playerId };
}

function discarded(sequence: number, playerId: 0 | 1 | 2 | 3 = 0): PresentationEvent {
  return {
    eventId: `discard-${sequence}`,
    sequence,
    type: 'tile_discarded',
    playerId,
    tile: { id: 0, red: false },
    riverIndex: sequence - 1,
    isRiichiDiscard: false,
  };
}

class FakeTarget implements HandAnimationTarget {
  readonly log: string[] = [];
  readonly active = new Set<string>();
  failEventId: string | null = null;

  prepare(action: HandAnimationAction): boolean {
    this.active.add(action.eventId);
    this.log.push(`prepare:${action.eventId}`);
    return true;
  }

  setPhase(action: HandAnimationAction, phase: HandAnimationPhase): void {
    this.log.push(`${phase}:${action.eventId}`);
    if (action.eventId === this.failEventId) throw new Error('phase failed');
  }

  finish(action: HandAnimationAction): void {
    this.active.delete(action.eventId);
    this.log.push(`finish:${action.eventId}`);
  }

  clear(): void {
    this.active.clear();
    this.log.push('clear');
  }
}

class MaskingTarget extends FakeTarget {
  readonly mask = new RiverTileMask();
  readonly elements = new Map<string, MaskableRiverTile>();

  beforeEnqueue(action: HandAnimationAction): void {
    if (action.type === 'tile_discarded') {
      const element = { style: { visibility: '' } };
      this.elements.set(action.eventId, element);
      this.mask.mask(action.eventId, element);
      this.log.push(`mask:${action.eventId}`);
    }
  }

  override finish(action: HandAnimationAction): void {
    this.mask.reveal(action.eventId);
    super.finish(action);
  }

  override clear(): void {
    this.mask.revealAll();
    super.clear();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('HandAnimationController', () => {
  it('AI discard 入队时立即遮罩河牌，不等待前序动画 prepare', async () => {
    vi.useFakeTimers();
    const scheduler = new AnimationScheduler();
    const target = new MaskingTarget();
    const controller = new HandAnimationController(target, scheduler);

    controller.enqueue(discarded(1, 1));
    controller.enqueue(discarded(2, 2));

    expect(target.mask.maskedCount).toBe(2);
    expect(target.elements.get('discard-1')?.style.visibility).toBe('hidden');
    expect(target.elements.get('discard-2')?.style.visibility).toBe('hidden');
    expect(target.log).not.toContain('prepare:discard-2');

    await vi.runAllTimersAsync();
    await controller.whenIdle();
    expect(target.mask.maskedCount).toBe(0);
  });

  it('Draw → Discard 严格串行且不并发顶层 scheduler batch', async () => {
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const target = new FakeTarget();
    const activeRuns: number[] = [];
    const originalSetPhase = target.setPhase.bind(target);
    target.setPhase = (action, phase) => {
      activeRuns.push(scheduler.activeRunCount);
      originalSetPhase(action, phase);
    };
    const controller = new HandAnimationController(target, scheduler);

    controller.enqueue(drawn(1));
    controller.enqueue(discarded(2));
    await controller.whenIdle();

    expect(target.log.indexOf('finish:draw-1')).toBeLessThan(target.log.indexOf('prepare:discard-2'));
    expect(activeRuns.length).toBeGreaterThan(0);
    expect(Math.max(...activeRuns)).toBe(1);
    expect(controller.queuedActionCount).toBe(0);
    expect(controller.runningActionCount).toBe(0);
  });

  it('complete 后恢复 river mask 并移除 hand/proxy 状态', async () => {
    vi.useFakeTimers();
    const scheduler = new AnimationScheduler();
    const target = new MaskingTarget();
    const controller = new HandAnimationController(target, scheduler);
    controller.enqueue(discarded(1));

    await vi.runAllTimersAsync();
    await controller.whenIdle();

    expect(target.mask.maskedCount).toBe(0);
    expect(target.elements.get('discard-1')?.style.visibility).toBe('');
    expect(target.active.size).toBe(0);
    expect(target.log.indexOf('mask:discard-1')).toBeLessThan(target.log.indexOf('approach:discard-1'));
  });

  it('cancel 会清空 queue、恢复 river mask，并保持 controller 可复用', async () => {
    const scheduler = new AnimationScheduler();
    const target = new MaskingTarget();
    const controller = new HandAnimationController(target, scheduler);
    controller.enqueue(discarded(1));
    await Promise.resolve();
    await Promise.resolve();

    controller.cancelAll();
    await controller.whenIdle();

    expect(target.mask.maskedCount).toBe(0);
    expect(target.active.size).toBe(0);
    expect(scheduler.activeRunCount).toBe(0);
    scheduler.setSkip(true);
    controller.enqueue(drawn(2));
    await controller.whenIdle();
    expect(target.log).toContain('finish:draw-2');
  });

  it('skip 直接得到最终清理状态', async () => {
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const target = new MaskingTarget();
    const controller = new HandAnimationController(target, scheduler);

    controller.enqueue(discarded(1));
    await controller.whenIdle();

    expect(target.log).toContain('retreat:discard-1');
    expect(target.mask.maskedCount).toBe(0);
    expect(target.active.size).toBe(0);
  });

  it('phase error 后恢复 mask 并继续处理下一事件', async () => {
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const target = new MaskingTarget();
    target.failEventId = 'discard-1';
    const onError = vi.fn();
    const controller = new HandAnimationController(target, scheduler, { onError });

    controller.enqueue(discarded(1));
    controller.enqueue(drawn(2));
    await controller.whenIdle();

    expect(onError).toHaveBeenCalled();
    expect(target.mask.maskedCount).toBe(0);
    expect(target.active.size).toBe(0);
    expect(target.log).toContain('finish:draw-2');
    expect(scheduler.activeRunCount).toBe(0);
  });

  it('约100个动作压力下 queue、scheduler、mask 与 hand 全部归零', async () => {
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const target = new MaskingTarget();
    const controller = new HandAnimationController(target, scheduler, { maxQueuedActions: 6 });

    for (let index = 1; index <= 100; index += 1) {
      controller.enqueue(index % 2 === 0 ? discarded(index, (index % 4) as 0 | 1 | 2 | 3) : drawn(index, (index % 4) as 0 | 1 | 2 | 3));
    }
    await controller.whenIdle();

    expect(controller.queuedActionCount).toBe(0);
    expect(controller.runningActionCount).toBe(0);
    expect(scheduler.pendingTaskCount).toBe(0);
    expect(scheduler.runningTaskCount).toBe(0);
    expect(scheduler.activeRunCount).toBe(0);
    expect(target.mask.maskedCount).toBe(0);
    expect(target.active.size).toBe(0);
  });
});

describe('RiverTileMask', () => {
  it('同一事件重复 mask 不覆盖原始 visibility', () => {
    const mask = new RiverTileMask();
    const tile = { style: { visibility: 'visible' } };
    mask.mask('discard', tile);
    mask.mask('discard', tile);
    mask.reveal('discard');
    expect(tile.style.visibility).toBe('visible');
  });

  it('revealAll 恢复每张牌原有 visibility', () => {
    const mask = new RiverTileMask();
    const first = { style: { visibility: '' } };
    const second = { style: { visibility: 'visible' } };
    mask.mask('a', first);
    mask.mask('b', second);
    mask.revealAll();
    expect(first.style.visibility).toBe('');
    expect(second.style.visibility).toBe('visible');
    expect(mask.maskedCount).toBe(0);
  });
});
