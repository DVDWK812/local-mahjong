import { describe, expect, it } from 'vitest';
import { advanceAIAction } from './ai';
import { createInitialGameState, discardTile, drawTile } from './engine';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, TileId } from './types';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[], drawnIndex: number | null = null): GameState {
  const hand = tiles(ids);
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, hand, drawnTile: drawnIndex === null ? null : hand[drawnIndex], calls: [], riichi: false, riichiState: null } : player),
  };
}

describe('exhaustive draw integration', () => {
  it('last tile tsumo wins before exhaustive draw settlement', () => {
    const draw = createTile(14, 0);
    let state = createInitialGameState();
    state = setHand(state, 0, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = { ...state, currentPlayer: 0, phase: 'draw', wall: [draw] };
    const after = drawTile(state);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('tsumo');
  });

  it('last discard ron and houtei win before exhaustive draw settlement', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [14, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27]);
    state = setHand(state, 1, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = {
      ...state,
      currentPlayer: 0,
      phase: 'discard',
      wall: [],
      lastDrawSource: 'live-wall',
    };
    const after = discardTile(state, 0, state.players[0].hand[0].instanceId);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('ron');
    if (!after.result || after.result.type !== 'ron') throw new Error('Expected ron result');
    expect(after.result.winners[0].yaku.some((yaku) => yaku.han > 0)).toBe(true);
  });

  it('settles exhaustive draw after the last discard when nobody wins', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26]);
    state = setHand(state, 1, [9, 11, 13, 15, 17, 18, 20, 22, 24, 26, 27, 28, 29]);
    state = setHand(state, 2, [9, 11, 13, 15, 17, 18, 20, 22, 24, 26, 27, 28, 29]);
    state = setHand(state, 3, [9, 11, 13, 15, 17, 18, 20, 22, 24, 26, 27, 28, 29]);
    state = {
      ...state,
      currentPlayer: 0,
      phase: 'discard',
      wall: [],
      lastDrawSource: 'live-wall',
    };
    const after = discardTile(state, 0, state.players[0].hand[0].instanceId);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('exhaustive-draw');
  });

  it('AI stops after exhaustive draw result', () => {
    const state = {
      ...createInitialGameState(),
      currentPlayer: 1 as PlayerId,
      phase: 'round-ended' as const,
      result: {
        type: 'exhaustive-draw' as const,
        tenpaiPlayers: [],
        notenPlayers: [0, 1, 2, 3] as PlayerId[],
        scoreDeltas: [0, 0, 0, 0],
        pointDeltas: [0, 0, 0, 0],
        dealerContinues: false,
        honbaIncrement: 1,
        riichiSticksCarryOver: true,
      },
    };
    expect(advanceAIAction(state)).toBe(state);
  });
});
