import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimationScheduler } from '../animation/AnimationScheduler';
import { PresentationPacingGate } from '../pacing/PresentationPacingGate';
import type { WinPresentationAction, WinPresentationPhase, WinPresentationTarget } from './WinPresentationController';
import { WinPresentationController } from './WinPresentationController';

function action(overrides: Partial<WinPresentationAction> = {}): WinPresentationAction {
  return {
    eventId: 'win-2',
    sequence: 2,
    type: 'win_declared',
    playerId: 0,
    winType: 'tsumo',
    ...overrides,
  };
}

function target(log: string[], prepareResult: boolean | Error = true): WinPresentationTarget {
  return {
    prepare: () => {
      log.push('prepare');
      if (prepareResult instanceof Error) throw prepareResult;
      return prepareResult;
    },
    setPhase: (_action, phase: WinPresentationPhase) => log.push(phase),
    finish: () => log.push('finish'),
    clear: () => log.push('clear'),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('WinPresentationController', () => {
  it('等待先前 Draw/Discard pacing，再按 slam → push → announce → hold 清理', async () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'draw-1', sequence: 1 });
    gate.begin({ eventId: 'win-2', sequence: 2 });
    const controller = new WinPresentationController(target(log), new AnimationScheduler(), gate, {
      onSettled: (settled) => gate.complete(settled.eventId),
    });

    controller.enqueue(action());
    await Promise.resolve();
    expect(log).toEqual([]);
    gate.complete('draw-1');
    await vi.runAllTimersAsync();
    await controller.whenIdle();

    expect(log).toEqual(['prepare', 'slam', 'push', 'announce', 'hold', 'cleanup', 'finish']);
    expect(gate.pendingCount).toBe(0);
  });

  it('Speed/Skip 会快速 snap 到最终态并完整 cleanup', async () => {
    const log: string[] = [];
    const gate = new PresentationPacingGate();
    gate.begin({ eventId: 'win-2', sequence: 2 });
    const controller = new WinPresentationController(target(log), new AnimationScheduler(), gate, {
      onSettled: (settled) => gate.complete(settled.eventId),
    });
    controller.setSpeed(2);
    controller.setSkip(true);
    controller.enqueue(action());
    await controller.whenIdle();
    expect(log[log.length - 1]).toBe('finish');
    expect(gate.pendingCount).toBe(0);
  });

  it('Cancel / error 都清理并释放 pacing，队列仍可复用', async () => {
    const gate = new PresentationPacingGate();
    const errors: unknown[] = [];
    const log: string[] = [];
    gate.begin({ eventId: 'win-error', sequence: 3 });
    const controller = new WinPresentationController(target(log, new Error('render failed')), new AnimationScheduler(), gate, {
      onError: (error) => errors.push(error),
      onSettled: (settled) => gate.complete(settled.eventId),
    });
    controller.enqueue(action({ eventId: 'win-error', sequence: 3 }));
    await controller.whenIdle();
    expect(errors).toHaveLength(1);
    expect(log).toContain('finish');
    expect(gate.pendingCount).toBe(0);

    gate.begin({ eventId: 'win-cancel', sequence: 4 });
    controller.enqueue(action({ eventId: 'win-cancel', sequence: 4, winType: 'ron' }));
    controller.cancelAll();
    await controller.whenIdle();
    expect(gate.pendingCount).toBe(0);
  });

  it('Dispose（Unmount）立即清理当前 action 并释放 Win pacing', async () => {
    const gate = new PresentationPacingGate();
    const log: string[] = [];
    gate.begin({ eventId: 'earlier', sequence: 9 });
    gate.begin({ eventId: 'win-unmount', sequence: 10 });
    const controller = new WinPresentationController(target(log), new AnimationScheduler(), gate, {
      onSettled: (settled) => gate.complete(settled.eventId),
    });
    controller.enqueue(action({ eventId: 'win-unmount', sequence: 10 }));
    await Promise.resolve();

    controller.dispose();

    expect(log).toContain('finish');
    expect(gate.pendingCount).toBe(1);
    gate.cancel('earlier');
    await controller.whenIdle();
  });
});
