import { describe, expect, it } from 'vitest';
import { callToMeldDisplayModel, relativeCallSource } from './meldDisplayAdapter';
import { createTile } from './tileUtils';
import type { CallSet, TileId } from './types';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index));
}

describe('meldDisplayAdapter', () => {
  it('calculates relative call source by seat order', () => {
    expect(relativeCallSource(0, 1)).toBe('left');
    expect(relativeCallSource(0, 2)).toBe('opposite');
    expect(relativeCallSource(0, 3)).toBe('right');
  });

  it('places pon sideways tile at left, middle, or right by source', () => {
    const base: CallSet = { type: 'pon', tiles: tiles([5, 5, 5]), from: 1, opened: true, calledTile: createTile(5, 9) };
    expect(callToMeldDisplayModel(base, 0).tiles.map((tile) => tile.sideways)).toEqual([true, false, false]);
    expect(callToMeldDisplayModel({ ...base, from: 2 }, 0).tiles.map((tile) => tile.sideways)).toEqual([false, true, false]);
    expect(callToMeldDisplayModel({ ...base, from: 3 }, 0).tiles.map((tile) => tile.sideways)).toEqual([false, false, true]);
  });

  it('shows ankan with both ends face down and no sideways tile', () => {
    const model = callToMeldDisplayModel({ type: 'kan', kanType: 'ankan', tiles: tiles([31, 31, 31, 31]), from: 0, opened: false }, 0);
    expect(model.callType).toBe('ankan');
    expect(model.calledFrom).toBeUndefined();
    expect(model.sourceRelation).toBe('self');
    expect(model.tiles.map((tile) => tile.faceDown)).toEqual([true, false, false, true]);
    expect(model.tiles.map((tile) => tile.sideways)).toEqual([false, false, false, false]);
    expect(model.tiles.map((tile) => tile.called)).toEqual([false, false, false, false]);
  });

  it('keeps kakan as one meld with the fourth tile stacked', () => {
    const model = callToMeldDisplayModel({ type: 'kan', kanType: 'kakan', tiles: tiles([2, 2, 2, 2]), from: 2, opened: true, calledTile: createTile(2, 1) }, 0);
    expect(model.callType).toBe('kakan');
    expect(model.calledFrom).toBe(2);
    expect(model.tiles).toHaveLength(4);
    expect(model.tiles[3].stacked).toBe(true);
  });
});
