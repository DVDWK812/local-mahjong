import { describe, expect, it } from 'vitest';
import { canPon, executePon, passCall } from './callChecker';
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

describe('pon calls', () => {
  it('enters call-window after a discard that another player can pon', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [27, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [27, 27, 1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22]);
    state = { ...state, currentPlayer: 0, phase: 'discard' };

    const after = discardTile(state, 0, state.players[0].hand[0].instanceId);
    expect(after.phase).toBe('call-window');
    expect(after.pendingCall?.options).toContainEqual({ type: 'pon', player: 1 });
    expect(canPon(after, 1)).toBe(true);
  });

  it('executePon removes two matching hand tiles, removes the river tile, and opens a meld', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [27, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [27, 27, 1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22]);
    state = { ...state, currentPlayer: 0, phase: 'discard' };

    const callWindow = discardTile(state, 0, state.players[0].hand[0].instanceId);
    const after = executePon(callWindow, 1);

    expect(after.phase).toBe('discard');
    expect(after.currentPlayer).toBe(1);
    expect(after.pendingCall).toBeNull();
    expect(after.players[0].river.some((tile) => tile.id === 27)).toBe(false);
    expect(after.players[1].hand.filter((tile) => tile.id === 27)).toHaveLength(0);
    expect(after.players[1].calls[0]).toMatchObject({ type: 'pon', from: 0, opened: true });
    expect(after.players[1].calls[0].tiles).toHaveLength(3);
  });

  it('passCall resumes the normal draw flow', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [27, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [27, 27, 1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22]);
    state = { ...state, currentPlayer: 0, phase: 'discard' };

    const callWindow = discardTile(state, 0, state.players[0].hand[0].instanceId);
    const after = passCall(callWindow);
    expect(after.phase).toBe('draw');
    expect(after.currentPlayer).toBe(1);
    expect(after.pendingCall).toBeNull();
  });

  it('executePon clears ippatsu for all riichi players', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [27, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [27, 27, 1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22]);
    state = {
      ...state,
      currentPlayer: 0,
      phase: 'discard',
      players: state.players.map((player) =>
        player.id === 2
          ? { ...player, riichi: true, riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' as const } }
          : player,
      ),
    };

    const callWindow = discardTile(state, 0, state.players[0].hand[0].instanceId);
    const after = executePon(callWindow, 1);
    expect(after.players[2].riichiState?.ippatsuAvailable).toBe(false);
  });
});
