import { describe, expect, it } from 'vitest';
import { canChi, executeChi, getChiOptions } from './chiChecker';
import { createInitialGameState, discardTile } from './engine';
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
            drawnTile: null,
            calls: [],
          }
        : player,
    ),
  };
}

function discardIntoChiWindow(discardId: TileId, lowerHand: TileId[]): GameState {
  let state = createInitialGameState();
  state = setHand(state, 0, [discardId, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 27, 31, 33]);
  state = setHand(state, 1, lowerHand);
  state = setHand(state, 2, [0, 4, 8, 9, 13, 17, 18, 22, 26, 27, 29, 31, 33]);
  state = setHand(state, 3, [0, 4, 8, 9, 13, 17, 18, 22, 26, 28, 30, 31, 33]);
  state = { ...state, currentPlayer: 0, phase: 'discard' };
  return discardTile(state, 0, state.players[0].hand[0].instanceId);
}

describe('chi calls', () => {
  it('allows the lower player to chi with a left-side sequence', () => {
    const state = discardIntoChiWindow(2, [0, 1, 4, 6, 8, 10, 12, 14, 18, 20, 22, 27, 31]);
    expect(canChi(state, 1)).toBe(true);
    expect(getChiOptions(state, 0, state.pendingCall!.tile).some((option) => option.sequence?.join(',') === '0,1,2')).toBe(true);
  });

  it('allows the lower player to chi with a middle sequence', () => {
    const state = discardIntoChiWindow(1, [0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 27, 31]);
    expect(canChi(state, 1)).toBe(true);
    expect(state.pendingCall?.options.some((option) => option.sequence?.join(',') === '0,1,2')).toBe(true);
  });

  it('allows the lower player to chi with a right-side sequence', () => {
    const state = discardIntoChiWindow(0, [1, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 27, 31]);
    expect(canChi(state, 1)).toBe(true);
    expect(state.pendingCall?.options.some((option) => option.sequence?.join(',') === '0,1,2')).toBe(true);
  });

  it('handles the 7-8-9 edge correctly', () => {
    const state = discardIntoChiWindow(8, [6, 7, 1, 3, 5, 10, 12, 14, 18, 20, 22, 27, 31]);
    expect(canChi(state, 1)).toBe(true);
    expect(state.pendingCall?.options).toHaveLength(1);
    expect(state.pendingCall?.options[0].sequence).toEqual([6, 7, 8]);
  });

  it('does not allow non-lower players to chi', () => {
    const state = discardIntoChiWindow(1, [0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 27, 31]);
    expect(canChi(state, 2)).toBe(false);
    expect(canChi(state, 3)).toBe(false);
  });

  it('executeChi removes two hand tiles, removes the river tile, opens a meld, and enters discard phase', () => {
    const state = discardIntoChiWindow(1, [0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 27, 31]);
    const after = executeChi(state, 1, 0);

    expect(after.phase).toBe('discard');
    expect(after.currentPlayer).toBe(1);
    expect(after.pendingCall).toBeNull();
    expect(after.players[0].river.some((tile) => tile.id === 1)).toBe(false);
    expect(after.players[1].hand.some((tile) => tile.id === 0)).toBe(false);
    expect(after.players[1].hand.some((tile) => tile.id === 2)).toBe(false);
    expect(after.players[1].calls[0]).toMatchObject({
      type: 'chi',
      from: 0,
      opened: true,
      sequence: [0, 1, 2],
      usedTileIds: [0, 2],
    });
  });
});
