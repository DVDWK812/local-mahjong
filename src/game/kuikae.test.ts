import { describe, expect, it } from 'vitest';
import { selectAIDiscardTile } from './ai';
import { executePon, getPonOptions } from './callChecker';
import { executeChi, getChiOptions } from './chiChecker';
import { createInitialGameState, discardTile } from './engine';
import { executeKan } from './kanChecker';
import { filterKuikaeDiscardTiles, kuikaeForbiddenAfterChi } from './kuikae';
import { recommendDiscards } from './shanten';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, TileId } from './types';

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  const hand = ids.map((id, index) => createTile(id, index % 4));
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId
      ? { ...player, hand, drawnTile: null, calls: [] }
      : player),
  };
}

function chiWindow(discardId: TileId, callerHand: TileId[], enabled = true): GameState {
  let state = createInitialGameState();
  state = setHand(state, 0, [discardId, 6, 8, 9, 11, 13, 15, 18, 20, 22, 27, 29, 31, 33]);
  state = setHand(state, 1, callerHand);
  state = {
    ...state,
    currentPlayer: 0,
    phase: 'discard',
    ruleConfig: { ...state.ruleConfig, forbidKuikae: enabled },
  };
  return discardTile(state, 0, state.players[0].hand[0].instanceId);
}

function ponWindow(discardId: TileId, callerHand: TileId[], enabled = true): GameState {
  let state = createInitialGameState();
  state = setHand(state, 0, [discardId, 6, 8, 9, 11, 13, 15, 18, 20, 22, 27, 29, 31, 33]);
  state = setHand(state, 1, callerHand);
  state = {
    ...state,
    currentPlayer: 0,
    phase: 'discard',
    ruleConfig: { ...state.ruleConfig, forbidKuikae: enabled },
  };
  return discardTile(state, 0, state.players[0].hand[0].instanceId);
}

describe('禁止食替', () => {
  it.each([
    { label: '23吃1', discard: 0 as TileId, hand: [1, 2, 0, 3, 27] as TileId[], forbidden: [0, 3] },
    { label: '23吃4', discard: 3 as TileId, hand: [1, 2, 0, 3, 27] as TileId[], forbidden: [0, 3] },
    { label: '13吃2', discard: 1 as TileId, hand: [0, 2, 1, 27] as TileId[], forbidden: [1] },
  ])('$label 生成正确禁打集合，成功弃出其他牌后清除', ({ discard, hand, forbidden }) => {
    const window = chiWindow(discard, hand);
    const called = executeChi(window, 1, 0);
    expect(called.kuikaeForbiddenTileIds[1]).toEqual(forbidden);

    const forbiddenTile = called.players[1].hand.find((tile) => forbidden.includes(tile.id));
    expect(forbiddenTile && discardTile(called, 1, forbiddenTile.instanceId)).toBe(called);
    const safeTile = called.players[1].hand.find((tile) => !forbidden.includes(tile.id))!;
    const discarded = discardTile(called, 1, safeTile.instanceId);
    expect(discarded).not.toBe(called);
    expect(discarded.kuikaeForbiddenTileIds[1]).toBeUndefined();
  });

  it('碰2后禁打2，且人类底层调用与AI都不能绕过', () => {
    const called = executePon(ponWindow(1, [1, 1, 1, 27]), 1);
    expect(called.kuikaeForbiddenTileIds[1]).toEqual([1]);
    const forbidden = called.players[1].hand.find((tile) => tile.id === 1)!;
    const safe = called.players[1].hand.find((tile) => tile.id === 27)!;
    expect(discardTile(called, 1, forbidden.instanceId)).toBe(called);
    expect(selectAIDiscardTile(called, 1, () => 0)?.instanceId).toBe(safe.instanceId);
  });

  it('赤五与普通五按同一种牌过滤，推荐弃牌也使用共享禁打集合', () => {
    const redFive = { ...createTile(4, 0), red: true };
    const normalFive = { ...createTile(4, 1), red: false };
    const safe = createTile(27, 0);
    expect(filterKuikaeDiscardTiles([redFive, normalFive, safe], [4]).map((tile) => tile.id)).toEqual([27]);
    expect(recommendDiscards([redFive, normalFive, safe], Array(34).fill(0), [4]).every((item) => item.tileId !== 4)).toBe(true);
  });

  it('手中全部属于禁打牌时不生成吃碰候选，规则关闭时保留候选', () => {
    const discardedOne = createTile(0, 0);
    const discardedTwo = createTile(1, 0);
    let state = setHand(createInitialGameState(), 1, [1, 2, 0, 3]);
    state = { ...state, ruleConfig: { ...state.ruleConfig, forbidKuikae: true } };
    expect(getChiOptions(state, 0, discardedOne)).toEqual([]);
    state = setHand(state, 1, [1, 1, 1, 1]);
    expect(getPonOptions(state, 0, discardedTwo)).not.toContainEqual({ type: 'pon', player: 1 });
    state = setHand(state, 1, [1, 2, 0, 3]);
    state = { ...state, ruleConfig: { ...state.ruleConfig, forbidKuikae: false } };
    expect(getChiOptions(state, 0, discardedOne).some((option) => option.type === 'chi')).toBe(true);
  });

  it('杠牌不生成食替限制', () => {
    let state = createInitialGameState();
    state = setHand(state, 0, [0, 0, 0, 0, 2, 4, 6, 8, 10, 12, 14, 18, 27, 31]);
    state = { ...state, currentPlayer: 0, phase: 'discard' };
    const after = executeKan(state, 0, 'ankan', 0);
    expect(after).not.toBe(state);
    expect(after.kuikaeForbiddenTileIds).toEqual({});
  });

  it('吃牌禁打算法不会跨花色或越过幺九边界', () => {
    expect(kuikaeForbiddenAfterChi([0, 1])).toEqual([2]);
    expect(kuikaeForbiddenAfterChi([7, 8])).toEqual([6]);
    expect(kuikaeForbiddenAfterChi([8, 9])).toEqual([]);
  });
});
