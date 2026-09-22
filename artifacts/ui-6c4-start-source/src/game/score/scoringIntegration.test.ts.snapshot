import { describe, expect, it } from 'vitest';
import { evaluateWin, findWinningShapes, type WinContext } from '../scoreCalculator';
import { createTile } from '../tileUtils';
import type { GameState, PlayerId, TileId } from '../types';
import { canRon } from '../winChecker';
import { createInitialGameState } from '../engine';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

function ctx(winTile: TileId, overrides: Partial<WinContext> = {}): WinContext {
  return {
    winTile: createTile(winTile, 0),
    isTsumo: false,
    isRiichi: false,
    isIppatsu: false,
    isMenzen: true,
    roundWind: 'east',
    seatWind: 'south',
    doraIndicators: [],
    uraDoraIndicators: [],
    honba: 0,
    riichiSticks: 0,
    ...overrides,
  };
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) => (
      player.id === playerId
        ? { ...player, hand: tiles(ids), drawnTile: null }
        : player
    )),
  };
}

describe('scoring integration - decomposition choice', () => {
  it('enumerates multiple legal decompositions for chiitoitsu and ryanpeikou-shaped hands', () => {
    const hand = tiles([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 11, 11, 27, 27]);
    const shapes = findWinningShapes(hand);
    expect(shapes.some((shape) => shape.type === 'seven-pairs')).toBe(true);
    expect(shapes.some((shape) => shape.type === 'standard')).toBe(true);
  });

  it('chooses the highest scoring decomposition rather than the first decomposition', () => {
    const score = evaluateWin(tiles([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 11, 11, 27, 27]), ctx(27));
    expect(score.shape?.type).toBe('standard');
    expect(score.han).toBeGreaterThanOrEqual(3);
  });
});

describe('scoring integration - multiple ron sticks', () => {
  it('gives riichi sticks only to the nearest actual ron winner', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      riichiSticks: 2,
      players: state.players.map((player) => ({ ...player, river: [], calls: [], riichi: false, riichiState: null })),
    };
    state = setHand(state, 1, [1, 2, 3, 3, 4, 5, 10, 11, 12, 19, 20, 21, 14]);
    state = setHand(state, 2, [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    state = setHand(state, 3, [1, 2, 3, 3, 4, 5, 10, 11, 12, 19, 20, 21, 14]);

    const wins = canRon(state, 0, createTile(14, 0));
    expect(wins.map((win) => win.winner)).toEqual([1, 3]);
    expect(wins[0].points - wins[1].points).toBe(2000);
  });

  it('adds riichi sticks to the ron winner without charging the discarder for the stick', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      riichiSticks: 1,
      players: state.players.map((player) => ({ ...player, river: [], calls: [], riichi: false, riichiState: null })),
    };
    state = setHand(state, 0, [1, 2, 3, 3, 4, 5, 10, 11, 12, 19, 20, 21, 14]);

    const [win] = canRon(state, 2, createTile(14, 0), { candidatePlayers: [0] });
    expect(win.winner).toBe(0);
    expect(win.pointDeltas[0] - Math.abs(win.pointDeltas[2])).toBe(1000);
    expect(win.pointDeltas[1]).toBe(0);
  });
});

describe('scoring integration - real PlayerState calls', () => {
  it('passes open pon state from winChecker into scoreCalculator', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      players: state.players.map((player) => ({ ...player, river: [], calls: [], riichi: false, riichiState: null })),
    };
    state = setHand(state, 1, [1, 2, 3, 10, 11, 12, 19, 20, 21, 14]);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 1
          ? {
              ...player,
              calls: [{
                type: 'pon',
                tiles: tiles([31, 31, 31]),
                from: 0,
                opened: true,
              }],
            }
          : player
      )),
    };

    const wins = canRon(state, 0, createTile(14, 0));
    expect(wins).toHaveLength(1);
    expect(wins[0].yaku.some((yaku) => yaku.name.startsWith('役牌'))).toBe(true);
    expect(wins[0].fu).toBe(30);
  });
});
