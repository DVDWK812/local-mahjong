import { describe, expect, it } from 'vitest';
import { discardTile, drawTile, createInitialGameState } from './engine';
import { buildRonResult, canRon, canTsumo } from './winChecker';
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

function setPlayerHand(state: GameState, playerId: PlayerId, ids: TileId[], drawnIndex: number | null = null): GameState {
  const hand = tiles(ids);
  const players = state.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          hand,
          drawnTile: drawnIndex === null ? null : hand[drawnIndex],
          calls: [],
          riichi: false,
        }
      : player,
  );
  return { ...state, players };
}

describe('winChecker', () => {
  it('canTsumo returns a winning result for a closed tsumo hand', () => {
    const state = setPlayerHand(
      createInitialGameState(),
      0,
      [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14, 14],
      13,
    );

    const result = canTsumo(state, 0);
    expect(result).not.toBeNull();
    expect(result?.winner).toBe(0);
    expect(result?.winType).toBe('tsumo');
    expect(result?.han).toBeGreaterThan(0);
  });

  it('canRon returns a ron result for a player waiting on the discard', () => {
    const discarded = createTile(14, 0);
    const state = setPlayerHand(
      createInitialGameState(),
      1,
      [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14],
    );

    const results = canRon(state, 0, discarded);
    expect(results.map((result) => result.winner)).toContain(1);
    expect(results[0].winType).toBe('ron');
  });

  it('canRon collects multiple ron winners in turn order from the discarder', () => {
    const discarded = createTile(14, 0);
    let state = createInitialGameState();
    state = setPlayerHand(state, 1, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = setPlayerHand(state, 2, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = setPlayerHand(state, 3, [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 5]);

    const results = canRon(state, 0, discarded);
    expect(results.map((result) => result.winner)).toEqual([1, 2]);
  });

  it('allows multiple ron winners when head-bump is disabled', () => {
    const discarded = createTile(14, 0);
    let state = createInitialGameState();
    state = setPlayerHand(state, 1, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = setPlayerHand(state, 2, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = { ...state, matchRuleConfig: { useOka: false } };

    const result = buildRonResult(state, 0, discarded);
    expect(result?.type).toBe('ron');
    if (!result || result.type !== 'ron') throw new Error('Expected ron result');
    expect(result.winners.map((winner) => winner.winner)).toEqual([1, 2]);
  });

  it('keeps only the nearest ron winner when head-bump is enabled', () => {
    const discarded = createTile(14, 0);
    let state = createInitialGameState();
    state = setPlayerHand(state, 1, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = setPlayerHand(state, 2, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = { ...state, matchRuleConfig: { useOka: true } };

    const result = buildRonResult(state, 0, discarded);
    expect(result?.type).toBe('ron');
    if (!result || result.type !== 'ron') throw new Error('Expected ron result');
    expect(result.winners.map((winner) => winner.winner)).toEqual([1]);
  });
});

describe('engine win flow', () => {
  it('drawTile enters round-ended and stores a tsumo result when the drawn tile wins', () => {
    const draw = createTile(14, 1);
    let state = createInitialGameState();
    state = setPlayerHand(state, 0, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = {
      ...state,
      currentPlayer: 0,
      phase: 'draw',
      wall: [draw],
    };

    const after = drawTile(state);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('tsumo');
    if (!after.result || after.result.type !== 'tsumo') throw new Error('Expected tsumo result');
    expect(after.result.winners[0].winner).toBe(0);
    expect(after.result?.pointDeltas.some((delta) => delta !== 0)).toBe(true);
  });

  it('discardTile enters round-ended and stores ron winners when another player can ron', () => {
    let state = createInitialGameState();
    state = setPlayerHand(state, 0, [14, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27]);
    state = setPlayerHand(state, 1, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14]);
    state = {
      ...state,
      currentPlayer: 0,
      phase: 'discard',
    };

    const discard = state.players[0].hand[0];
    const after = discardTile(state, 0, discard.instanceId);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('ron');
    if (!after.result || after.result.type !== 'ron') throw new Error('Expected ron result');
    expect(after.result.winners.map((winner) => winner.winner)).toContain(1);
  });
});
