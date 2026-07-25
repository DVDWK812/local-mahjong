import { describe, expect, it } from 'vitest';
import { executePon } from './callChecker';
import { canAnkan, canChankan, canKakan, canMinkan, executeKan } from './kanChecker';
import { createInitialGameState, discardTile } from './engine';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, Tile, TileId } from './types';

function tiles(ids: TileId[]): Tile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copyIndex = seen.get(id) ?? 0;
    seen.set(id, copyIndex + 1);
    return createTile(id, copyIndex);
  });
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  const hand = tiles(ids);
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            hand,
            drawnTile: hand[hand.length - 1] ?? null,
            calls: [],
            riichi: false,
            riichiState: null,
          }
        : player,
    ),
  };
}

function withSafeOtherHands(state: GameState): GameState {
  let next = state;
  next = setHand(next, 2, [0, 4, 8, 9, 13, 17, 18, 22, 26, 27, 29, 31, 33]);
  next = setHand(next, 3, [0, 4, 8, 9, 13, 17, 18, 22, 26, 28, 30, 31, 33]);
  return next;
}

describe('kan calls', () => {
  it('executes ankan, adds a concealed kan meld, adds dora, and draws rinshan', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [0, 0, 0, 0, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = { ...state, currentPlayer: 0, phase: 'discard', deadWall: [createTile(32, 0), ...state.deadWall.slice(1)] };
    const previousDora = state.doraIndicators.length;
    const previousDeadWall = state.deadWall.length;

    expect(canAnkan(state, 0, 0)).toBe(true);
    const after = executeKan(state, 0, 'ankan', 0);

    expect(after.phase).toBe('discard');
    expect(after.players[0].calls[0]).toMatchObject({ type: 'kan', kanType: 'ankan', opened: false });
    expect(after.players[0].hand.filter((tile) => tile.id === 0)).toHaveLength(0);
    expect(after.players[0].hand).toHaveLength(11);
    expect(after.players[0].drawnTile).not.toBeNull();
    expect(after.doraIndicators).toHaveLength(previousDora + 1);
    expect(after.deadWall).toHaveLength(previousDeadWall - 1);
    expect(after.kanState).toMatchObject({ type: 'ankan', player: 0, tile: 0, doraIndicatorCount: previousDora + 1 });
  });

  it('enters call-window with minkan option after a discard that another player can kan', () => {
    let state = createInitialGameState();
    state = withSafeOtherHands(state);
    state = setHand(state, 0, [27, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [27, 27, 27, 1, 3, 5, 7, 9, 11, 13, 18, 20, 22]);
    state = { ...state, currentPlayer: 0, phase: 'discard', deadWall: [createTile(32, 0), ...state.deadWall.slice(1)] };

    const afterDiscard = discardTile(state, 0, state.players[0].hand[0].instanceId);
    expect(afterDiscard.phase).toBe('call-window');
    expect(afterDiscard.pendingCall?.options.some((option) => option.type === 'kan' && option.kanType === 'minkan' && option.player === 1)).toBe(true);
    expect(canMinkan(afterDiscard, 1)).toBe(true);
  });

  it('executes minkan, removes three hand tiles, keeps the claimed river tile, adds dora, and draws rinshan', () => {
    let state = createInitialGameState();
    state = withSafeOtherHands(state);
    state = setHand(state, 0, [27, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [27, 27, 27, 1, 3, 5, 7, 9, 11, 13, 18, 20, 22]);
    state = { ...state, currentPlayer: 0, phase: 'discard', deadWall: [createTile(32, 0), ...state.deadWall.slice(1)] };
    const callWindow = discardTile(state, 0, state.players[0].hand[0].instanceId);
    const previousDora = callWindow.doraIndicators.length;

    const after = executeKan(callWindow, 1, 'minkan');
    expect(after.phase).toBe('discard');
    expect(after.currentPlayer).toBe(1);
    expect(after.players[0].river.some((tile) => tile.id === 27)).toBe(true);
    expect(after.players[0].river[0]).toMatchObject({ id: 27, claimed: true, claimedBy: 1 });
    expect(after.players[1].hand.filter((tile) => tile.id === 27)).toHaveLength(0);
    expect(after.players[1].calls[0]).toMatchObject({ type: 'kan', kanType: 'minkan', opened: true, from: 0 });
    expect(after.players[1].drawnTile).not.toBeNull();
    expect(after.doraIndicators).toHaveLength(previousDora + 1);
  });

  it('executes kakan by upgrading an existing pon, adds dora, and draws rinshan', () => {
    let state = createInitialGameState();
    state = withSafeOtherHands(state);
    state = setHand(state, 0, [27, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 1, [27, 27, 1, 3, 5, 7, 9, 11, 13, 18, 20, 22, 24]);
    state = { ...state, currentPlayer: 0, phase: 'discard' };
    const ponWindow = discardTile(state, 0, state.players[0].hand[0].instanceId);
    const ponState = executePon(ponWindow, 1);
    const fourthTile = createTile(27, 3);
    const readyForKakan = {
      ...ponState,
      currentPlayer: 1 as PlayerId,
      phase: 'discard' as const,
      players: ponState.players.map((player) =>
        player.id === 1
          ? {
              ...player,
              hand: [...player.hand, fourthTile],
              drawnTile: fourthTile,
            }
          : player,
      ),
    };
    const previousDora = readyForKakan.doraIndicators.length;

    expect(canKakan(readyForKakan, 1, 27)).toBe(true);
    const after = executeKan(readyForKakan, 1, 'kakan', 27);
    expect(after.players[1].calls[0]).toMatchObject({ type: 'kan', kanType: 'kakan', opened: true });
    expect(after.players[1].calls[0].tiles).toHaveLength(4);
    expect(after.players[1].drawnTile).not.toBeNull();
    expect(after.doraIndicators).toHaveLength(previousDora + 1);
  });

  it('keeps a chankan interface as a TODO stub', () => {
    expect(canChankan()).toBe(false);
  });
});
