import { describe, expect, it } from 'vitest';
import type { TileDiscardedPresentationEvent } from '../../presentation/PresentationEventBus';
import { DiscardSource3DStore } from './DiscardSource3D';

const event: TileDiscardedPresentationEvent = {
  eventId: 'discard-1',
  sequence: 8,
  type: 'tile_discarded',
  playerId: 0,
  tile: { id: 4, red: true },
  riverIndex: 0,
  isRiichiDiscard: false,
};

describe('3D discard source snapshot', () => {
  it('matches player, tile, session, and next confirmed sequence exactly once', () => {
    const store = new DiscardSource3DStore();
    store.capture({
      playerId: 0,
      tileInstanceId: 'red-five',
      tile: { id: 4, red: true },
      position: [1, 2, 3],
      rotationX: Math.PI / 2,
      rotationY: 0,
      sessionKey: 'east-1',
      afterSequence: 7,
    });

    expect(store.consume(event, 'east-1')).toMatchObject({
      tileInstanceId: 'red-five',
      position: [1, 2, 3],
    });
    expect(store.hasCapture).toBe(false);
    expect(store.consume(event, 'east-1')).toBeNull();
  });

  it('clears stale snapshots instead of reusing them for another discard', () => {
    const store = new DiscardSource3DStore();
    store.capture({
      playerId: 0,
      tileInstanceId: 'stale',
      tile: { id: 4, red: true },
      position: [1, 2, 3],
      rotationX: 0,
      rotationY: 0,
      sessionKey: 'old-round',
      afterSequence: 7,
    });
    expect(store.consume(event, 'east-1')).toBeNull();
    expect(store.hasCapture).toBe(false);
  });
});
