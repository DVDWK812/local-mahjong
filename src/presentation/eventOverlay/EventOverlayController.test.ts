import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimationScheduler } from '../animation/AnimationScheduler';
import { PresentationPacingGate } from '../pacing/PresentationPacingGate';
import {
  EventOverlayController,
  eventOverlayIntensity,
  eventOverlayLabel,
  overlayPhases,
  type EventOverlayAction,
  type EventOverlayPhase,
  type EventOverlayTarget,
} from './EventOverlayController';

function action(overrides: Partial<EventOverlayAction> = {}): EventOverlayAction {
  return {
    eventId: 'overlay-2',
    sequence: 2,
    type: 'meld_declared',
    playerId: 0,
    meldType: 'chi',
    ...overrides,
  } as EventOverlayAction;
}

function target(log: string[], prepareResult: boolean | Error = true): EventOverlayTarget {
  return {
    prepare: () => {
      log.push('prepare');
      if (prepareResult instanceof Error) throw prepareResult;
      return prepareResult;
    },
    setPhase: (_action, phase: EventOverlayPhase) => log.push(phase),
    finish: () => log.push('finish'),
    clear: () => log.push('clear'),
  };
}

afterEach(() => vi.useRealTimers());

describe('EventOverlayController', () => {
  it('等待更早的牌动作，再按 enter → hold → exit 串行清理', async () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'discard-1', sequence: 1 });
    gate.begin({ eventId: 'overlay-2', sequence: 2 });
    const controller = new EventOverlayController(target(log), new AnimationScheduler(), gate, {
      onSettled: (settled) => gate.complete(settled.eventId),
    });

    controller.enqueue(action());
    await Promise.resolve();
    expect(log).toEqual([]);
    gate.complete('discard-1');
    await vi.runAllTimersAsync();
    await controller.whenIdle();

    expect(log).toEqual(['prepare', 'lead-in', 'enter', 'hold', 'exit', 'finish']);
    expect(gate.pendingCount).toBe(0);
  });

  it('连续事件保持单队列且 complete 后可继续复用', async () => {
    const log: string[] = [];
    const gate = new PresentationPacingGate();
    const controller = new EventOverlayController(target(log), new AnimationScheduler(), gate, {
      onSettled: (settled) => gate.complete(settled.eventId),
    });
    controller.setSkip(true);
    const events = [
      action({ eventId: 'pon-1', sequence: 1, meldType: 'pon' }),
      action({ eventId: 'riichi-2', sequence: 2, type: 'riichi_declared', riverIndex: 0 }),
      action({ eventId: 'win-3', sequence: 3, type: 'win_declared', winType: 'ron' }),
    ];
    events.forEach((event) => { gate.begin(event); controller.enqueue(event); });
    await controller.whenIdle();

    expect(log.filter((entry) => entry === 'prepare')).toHaveLength(3);
    expect(log.filter((entry) => entry === 'finish')).toHaveLength(3);
    expect(gate.pendingCount).toBe(0);
  });

  it('流局提示等待最后一次牌动作完成后才开始，并在自身完成后释放 Result pacing', async () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const gate = new PresentationPacingGate();
    const draw = action({
      eventId: 'draw-settled-2',
      sequence: 2,
      type: 'round_end_announced',
      settlementType: 'exhaustive-draw',
    });
    gate.begin({ eventId: 'last-discard-1', sequence: 1 });
    gate.begin(draw);
    const controller = new EventOverlayController(target(log), new AnimationScheduler(), gate, {
      onSettled: (settled) => gate.complete(settled.eventId),
    });

    controller.enqueue(draw);
    await Promise.resolve();
    expect(log).toEqual([]);
    gate.complete('last-discard-1');
    await vi.runAllTimersAsync();
    await controller.whenIdle();

    expect(log).toEqual(['prepare', 'lead-in', 'enter', 'hold', 'exit', 'finish']);
    expect(gate.pendingCount).toBe(0);
  });

  it('Cancel、error、Skip 与 Dispose 均清理并释放自身 pacing', async () => {
    const gate = new PresentationPacingGate();
    const errors: unknown[] = [];
    const log: string[] = [];
    const controller = new EventOverlayController(target(log, new Error('overlay failed')), new AnimationScheduler(), gate, {
      onError: (error) => errors.push(error),
      onSettled: (settled) => gate.complete(settled.eventId),
    });
    const failed = action({ eventId: 'failed-1', sequence: 1 });
    gate.begin(failed);
    controller.enqueue(failed);
    await controller.whenIdle();
    expect(errors).toHaveLength(1);
    expect(gate.pendingCount).toBe(0);

    const cancelled = action({ eventId: 'cancelled-2', sequence: 2, meldType: 'kan' });
    gate.begin(cancelled);
    controller.enqueue(cancelled);
    controller.cancelAll();
    await controller.whenIdle();
    expect(gate.pendingCount).toBe(0);

    const unmounted = action({ eventId: 'unmounted-3', sequence: 3, meldType: 'pon' });
    gate.begin(unmounted);
    controller.enqueue(unmounted);
    controller.dispose();
    await controller.whenIdle();
    expect(log).toContain('clear');
    expect(gate.pendingCount).toBe(0);
  });

  it('牌局事件与局终事件映射到统一文案、强中轻层级与有限时长', () => {
    const variants: EventOverlayAction[] = [
      action({ type: 'riichi_declared', riverIndex: 1, kind: 'riichi' }),
      action({ type: 'meld_declared', meldType: 'chi' }),
      action({ type: 'meld_declared', meldType: 'pon' }),
      action({ type: 'meld_declared', meldType: 'kan', kanType: 'ankan' }),
      action({ type: 'win_declared', winType: 'ron' }),
      action({ type: 'win_declared', winType: 'tsumo' }),
      action({ type: 'round_end_announced', settlementType: 'exhaustive-draw' }),
      action({ type: 'round_end_announced', settlementType: 'abortive-draw', reason: 'kyuushu-kyuuhai' }),
      action({ type: 'round_end_announced', settlementType: 'abortive-draw', reason: 'suufon-renda' }),
      action({ type: 'round_end_announced', settlementType: 'abortive-draw', reason: 'suucha-riichi' }),
      action({ type: 'round_end_announced', settlementType: 'abortive-draw', reason: 'suukan-sanra' }),
      action({ type: 'round_end_announced', settlementType: 'abortive-draw', reason: 'sanchahou' }),
    ];
    expect(variants.map(eventOverlayLabel)).toEqual(['立直', '吃', '碰', '杠', '荣和', '自摸', '流局', '九种九牌', '四风连打', '四家立直', '四杠散了', '三家和']);
    expect(variants.map(eventOverlayIntensity)).toEqual(['medium', 'light', 'light', 'medium', 'strong', 'strong', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium']);
    variants.forEach((variant) => expect(overlayPhases(variant).map((phase) => phase.phase)).toEqual(['lead-in', 'enter', 'hold', 'exit']));
  });
});
