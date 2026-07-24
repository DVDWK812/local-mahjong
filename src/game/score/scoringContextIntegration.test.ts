import { describe, expect, it } from 'vitest';
import { createInitialGameState, declareRiichi } from '../engine';
import { createScoringWinContext } from './scoringAdapter';
import { createTile } from '../tileUtils';
import type { TileId } from '../types';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

describe('scoring context integration', () => {
  it('generates haitei and not rinshan for last live-wall tsumo', () => {
    const state = { ...createInitialGameState(), wall: [], lastDrawSource: 'live-wall' as const };
    const context = createScoringWinContext({
      state,
      playerId: 0,
      winningTile: createTile(1, 0),
      winType: 'tsumo',
      preWinHand: [],
      winningTileSource: 'normal-draw',
    });
    expect(context.isHaitei).toBe(true);
    expect(context.isRinshan).toBe(false);
  });

  it('generates rinshan and not haitei for rinshan tsumo', () => {
    const state = { ...createInitialGameState(), wall: [], kanState: { type: 'ankan' as const, player: 0 as const, tile: 1 as const, doraIndicatorCount: 2 } };
    const context = createScoringWinContext({
      state,
      playerId: 0,
      winningTile: createTile(1, 0),
      winType: 'tsumo',
      preWinHand: [],
    });
    expect(context.isRinshan).toBe(true);
    expect(context.isHaitei).toBe(false);
  });

  it('marks double riichi from RiichiState kind', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      players: state.players.map((player, index) => index === 0 ? {
        ...player,
        score: 25000,
        hand: tiles([1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14]),
        drawnTile: createTile(14, 1),
      } : player),
    };
    const after = declareRiichi(state, 0);
    const context = createScoringWinContext({
      state: after,
      playerId: 0,
      winningTile: createTile(1, 0),
      winType: 'ron',
      preWinHand: [],
    });
    expect(after.players[0].riichiState?.kind).toBe('double-riichi');
    expect(context.isDoubleRiichi).toBe(true);
  });

  it('passes active ura dora indicators only for riichi winners', () => {
    const base = createInitialGameState();
    const state = {
      ...base,
      doraIndicators: [createTile(5, 0), createTile(12, 0)],
      deadWall: base.deadWall.map((tile, index) => {
        if (index === 9) return createTile(3, 0);
        if (index === 10) return createTile(4, 0);
        return tile;
      }),
      players: base.players.map((player, index) => index === 0 ? {
        ...player,
        riichi: true,
      } : player),
    };

    const riichiContext = createScoringWinContext({
      state,
      playerId: 0,
      winningTile: createTile(1, 0),
      winType: 'ron',
      preWinHand: [],
    });
    const nonRiichiContext = createScoringWinContext({
      state,
      playerId: 1,
      winningTile: createTile(1, 0),
      winType: 'ron',
      preWinHand: [],
    });

    expect(riichiContext.uraDoraIndicators.map((tile) => tile.id)).toEqual([3, 4]);
    expect(nonRiichiContext.uraDoraIndicators).toEqual([]);
  });
});
