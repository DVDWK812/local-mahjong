import { describe, expect, it, vi } from 'vitest';
import { PresentationEventBus } from '../PresentationEventBus';
import { DiscardSourceSnapshotStore } from './DiscardSourceSnapshot';
import { HandAnimationConsumer } from './HandAnimationConsumer';

describe('HandAnimationConsumer', () => {
  it('handAnimations flag 只控制动画，不阻止 presentation event', () => {
    let handAnimations = false;
    const bus = new PresentationEventBus();
    const enqueue = vi.fn();
    const consumer = new HandAnimationConsumer({ enqueue }, bus, () => true, () => ({ presentationEvents: true, handAnimations }));

    bus.publish({ type: 'tile_drawn', playerId: 1 });
    handAnimations = true;
    const discarded = bus.publish({
      type: 'tile_discarded',
      playerId: 1,
      tile: { id: 4, red: true },
      riverIndex: 0,
      isRiichiDiscard: false,
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(discarded);
    consumer.dispose();
  });

  it('Replay / Test Mode policy 关闭时不排队，恢复后只接收新事件', () => {
    let realtime = false;
    const bus = new PresentationEventBus();
    const enqueue = vi.fn();
    const consumer = new HandAnimationConsumer({ enqueue }, bus, () => realtime, () => ({ presentationEvents: true, handAnimations: true }));

    bus.publish({ type: 'tile_drawn', playerId: 0 });
    realtime = true;
    bus.publish({ type: 'tile_drawn', playerId: 2 });
    consumer.dispose();
    bus.publish({ type: 'tile_drawn', playerId: 3 });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toMatchObject({ type: 'tile_drawn', playerId: 2 });
  });
  it('confirmed local discard consumes source rect before entering the queue', () => {
    const bus = new PresentationEventBus();
    const enqueue = vi.fn();
    const snapshots = new DiscardSourceSnapshotStore();
    const freshness = { sessionKey: 'round-1', confirmedTurn: 8 };
    snapshots.capture({
      playerId: 0,
      tileInstanceId: 'clicked-instance',
      tile: { id: 7, red: false },
      sourceTileRect: { left: 100, top: 600, width: 40, height: 60 },
      ...freshness,
    });
    const consumer = new HandAnimationConsumer(
      { enqueue },
      bus,
      () => true,
      () => ({ presentationEvents: true, handAnimations: true }),
      (event) => {
        if (event.type !== 'tile_discarded') return event;
        const snapshot = snapshots.consume(event, freshness);
        return snapshot ? { ...event, discardSourceRect: snapshot.sourceTileRect } : event;
      },
    );

    bus.publish({
      type: 'tile_discarded',
      playerId: 0,
      tile: { id: 7, red: false },
      riverIndex: 3,
      isRiichiDiscard: false,
    });

    expect(snapshots.hasSnapshot).toBe(false);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      discardSourceRect: { left: 100, top: 600, width: 40, height: 60 },
    }));
    consumer.dispose();
  });

  it('riichi_declared 只入队一个独立立直动作，不复制 discard 动作', () => {
    const bus = new PresentationEventBus();
    const enqueue = vi.fn();
    const consumer = new HandAnimationConsumer({ enqueue }, bus);

    const riichi = bus.publish({ type: 'riichi_declared', playerId: 2, riverIndex: 4 });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(riichi);
    expect(enqueue.mock.calls[0][0]).toMatchObject({ type: 'riichi_declared', playerId: 2, riverIndex: 4 });
    consumer.dispose();
  });

  it('meld_declared 只入队一个 caller-to-meld 动作', () => {
    const bus = new PresentationEventBus();
    const enqueue = vi.fn();
    const consumer = new HandAnimationConsumer({ enqueue }, bus);

    const meld = bus.publish({ type: 'meld_declared', playerId: 3, meldType: 'kan' });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(meld);
    expect(enqueue.mock.calls[0][0]).toMatchObject({ type: 'meld_declared', playerId: 3, meldType: 'kan' });
    consumer.dispose();
  });
});
