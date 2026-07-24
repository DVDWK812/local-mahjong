import { describe, expect, it } from 'vitest';
import { buildExhaustiveDrawResult, calculateNotenPenaltyDeltas, getTenpaiPlayersAtExhaustiveDraw, settleExhaustiveDraw } from './exhaustiveDraw';
import { createInitialGameState } from './engine';
import { createTile } from './tileUtils';
import type { CallSet, GameState, PlayerId, TileId } from './types';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[], calls: CallSet[] = []): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, hand: tiles(ids), calls, drawnTile: null } : player),
  };
}

describe('noten penalty deltas', () => {
  it('has no point changes for zero or four tenpai players', () => {
    expect(calculateNotenPenaltyDeltas([])).toEqual([0, 0, 0, 0]);
    expect(calculateNotenPenaltyDeltas([0, 1, 2, 3])).toEqual([0, 0, 0, 0]);
  });

  it('splits 3000 points for one, two, and three tenpai players', () => {
    expect(calculateNotenPenaltyDeltas([0])).toEqual([3000, -1000, -1000, -1000]);
    expect(calculateNotenPenaltyDeltas([0, 1])).toEqual([1500, 1500, -1500, -1500]);
    expect(calculateNotenPenaltyDeltas([0, 1, 2])).toEqual([1000, 1000, 1000, -3000]);
  });

  it('always sums to zero', () => {
    [[0], [0, 1], [0, 1, 2]].forEach((players) => {
      expect(calculateNotenPenaltyDeltas(players as PlayerId[]).reduce((sum, delta) => sum + delta, 0)).toBe(0);
    });
  });
});

describe('exhaustive draw tenpai detection and result', () => {
  it('detects standard, seven-pairs, thirteen-orphans, and open-hand tenpai', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [0, 0, 1, 1, 9, 9, 10, 10, 18, 18, 19, 19, 27]);
    state = setHand(state, 2, [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
    const chi: CallSet = { type: 'chi', tiles: tiles([0, 1, 2]), from: 3, opened: true, sequence: [0, 1, 2], calledTile: createTile(0, 3), usedTileIds: [1, 2] };
    state = setHand(state, 3, [3, 4, 5, 9, 10, 11, 18, 19, 20, 31], [chi]);
    expect(getTenpaiPlayersAtExhaustiveDraw(state)).toEqual([0, 1, 2, 3]);
  });

  it('builds exhaustive draw result with dealer continuation and carry-over metadata', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    state = setHand(state, 2, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    state = setHand(state, 3, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    const result = buildExhaustiveDrawResult(state);
    expect(result.tenpaiPlayers).toEqual([0]);
    expect(result.pointDeltas).toEqual([3000, -1000, -1000, -1000]);
    expect(result.dealerContinues).toBe(true);
    expect(result.honbaIncrement).toBe(1);
    expect(result.riichiSticksCarryOver).toBe(true);
  });

  it('settles scores and rotates dealer when dealer is not tenpai', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    state = setHand(state, 1, [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    const after = settleExhaustiveDraw(state);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('exhaustive-draw');
    if (!after.result || after.result.type !== 'exhaustive-draw') throw new Error('Expected exhaustive draw result');
    expect(after.result.dealerContinues).toBe(false);
    expect(after.honba).toBe(state.honba + 1);
    expect(after.players.map((player) => player.score)).toEqual([24000, 28000, 24000, 24000]);
  });
});
