import { describe, expect, it, vi } from 'vitest';
import { PresentationEventBus, type PresentationEvent } from '../PresentationEventBus';
import { PresentationPacingGate } from '../pacing/PresentationPacingGate';
import { EventOverlayConsumer } from './EventOverlayConsumer';
import type { EventOverlayAction } from './EventOverlayController';

function harness(enabled = true, presentationEvents = true) {
  const bus = new PresentationEventBus();
  const gate = new PresentationPacingGate();
  const accepted: EventOverlayAction[] = [];
  const enqueue = vi.fn((event: EventOverlayAction) => { accepted.push(event); return true; });
  const consumer = new EventOverlayConsumer(
    { enqueue },
    gate,
    bus,
    () => enabled,
    () => ({ presentationEvents, handAnimations: true }),
  );
  return { bus, gate, accepted, enqueue, consumer };
}

describe('EventOverlayConsumer', () => {
  it('Riichi / Chi / Pon / Kan / Ron / Tsumo / Draw 每个 confirmed event 各消费一次', () => {
    const { bus, accepted, consumer } = harness();
    consumer.start();
    bus.publish({ type: 'riichi_declared', playerId: 0, riverIndex: 0, kind: 'riichi' });
    bus.publish({ type: 'meld_declared', playerId: 1, meldType: 'chi' });
    bus.publish({ type: 'meld_declared', playerId: 2, meldType: 'pon' });
    bus.publish({ type: 'meld_declared', playerId: 3, meldType: 'kan', kanType: 'minkan' });
    bus.publish({ type: 'win_declared', playerId: 1, winType: 'ron' });
    bus.publish({ type: 'win_declared', playerId: 0, winType: 'tsumo' });
    bus.publish({ type: 'round_end_announced', settlementType: 'exhaustive-draw' });

    expect(accepted.map((event) => event.type === 'meld_declared'
      ? event.meldType
      : event.type === 'win_declared'
        ? event.winType
        : event.type === 'round_end_announced' ? event.settlementType : 'riichi'))
      .toEqual(['riichi', 'chi', 'pon', 'kan', 'ron', 'tsumo', 'exhaustive-draw']);
    consumer.dispose();
  });

  it('重复 eventId 与 StrictMode 式重复 start 不会重复入队', () => {
    const { bus, enqueue, consumer } = harness();
    consumer.start();
    consumer.start();
    const event = bus.publish({ type: 'meld_declared', playerId: 0, meldType: 'pon' });
    consumer.handle(event);
    expect(enqueue).toHaveBeenCalledOnce();
    consumer.dispose();
  });

  it('创建前的历史事件不会 backfill，非目标事件也不会进入 overlay', () => {
    const bus = new PresentationEventBus();
    const historic = bus.publish({ type: 'meld_declared', playerId: 0, meldType: 'chi' });
    const gate = new PresentationPacingGate();
    const enqueue = vi.fn(() => true);
    const consumer = new EventOverlayConsumer({ enqueue }, gate, bus);
    consumer.start();
    consumer.handle(historic as PresentationEvent);
    bus.publish({ type: 'tile_drawn', playerId: 0 });
    expect(enqueue).not.toHaveBeenCalled();
    consumer.dispose();
  });

  it('feature flag disabled 或 Replay/Test Mode disabled source 时不入队、不占 pacing', () => {
    const featureOff = harness(true, false);
    featureOff.consumer.start();
    featureOff.bus.publish({ type: 'win_declared', playerId: 0, winType: 'tsumo' });
    expect(featureOff.accepted).toEqual([]);
    expect(featureOff.gate.pendingCount).toBe(0);
    featureOff.consumer.dispose();

    const realtimeOff = harness(false, true);
    realtimeOff.consumer.start();
    realtimeOff.bus.publish({ type: 'riichi_declared', playerId: 0, riverIndex: 0 });
    expect(realtimeOff.accepted).toEqual([]);
    expect(realtimeOff.gate.pendingCount).toBe(0);
    realtimeOff.consumer.dispose();
  });
});
