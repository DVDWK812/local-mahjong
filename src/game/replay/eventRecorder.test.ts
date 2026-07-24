import { describe, expect, it } from 'vitest';
import { createEventFactory, tileSnapshot } from './eventRecorder';
import { createTile } from '../tileUtils';

describe('eventRecorder', () => {
  it('records sequential unique events and tile instance snapshots', () => {
    const factory = createEventFactory('r1');
    const tile = { ...createTile(4, 2), red: true };
    const draw = factory({ type: 'tile-drawn', actor: 0, tile: tileSnapshot(tile) });
    const discard = factory({ type: 'tile-discarded', actor: 0, tile: tileSnapshot(tile) });
    expect(draw.sequence).toBe(0);
    expect(discard.sequence).toBe(1);
    expect(draw.eventId).not.toBe(discard.eventId);
    expect(draw.type === 'tile-drawn' ? draw.tile.instanceId : '').toBe(tile.instanceId);
    expect(draw.type === 'tile-drawn' ? draw.tile.red : false).toBe(true);
  });
});
