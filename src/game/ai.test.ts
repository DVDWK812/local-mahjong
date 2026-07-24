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
    const initial = createInitialGameState();
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
});
