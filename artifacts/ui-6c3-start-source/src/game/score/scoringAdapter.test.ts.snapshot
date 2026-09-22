import { describe, expect, it } from 'vitest';
import { callToScoringMeld, callsToScoringMelds, isMenzenFromCalls } from './scoringAdapter';
import { createTile } from '../tileUtils';
import type { CallSet, TileId } from '../types';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

describe('scoringAdapter - CallSet to ScoringMeld', () => {
  it('maps chi to an open sequence', () => {
    const call: CallSet = {
      type: 'chi',
      tiles: tiles([0, 1, 2]),
      from: 0,
      opened: true,
      sequence: [0, 1, 2],
      calledTile: createTile(1, 0),
      usedTileIds: [0, 2],
    };
    expect(callToScoringMeld(call)).toMatchObject({ type: 'sequence', ids: [0, 1, 2], open: true, calledFrom: 0 });
  });

  it('maps pon to an open triplet', () => {
    const call: CallSet = { type: 'pon', tiles: tiles([5, 5, 5]), from: 2, opened: true };
    expect(callToScoringMeld(call)).toMatchObject({ type: 'triplet', open: true, calledFrom: 2 });
  });

  it('maps ankan to a closed kan and keeps menzen', () => {
    const call: CallSet = { type: 'kan', kanType: 'ankan', tiles: tiles([31, 31, 31, 31]), from: 1, opened: false };
    expect(callToScoringMeld(call)).toMatchObject({ type: 'kan', open: false, kanType: 'ankan' });
    expect(isMenzenFromCalls([call])).toBe(true);
  });

  it('maps minkan and kakan to open kan and breaks menzen', () => {
    const minkan: CallSet = { type: 'kan', kanType: 'minkan', tiles: tiles([0, 0, 0, 0]), from: 0, opened: true };
    const kakan: CallSet = { type: 'kan', kanType: 'kakan', tiles: tiles([1, 1, 1, 1]), from: 2, opened: true };
    expect(callsToScoringMelds([minkan, kakan]).map((meld) => meld.open)).toEqual([true, true]);
    expect(isMenzenFromCalls([minkan])).toBe(false);
    expect(isMenzenFromCalls([kakan])).toBe(false);
  });
});
