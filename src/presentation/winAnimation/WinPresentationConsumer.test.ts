import { describe, expect, it } from 'vitest';
import { AnimationScheduler } from '../animation/AnimationScheduler';
import { PresentationEventBus } from '../PresentationEventBus';
import { PresentationPacingGate } from '../pacing/PresentationPacingGate';
import { WinPresentationConsumer } from './WinPresentationConsumer';
import { WinPresentationController, type WinPresentationAction, type WinPresentationTarget } from './WinPresentationController';

function harness(enabled: () => boolean) {
  const prepared: WinPresentationAction[] = [];
  const target: WinPresentationTarget = {
    prepare: (action) => { prepared.push(action); return true; },
    setPhase: () => undefined,
    finish: () => undefined,
    clear: () => undefined,
  };
  const bus = new PresentationEventBus();
  const gate = new PresentationPacingGate();
  const controller = new WinPresentationController(target, new AnimationScheduler(), gate, {
    onSettled: (action) => gate.complete(action.eventId),
  });
  controller.setSkip(true);
  const consumer = new WinPresentationConsumer(bus, controller, gate, enabled);
  consumer.start();
  return { bus, gate, controller, consumer, prepared };
}

describe('WinPresentationConsumer', () => {
  it('用 sourceEventId 解析既有真实弃牌事件，不复制 river payload', async () => {
    const { bus, controller, consumer, prepared } = harness(() => true);
    const discard = bus.publish({
      type: 'tile_discarded', playerId: 2, tile: { id: 4, red: false }, riverIndex: 7, isRiichiDiscard: false,
    });
    bus.publish({
      type: 'win_declared', playerId: 1, winType: 'ron', sourceEventId: discard.eventId,
    });
    await controller.whenIdle();
    expect(prepared).toEqual([expect.objectContaining({
      winType: 'ron',
      sourceDiscard: expect.objectContaining({ playerId: 2, riverIndex: 7 }),
    })]);
    consumer.dispose();
    controller.dispose();
  });

  it('feature flag disabled 时不启动、不占用 pacing', async () => {
    const { bus, gate, controller, consumer, prepared } = harness(() => false);
    bus.publish({ type: 'win_declared', playerId: 0, winType: 'tsumo' });
    await controller.whenIdle();
    expect(prepared).toEqual([]);
    expect(gate.pendingCount).toBe(0);
    consumer.dispose();
    controller.dispose();
  });
});
