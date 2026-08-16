import { describe, expect, it } from 'vitest';
import type { TileDiscardedPresentationEvent } from '../PresentationEventBus';
import { DiscardSourceSnapshotStore, resolveDiscardMotion } from './DiscardSourceSnapshot';

const event: TileDiscardedPresentationEvent = {
  eventId: 'discard-1',
  sequence: 1,
  type: 'tile_discarded',
  playerId: 0,
  tile: { id: 4, red: false },
  riverIndex: 0,
  isRiichiDiscard: false,
};

const freshness = { sessionKey: 'east-0-0-single', confirmedTurn: 2 };

describe('DiscardSourceSnapshotStore', () => {
  it('local discard 一次性消费被点击手牌 rect，并形成 hand tile → river 的不同端点', () => {
    const store = new DiscardSourceSnapshotStore();
    const sourceTileRect = { left: 120, top: 620, width: 40, height: 60 };
    store.capture({
      playerId: 0,
      tileInstanceId: 'local-tile-7',
      tile: event.tile,
      sourceTileRect,
      ...freshness,
    });

    const snapshot = store.consume(event, freshness);
    const motion = resolveDiscardMotion(
      snapshot?.sourceTileRect ?? { left: 80, top: 600, width: 500, height: 70 },
      { left: 590, top: 300, width: 40, height: 60 },
      { left: 0, top: 0, width: 1280, height: 720 },
    );

    expect(snapshot?.tileInstanceId).toBe('local-tile-7');
    expect(motion.source).toEqual({ x: 140, y: 650 });
    expect(motion.destination).toEqual({ x: 610, y: 330 });
    expect(motion.source).not.toEqual(motion.destination);
    expect(store.hasSnapshot).toBe(false);
    expect(store.consume(event, freshness)).toBeNull();
  });

  it('player/tile/session/turn 任一不匹配时拒绝并立即清除旧 snapshot', () => {
    const store = new DiscardSourceSnapshotStore();
    store.capture({
      playerId: 0,
      tileInstanceId: 'stale',
      tile: event.tile,
      sourceTileRect: { left: 1, top: 2, width: 3, height: 4 },
      ...freshness,
    });

    expect(store.consume(event, { ...freshness, confirmedTurn: 3 })).toBeNull();
    expect(store.hasSnapshot).toBe(false);
    expect(store.consume(event, freshness)).toBeNull();
  });

  it('AI 无 clicked snapshot 时 source 只使用 hand-area anchor，绝不回退到 river target', () => {
    const handAreaRect = { left: 1040, top: 180, width: 70, height: 360 };
    const riverRect = { left: 780, top: 320, width: 40, height: 60 };
    const motion = resolveDiscardMotion(handAreaRect, riverRect, { left: 0, top: 0, width: 1280, height: 720 });

    expect(motion.source).toEqual({ x: 1075, y: 360 });
    expect(motion.destination).toEqual({ x: 800, y: 350 });
    expect(motion.source).not.toEqual(motion.destination);
  });

  it('failure/unmount cleanup handle 只清理对应 generation，不会误删更新 snapshot', () => {
    const store = new DiscardSourceSnapshotStore();
    const clearOld = store.capture({
      playerId: 0,
      tileInstanceId: 'old',
      tile: event.tile,
      sourceTileRect: { left: 1, top: 1, width: 1, height: 1 },
      ...freshness,
    });
    store.capture({
      playerId: 0,
      tileInstanceId: 'new',
      tile: event.tile,
      sourceTileRect: { left: 2, top: 2, width: 2, height: 2 },
      ...freshness,
    });

    clearOld();
    expect(store.hasSnapshot).toBe(true);
    store.clear();
    expect(store.hasSnapshot).toBe(false);
  });
});
