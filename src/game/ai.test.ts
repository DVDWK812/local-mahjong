import { describe, expect, it } from 'vitest';
import { advanceAIAction, getVisibleCountsForPlayer, isAIPlayer, selectAIDiscardTile } from './ai';
import { createInitialGameState, discardTile } from './engine';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, TileId } from './types';

function withAIToDraw(state: GameState, playerId: PlayerId = 1): GameState {
  return {
    ...state,
    currentPlayer: playerId,
    phase: 'draw',
  };
}

function withAIToDiscard(state: GameState, playerId: PlayerId = 1): GameState {
  return {
    ...state,
    currentPlayer: playerId,
    phase: 'discard',
  };
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  const players = state.players.map((player) =>
    player.id === playerId
      ? { ...player, hand: ids.map((id, index) => createTile(id, index % 4)), drawnTile: null }
      : player,
  );
  return { ...state, players };
}

function discardIntoCallWindow(discardId: TileId, aiHand: TileId[], aiPlayer: PlayerId = 1): GameState {
  let state = createInitialGameState();
  state = setHand(state, 0, [discardId, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 27, 31, 33]);
  state = setHand(state, aiPlayer, aiHand);
  state = setHand(state, 2, [0, 4, 8, 9, 13, 17, 18, 22, 26, 27, 29, 31, 33]);
  state = setHand(state, 3, [0, 4, 8, 9, 13, 17, 18, 22, 26, 28, 30, 31, 33]);
  state = { ...state, currentPlayer: 0, phase: 'discard' };
  return discardTile(state, 0, state.players[0].hand[0].instanceId);
}

describe('AI auto play', () => {
  it('identifies Player 2-4 as AI and Player 1 as human', () => {
    expect(isAIPlayer(0)).toBe(false);
    expect(isAIPlayer(1)).toBe(true);
    expect(isAIPlayer(2)).toBe(true);
    expect(isAIPlayer(3)).toBe(true);
  });

  it('builds visible counts from public tiles, dora indicators, and AI own hand', () => {
    const state = createInitialGameState();
    const counts = getVisibleCountsForPlayer(state, 1);
    const ownHandTotal = state.players[1].hand.length;
    const publicTotal = state.players.reduce((sum, player) => sum + player.river.length, 0) + state.doraIndicators.length;
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(ownHandTotal + publicTotal);
  });

  it('selects a discard from the AI hand', () => {
    const state = setHand(withAIToDiscard(createInitialGameState(), 1), 1, [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27, 31]);
    const selected = selectAIDiscardTile(state, 1, () => 0);
    expect(selected).not.toBeNull();
    expect(state.players[1].hand.some((tile) => tile.instanceId === selected?.instanceId)).toBe(true);
  });

  it('draws one tile for AI without mutating previous state', () => {
    const before = withAIToDraw(createInitialGameState(), 1);
    const previousWallLength = before.wall.length;
    const previousHandLength = before.players[1].hand.length;
    const after = advanceAIAction(before, () => 0);

    expect(after).not.toBe(before);
    expect(after.wall.length).toBe(previousWallLength - 1);
    expect(after.players[1].hand.length).toBe(previousHandLength + 1);
    expect(after.phase).toBe('discard');
    expect(before.wall.length).toBe(previousWallLength);
    expect(before.players[1].hand.length).toBe(previousHandLength);
  });

  it('discards one tile for AI and advances to the next player', () => {
    const base = withAIToDiscard(createInitialGameState(), 1);
    const before = [
      [0, 1, 3, 4, 6, 7, 9, 11, 13, 15, 18, 20, 22],
      [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6],
      [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25],
      [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26],
    ].reduce((state, ids, playerId) => setHand(state, playerId as PlayerId, ids as TileId[]), base);
    const previousHandLength = before.players[1].hand.length;
    const after = advanceAIAction(before, () => 0);

    expect(after.players[1].hand.length).toBe(previousHandLength - 1);
    expect(after.players[1].river.length).toBe(1);
    expect(after.currentPlayer).toBe(2);
    expect(['draw', 'call-window']).toContain(after.phase);
  });

  it('returns to the human draw phase after Player 1 discards and all AIs act', () => {
    const initial = [
      [33, 0, 1, 3, 4, 6, 7, 9, 11, 13, 15, 18, 20, 22],
      [0, 2, 5, 8, 10, 12, 14, 16, 19, 21, 23, 25, 27],
      [1, 3, 6, 9, 11, 13, 15, 17, 18, 20, 22, 24, 28],
      [2, 4, 7, 10, 12, 14, 16, 19, 21, 23, 25, 26, 29],
    ].reduce((state, ids, playerId) => setHand(state, playerId as PlayerId, ids as TileId[]), createInitialGameState());
    const playerDiscard = initial.players[0].hand[0];
    let state = discardTile(initial, 0, playerDiscard.instanceId);

    for (let i = 0; i < 12 && isAIPlayer(state.currentPlayer); i += 1) {
      state = advanceAIAction(state, () => 0);
    }

    expect(state.currentPlayer).toBe(0);
    expect(['draw', 'call-window']).toContain(state.phase);
    expect(state.players[1].river.length).toBe(1);
    expect(state.players[2].river.length).toBe(1);
    expect(state.players[3].river.length).toBe(1);
  });

  it('settles exhaustive draw when an AI tries to draw from an empty wall', () => {
    const before = {
      ...withAIToDraw(createInitialGameState(), 1),
      wall: [],
    };
    const after = advanceAIAction(before, () => 0);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('exhaustive-draw');
  });

  it('AI can pon yakuhai and enters discard phase with a meld', () => {
    const callWindow = discardIntoCallWindow(31, [31, 31, 1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22]);
    const after = advanceAIAction(callWindow, () => 0);
    expect(after.currentPlayer).toBe(1);
    expect(after.phase).toBe('discard');
    expect(after.players[1].calls[0]).toMatchObject({ type: 'pon', opened: true, from: 0 });
    expect(after.players[0].river[0]).toMatchObject({ id: 31, claimed: true });
  });

  it('AI can chi when the call lowers shanten', () => {
    const callWindow = discardIntoCallWindow(1, [0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 27, 31]);
    const after = advanceAIAction(callWindow, () => 0);
    expect(after.currentPlayer).toBe(1);
    expect(after.phase).toBe('discard');
    expect(after.players[1].calls[0]).toMatchObject({ type: 'chi', opened: true, sequence: [0, 1, 2] });
  });

  it('AI can execute legal minkan for yakuhai', () => {
    const callWindow = discardIntoCallWindow(31, [31, 31, 31, 1, 3, 5, 7, 9, 11, 13, 18, 20, 22]);
    const after = advanceAIAction(callWindow, () => 0);
    expect(after.currentPlayer).toBe(1);
    expect(after.phase).toBe('discard');
    expect(after.players[1].calls[0]).toMatchObject({ type: 'kan', kanType: 'minkan', opened: true, from: 0 });
    expect(after.players[1].drawnTile).not.toBeNull();
  });

  it('AI does not perform illegal chi from a non-lower seat and passes normally', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 27, 31, 33]);
    state = setHand(state, 1, [4, 6, 8, 10, 12, 14, 18, 20, 22, 24, 27, 31, 33]);
    state = setHand(state, 2, [0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 27, 31]);
    state = { ...state, currentPlayer: 0, phase: 'discard' };
    const afterDiscard = discardTile(state, 0, state.players[0].hand[0].instanceId);
    const after = advanceAIAction(afterDiscard, () => 0);
    expect(after.players[2].calls).toHaveLength(0);
    expect(after.phase).toBe('discard');
    expect(after.currentPlayer).toBe(1);
  });

  it('riichi AI does not chi, pon, or minkan from call-window', () => {
    const callWindow = discardIntoCallWindow(31, [31, 31, 31, 1, 3, 5, 7, 9, 11, 13, 18, 20, 22]);
    const riichiWindow = {
      ...callWindow,
      players: callWindow.players.map((player) => player.id === 1
        ? { ...player, riichi: true, riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' as const } }
        : player),
      pendingCall: callWindow.pendingCall
        ? { ...callWindow.pendingCall, options: callWindow.pendingCall.options.filter((option) => option.player !== 1) }
        : null,
    };
    const after = advanceAIAction(riichiWindow, () => 0);
    expect(after.players[1].calls).toHaveLength(0);
    expect(after.currentPlayer).toBe(1);
    expect(after.phase).toBe('draw');
  });

  it('AI can discard after calling a meld', () => {
    const called = advanceAIAction(discardIntoCallWindow(31, [31, 31, 1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22]), () => 0);
    const afterDiscard = advanceAIAction(called, () => 0);
    expect(afterDiscard.players[1].river.length).toBe(1);
    expect(afterDiscard.currentPlayer).toBe(2);
    expect(['draw', 'call-window']).toContain(afterDiscard.phase);
  });
});
