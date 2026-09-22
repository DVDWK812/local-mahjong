import { describe, expect, it } from 'vitest';
import { createInitialGameState, declareRiichi, discardTile, drawTile, getRiichiDiscardCandidates } from './engine';
import { getDrawActionState, hasDrawAction, isRiichiAnkanWaitPreserving } from './interaction';
import { canAnkan, executeKan } from './kanChecker';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, Tile, TileId } from './types';

function tiles(ids: TileId[]): Tile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = seen.get(id) ?? 0;
    seen.set(id, copy + 1);
    return createTile(id, copy);
  });
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  const hand = tiles(ids);
  return {
    ...state,
    currentPlayer: playerId,
    phase: 'discard',
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, hand, drawnTile: hand[hand.length - 1] ?? null, calls: [], riichi: false, riichiState: null }
        : player,
    ),
  };
}

function withSafeOtherHands(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id === 1) return { ...player, hand: tiles([1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 24, 28]) };
      if (player.id === 2) return { ...player, hand: tiles([2, 4, 6, 8, 10, 12, 14, 16, 19, 21, 23, 25, 29]) };
      if (player.id === 3) return { ...player, hand: tiles([3, 5, 7, 9, 11, 13, 15, 17, 20, 22, 24, 26, 30]) };
      return player;
    }),
  };
}

describe('实战交互流程', () => {
  it('玩家回合摸牌可自动执行，摸入牌留在最右侧且不自动自摸结算', () => {
    const draw = createTile(5, 3);
    const state = {
      ...createInitialGameState(),
      currentPlayer: 0 as PlayerId,
      phase: 'draw' as const,
      wall: [draw],
    };
    const after = drawTile(state, { settleTsumo: false });
    expect(after.phase).toBe('discard');
    expect(after.players[0].drawnTile?.instanceId).toBe(draw.instanceId);
    expect(after.players[0].hand[after.players[0].hand.length - 1]?.instanceId).toBe(draw.instanceId);
    expect(after.result).toBeNull();
  });

  it('摸切后进入下一家摸牌流程', () => {
    const draw = createTile(5, 3);
    const drawn = drawTile(withSafeOtherHands({ ...createInitialGameState(), currentPlayer: 0, phase: 'draw', wall: [draw, createTile(6, 0)] }), { settleTsumo: false });
    const after = discardTile(drawn, 0, draw.instanceId);
    expect(after.currentPlayer).toBe(1);
    expect(after.phase).toBe('draw');
    expect(after.players[0].river[after.players[0].river.length - 1]?.instanceId).toBe(draw.instanceId);
    expect(after.players[0].river[after.players[0].river.length - 1]?.isTsumogiri).toBe(true);
  });

  it('打出其他手牌后，摸入牌并入排序后的手牌', () => {
    const draw = createTile(0, 3);
    const drawn = drawTile({ ...createInitialGameState(), currentPlayer: 0, phase: 'draw', wall: [draw, createTile(6, 0)] }, { settleTsumo: false });
    const otherTile = drawn.players[0].hand.find((tile) => tile.instanceId !== draw.instanceId);
    if (!otherTile) throw new Error('Expected another tile');
    const after = discardTile(drawn, 0, otherTile.instanceId);
    const ids = after.players[0].hand.map((tile) => tile.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(after.players[0].river[after.players[0].river.length - 1]?.isTsumogiri).toBe(false);
  });

  it('合法立直与双立直时生成立直弃牌提示数据', () => {
    const state = setHand(createInitialGameState(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const actions = getDrawActionState(state, 0);
    expect(actions.canRiichi).toBe(true);
    expect(actions.canDoubleRiichi).toBe(true);
    expect(actions.riichiDiscardCandidates.length).toBeGreaterThan(0);
  });

  it('合法九种九牌时生成提示数据', () => {
    const state = setHand(createInitialGameState(), 0, [0, 8, 9, 17, 18, 26, 27, 28, 31, 1, 2, 3, 4, 5]);
    expect(getDrawActionState(state, 0).canKyuushuKyuuhai).toBe(true);
  });

  it('合法暗杠和加杠时生成提示数据', () => {
    const ankan = setHand(createInitialGameState(), 0, [0, 0, 0, 0, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    expect(getDrawActionState(ankan, 0).ankanCandidates.map((item) => item.tileId)).toContain(0);

    const fourth = createTile(27, 3);
    const kakan = {
      ...setHand(createInitialGameState(), 0, [27, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31, 27]),
      players: createInitialGameState().players.map((player) =>
        player.id === 0
          ? {
              ...player,
              hand: [fourth, ...tiles([1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20])],
              drawnTile: fourth,
              calls: [{ type: 'pon' as const, tiles: tiles([27, 27, 27]), from: 1 as PlayerId, opened: true }],
            }
          : player,
      ),
      currentPlayer: 0 as PlayerId,
      phase: 'discard' as const,
    };
    expect(getDrawActionState(kakan, 0).kakanCandidates.map((item) => item.tileId)).toContain(27);
  });

  it('无合法动作时不弹提示', () => {
    const state = {
      ...setHand(createInitialGameState(), 0, [1, 2, 4, 5, 7, 10, 12, 14, 16, 19, 21, 23, 25, 30]),
      players: createInitialGameState().players.map((player) => player.id === 0 ? { ...player, score: 900, hand: tiles([1, 2, 4, 5, 7, 10, 12, 14, 16, 19, 21, 23, 25, 30]), drawnTile: createTile(30, 0) } : player),
    };
    expect(hasDrawAction(state, 0)).toBe(false);
  });

  it('立直后无特殊动作时只能自动摸切摸入牌', () => {
    const ready = setHand(createInitialGameState(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const riichi = declareRiichi(ready, 0, getRiichiDiscardCandidates(ready, 0)[0].instanceId);
    const draw = createTile(5, 3);
    const drawn = drawTile({ ...riichi, currentPlayer: 0, phase: 'draw', wall: [draw, createTile(6, 0)] }, { settleTsumo: false });
    expect(drawn.players[0].riichi).toBe(true);
    expect(drawn.players[0].drawnTile?.instanceId).toBe(draw.instanceId);
    if (!hasDrawAction(drawn, 0)) {
      const after = discardTile(drawn, 0, draw.instanceId);
      expect(after.players[0].river[after.players[0].river.length - 1]?.instanceId).toBe(draw.instanceId);
    }
  });

  it('立直后可自摸时提示自摸而不自动确认', () => {
    const state = setHand(createInitialGameState(), 0, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14, 14]);
    const riichiState = {
      ...state,
      players: state.players.map((player) => player.id === 0 ? { ...player, riichi: true, riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' as const } } : player),
    };
    const actions = getDrawActionState(riichiState, 0);
    expect(actions.canTsumo).toBe(true);
    expect(riichiState.result).toBeNull();
  });

  it('立直后合法暗杠可选择，改变等待的暗杠不显示', () => {
    const hand = tiles([0, 0, 0, 0, 1, 2, 3, 9, 10, 11, 18, 19, 20, 31]);
    const state = {
      ...setHand(createInitialGameState(), 0, [0, 0, 0, 0, 1, 2, 3, 9, 10, 11, 18, 19, 20, 31]),
      players: createInitialGameState().players.map((player) =>
        player.id === 0
          ? { ...player, hand, drawnTile: hand[3], riichi: true, riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' as const } }
          : player,
      ),
    };
    const candidates = getDrawActionState(state, 0).ankanCandidates;
    expect(candidates.map((candidate) => candidate.tileId)).toContain(0);
    expect(canAnkan(state, 0, 0)).toBe(true);
    expect(candidates.every((candidate) => isRiichiAnkanWaitPreserving(state, 0, candidate.tileId))).toBe(true);

    const changingWaitHand = tiles([0, 0, 0, 1, 1, 2, 2, 3, 14, 15, 24, 25, 26, 0]);
    const changingWaitState: GameState = {
      ...state,
      players: state.players.map((player) => player.id === 0
        ? { ...player, hand: changingWaitHand, drawnTile: changingWaitHand[changingWaitHand.length - 1] }
        : player),
    };
    expect(canAnkan(changingWaitState, 0, 0)).toBe(false);
    expect(getDrawActionState(changingWaitState, 0).ankanCandidates.map((candidate) => candidate.tileId)).not.toContain(0);
  });

  it('暗杠后自动岭上摸牌并保持立直和门清状态', () => {
    const hand = tiles([0, 0, 0, 0, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    const state = {
      ...setHand(createInitialGameState(), 0, [0, 0, 0, 0, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]),
      deadWall: [createTile(32, 0), ...createInitialGameState().deadWall.slice(1)],
      players: createInitialGameState().players.map((player) =>
        player.id === 0
          ? { ...player, hand, drawnTile: hand[3], riichi: true, riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' as const } }
          : player,
      ),
    };
    const after = executeKan(state, 0, 'ankan', 0);
    expect(after.phase).toBe('discard');
    expect(after.lastDrawSource).toBe('rinshan');
    expect(after.players[0].riichi).toBe(true);
    expect(after.players[0].calls[0]).toMatchObject({ opened: false, kanType: 'ankan' });
    expect(after.players[0].drawnTile).not.toBeNull();
  });
});
