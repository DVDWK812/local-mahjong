import { describe, expect, it } from 'vitest';
import { advanceAIAction } from './ai';
import { createInitialGameState, discardTile } from './engine';
import { buildRonResult } from './winChecker';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, TileId } from './types';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, hand: tiles(ids), river: [], calls: [], riichi: false, riichiState: null } : player),
  };
}

function tripleRonState(mode: 'allow' | 'abortive-draw'): GameState {
  let state: GameState = { ...createInitialGameState(), ruleConfig: { tripleRonMode: mode } };
  state = setHand(state, 1, [1, 2, 3, 3, 4, 5, 10, 11, 12, 19, 20, 21, 14]);
  state = setHand(state, 2, [1, 2, 3, 3, 4, 5, 10, 11, 12, 19, 20, 21, 14]);
  state = setHand(state, 3, [1, 2, 3, 3, 4, 5, 10, 11, 12, 19, 20, 21, 14]);
  return state;
}

describe('abortive draw integration', () => {
  it('allows triple ron when configured to allow', () => {
    const result = buildRonResult(tripleRonState('allow'), 0, createTile(14, 0));
    expect(result?.type).toBe('ron');
    if (!result || result.type !== 'ron') throw new Error('Expected ron result');
    expect(result.winners).toHaveLength(3);
  });

  it('aborts on triple ron when configured', () => {
    const result = buildRonResult(tripleRonState('abortive-draw'), 0, createTile(14, 0));
    expect(result?.type).toBe('abortive-draw');
    if (!result || result.type !== 'abortive-draw') throw new Error('Expected abortive draw result');
    expect(result.reason).toBe('sanchahou');
    expect(result.pointDeltas).toEqual([0, 0, 0, 0]);
  });

  it('does not abort on double ron in abortive mode', () => {
    const state = setHand(tripleRonState('abortive-draw'), 3, [0, 2, 4, 6, 8, 10, 12, 18, 20, 22, 24, 26, 31]);
    const result = buildRonResult(state, 0, createTile(14, 0));
    expect(result?.type).toBe('ron');
    if (!result || result.type !== 'ron') throw new Error('Expected ron result');
    expect(result.winners).toHaveLength(2);
  });

  it('fourth identical wind discard aborts only after ron has priority', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      currentPlayer: 3,
      phase: 'discard',
      players: state.players.map((player) => ({
        ...player,
        hand: player.id === 3
          ? [createTile(27, 0), ...tiles([1, 3, 5, 7, 9, 11, 13, 18, 20, 22, 24, 26, 31])]
          : tiles([1, 3, 5, 7, 9, 11, 13, 18, 20, 22, 24, 26, 31]),
        river: player.id < 3 ? [createTile(27, player.id)] : [],
        calls: [],
      })),
    };
    const after = discardTile(state, 3, state.players[3].hand[0].instanceId);
    expect(after.result?.type).toBe('abortive-draw');
    if (!after.result || after.result.type !== 'abortive-draw') throw new Error('Expected abortive draw result');
    expect(after.result.reason).toBe('suufon-renda');
  });

  it('AI stops after abortive draw', () => {
    const state = {
      ...createInitialGameState(),
      currentPlayer: 1 as PlayerId,
      phase: 'round-ended' as const,
      result: {
        type: 'abortive-draw' as const,
        reason: 'kyuushu-kyuuhai' as const,
        declaredBy: 1 as PlayerId,
        dealerContinues: true,
        honbaIncrement: 1,
        riichiSticksCarryOver: true,
        scoreDeltas: [0, 0, 0, 0],
        pointDeltas: [0, 0, 0, 0],
      },
    };
    expect(advanceAIAction(state)).toBe(state);
  });
});
