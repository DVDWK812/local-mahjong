import { describe, expect, it } from 'vitest';
import { canDeclareRiichi, createInitialGameState, declareRiichi, getRiichiDiscardCandidates } from './engine';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, TileId } from './types';

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  const hand = ids.map((id, index) => createTile(id, index % 4));
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            hand,
            drawnTile: hand[hand.length - 1],
            calls: [],
            riichi: false,
            riichiState: null,
          }
        : player,
    ),
    currentPlayer: playerId,
    phase: 'discard',
  };
}

describe('riichi flow', () => {
  it('allows riichi for a closed hand that can discard into tenpai with at least 1000 points', () => {
    const state = setHand(createInitialGameState(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    expect(canDeclareRiichi(state, 0)).toBe(true);
  });

  it('rejects riichi for an open hand', () => {
    const state = setHand(createInitialGameState(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const openState = {
      ...state,
      players: state.players.map((player) =>
        player.id === 0
          ? {
              ...player,
              calls: [{ type: 'pon' as const, tiles: [createTile(27, 0), createTile(27, 1), createTile(27, 2)], from: 1 as PlayerId, opened: true }],
            }
          : player,
      ),
    };
    expect(canDeclareRiichi(openState, 0)).toBe(false);
  });

  it('rejects riichi below 1000 points', () => {
    const state = setHand(createInitialGameState(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const poorState = {
      ...state,
      players: state.players.map((player) => (player.id === 0 ? { ...player, score: 900 } : player)),
    };
    expect(canDeclareRiichi(poorState, 0)).toBe(false);
  });

  it('rejects riichi if already declared', () => {
    const ready = setHand(createInitialGameState(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const state = declareRiichi(ready, 0, getRiichiDiscardCandidates(ready, 0)[0].instanceId);
    expect(canDeclareRiichi(state, 0)).toBe(false);
  });

  it('declaring riichi pays 1000 points, adds a stick, and enables ippatsu', () => {
    const state = setHand(createInitialGameState(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const candidate = getRiichiDiscardCandidates(state, 0)[0];
    const after = declareRiichi(state, 0, candidate.instanceId);
    expect(after.players[0].score).toBe(state.players[0].score - 1000);
    expect(after.riichiSticks).toBe(state.riichiSticks + 1);
    expect(after.players[0].riichi).toBe(true);
    expect(after.players[0].riichiState?.ippatsuAvailable).toBe(true);
    expect(after.players[0].riichiState?.riichiDiscardInstanceId).toBe(candidate.instanceId);
  });
});
