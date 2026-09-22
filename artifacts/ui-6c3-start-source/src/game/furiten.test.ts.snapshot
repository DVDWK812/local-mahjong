import { describe, expect, it } from 'vitest';
import { createInitialGameState, drawTile, passRon } from './engine';
import { getFuritenState } from './furiten';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, Tile, TileId } from './types';
import { canRon, canTsumo } from './winChecker';

function tiles(ids: TileId[]): Tile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = seen.get(id) ?? 0;
    seen.set(id, copy + 1);
    return createTile(id, copy);
  });
}

function setPlayerHand(state: GameState, playerId: PlayerId, handIds: TileId[], overrides: Partial<GameState['players'][number]> = {}): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? {
      ...player,
      hand: tiles(handIds),
      drawnTile: null,
      calls: [],
      river: [],
      riichi: false,
      riichiState: null,
      furitenState: { temporaryFuriten: false, riichiPermanentFuriten: false },
      ...overrides,
    } : player),
  };
}

const twoSidedHand = [1, 2, 3, 2, 3, 4, 10, 11, 12, 23, 24, 13, 13] as TileId[];
const tankiHand = [1, 2, 3, 2, 3, 4, 10, 11, 12, 19, 20, 21, 13] as TileId[];

describe('furiten rules', () => {
  it('自己打过当前和牌张时不能荣和', () => {
    const state = setPlayerHand(createInitialGameState(), 1, tankiHand, {
      river: [createTile(13, 3)],
    });
    expect(canRon(state, 0, createTile(13, 0), { candidatePlayers: [1] })).toHaveLength(0);
    expect(getFuritenState(state, 1).discardFuriten).toBe(true);
  });

  it('舍牌振听时仍可自摸', () => {
    const winTile = createTile(13, 0);
    const state = setPlayerHand(createInitialGameState(), 1, [...tankiHand, 13], {
      drawnTile: winTile,
      river: [createTile(13, 3)],
    });
    const playerHand = state.players[1].hand.slice(0, -1);
    const fixed = {
      ...state,
      players: state.players.map((player) => player.id === 1 ? { ...player, hand: [...playerHand, winTile], drawnTile: winTile } : player),
    };
    expect(canTsumo(fixed, 1)).not.toBeNull();
  });

  it('自己牌河中存在任意当前和牌张时，其他和牌张也不能荣和', () => {
    const state = setPlayerHand(createInitialGameState(), 1, twoSidedHand, {
      river: [createTile(22, 0)],
    });
    expect(canRon(state, 0, createTile(25, 0), { candidatePlayers: [1] })).toHaveLength(0);
    expect(getFuritenState(state, 1).discardFuriten).toBe(true);
  });

  it('听牌变化后重新计算舍牌振听', () => {
    const state = setPlayerHand(createInitialGameState(), 1, tankiHand, {
      river: [createTile(22, 0)],
    });
    expect(canRon(state, 0, createTile(13, 0), { candidatePlayers: [1] })).toHaveLength(1);
    expect(getFuritenState(state, 1).discardFuriten).toBe(false);
  });

  it('非立直玩家跳过荣和后进入同巡振听，下一次自己摸牌后解除', () => {
    const base = setPlayerHand(createInitialGameState(), 1, twoSidedHand);
    const ronWindow: GameState = {
      ...base,
      phase: 'ron-window',
      pendingRon: {
        discarder: 0,
        tile: createTile(22, 0),
        eligibleRonPlayers: [1],
        passedPlayers: [],
      },
    };
    const passed = passRon(ronWindow, 1);
    expect(passed.players[1].furitenState?.temporaryFuriten).toBe(true);
    expect(canRon(passed, 2, createTile(25, 0), { candidatePlayers: [1] })).toHaveLength(0);

    const drawn = drawTile({ ...passed, currentPlayer: 1, phase: 'draw', wall: [createTile(7, 0), createTile(8, 0)] }, { settleTsumo: false });
    const afterDrawPlayer = drawn.players[1];
    const afterDraw = {
      ...drawn,
      players: drawn.players.map((player) => player.id === 1 ? {
        ...afterDrawPlayer,
        hand: afterDrawPlayer.hand.filter((tile) => tile.instanceId !== afterDrawPlayer.drawnTile?.instanceId),
        drawnTile: null,
      } : player),
    };
    expect(afterDraw.players[1].furitenState?.temporaryFuriten).toBe(false);
    expect(canRon(afterDraw, 2, createTile(25, 0), { candidatePlayers: [1] })).toHaveLength(1);
  });

  it('立直玩家跳过荣和后进入永久振听，下一次摸牌后仍不解除但仍可自摸', () => {
    const base = setPlayerHand(createInitialGameState(), 1, twoSidedHand, {
      riichi: true,
      riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' },
    });
    const ronWindow: GameState = {
      ...base,
      phase: 'ron-window',
      pendingRon: {
        discarder: 0,
        tile: createTile(22, 0),
        eligibleRonPlayers: [1],
        passedPlayers: [],
      },
    };
    const passed = passRon(ronWindow, 1);
    expect(passed.players[1].furitenState?.riichiPermanentFuriten).toBe(true);
    const drawn = drawTile({ ...passed, currentPlayer: 1, phase: 'draw', wall: [createTile(25, 0), createTile(8, 0)] }, { settleTsumo: false });
    expect(drawn.players[1].furitenState?.riichiPermanentFuriten).toBe(true);
    expect(canRon(drawn, 2, createTile(25, 1), { candidatePlayers: [1] })).toHaveLength(0);
    expect(canTsumo(drawn, 1)).not.toBeNull();
  });
});
