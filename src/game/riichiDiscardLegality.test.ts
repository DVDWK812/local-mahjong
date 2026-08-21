import { describe, expect, it } from 'vitest';
import { buildTenpaiDisplay } from './tenpaiDisplay';
import { canDeclareDoubleRiichi, canDeclareRiichi, createInitialGameState, declareRiichi, evaluateRiichiDiscard, getRiichiDiscardCandidateGroups, getRiichiDiscardCandidates } from './engine';
import { isPlayerTenpaiAtDraw } from './exhaustiveDraw';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, Tile, TileId } from './types';

function tiles(ids: TileId[]): Tile[] {
  const copies = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = copies.get(id) ?? 0;
    copies.set(id, copy + 1);
    return createTile(id, copy);
  });
}

function readyState(ids: TileId[], playerId: PlayerId = 0): GameState {
  const base = createInitialGameState();
  const hand = tiles(ids);
  const safeOpponentHand = [4, 5, 6, 13, 14, 15, 22, 23, 24, 28, 29, 30, 32] as TileId[];
  return {
    ...base,
    currentPlayer: playerId,
    phase: 'discard',
    players: base.players.map((player) => player.id === playerId
      ? { ...player, hand, drawnTile: hand[hand.length - 1], calls: [], riichi: false, riichiState: null }
      : { ...player, hand: tiles(safeOpponentHand), drawnTile: null, calls: [], riichi: false, riichiState: null }),
  };
}

function preview(state: GameState, candidate: Tile) {
  return buildTenpaiDisplay(
    state,
    state.currentPlayer,
    candidate.instanceId,
    canDeclareDoubleRiichi(state, state.currentPlayer) ? 'double-riichi' : 'riichi',
  );
}

describe('RIICHI-DISCARD-MUST-TENPAI', () => {
  it('相同普通牌只生成一个UI候选，但保留全部合法instanceId', () => {
    const state = readyState([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 23, 31]);
    const groups = getRiichiDiscardCandidateGroups(state, 0);
    const sixSou = groups.find((candidate) => candidate.tile.id === 23 && !candidate.tile.red);

    expect(sixSou).toBeDefined();
    expect(sixSou?.tiles).toHaveLength(2);
    expect(sixSou?.instanceIds).toEqual(sixSou?.tiles.map((tile) => tile.instanceId));
    expect(groups.filter((candidate) => candidate.tile.id === 23 && !candidate.tile.red)).toHaveLength(1);

    const selectedInstanceId = sixSou!.instanceIds[0];
    const expected = buildTenpaiDisplay(state, 0, selectedInstanceId, 'double-riichi');
    const after = declareRiichi(state, 0, selectedInstanceId);
    expect(after.players[0].river[after.players[0].river.length - 1]?.instanceId).toBe(selectedInstanceId);
    expect(buildTenpaiDisplay(after, 0)?.waits.map((wait) => wait.id)).toEqual(expected?.waits.map((wait) => wait.id));
  });

  it('多个合法候选逐个正式弃牌后都听牌，且预览等待与正式结果完全一致', () => {
    const state = readyState([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const candidates = getRiichiDiscardCandidates(state, 0);
    expect(candidates).toHaveLength(2);
    expect(canDeclareRiichi(state, 0)).toBe(true);

    const previewWaits = candidates.map((candidate) => preview(state, candidate)?.waits.map((wait) => wait.id));
    expect(previewWaits[0]).not.toEqual(previewWaits[1]);

    candidates.forEach((candidate) => {
      const expected = preview(state, candidate);
      const after = declareRiichi(state, 0, candidate.instanceId);
      const actual = buildTenpaiDisplay(after, 0);
      expect(after).not.toBe(state);
      expect(isPlayerTenpaiAtDraw(after, 0)).toBe(true);
      expect(after.players[0].riichi).toBe(true);
      expect(after.players[0].riichiState?.riichiDiscardInstanceId).toBe(candidate.instanceId);
      expect(after.players[0].river[after.players[0].river.length - 1]?.instanceId).toBe(candidate.instanceId);
      expect(actual?.waits.map(({ id, remaining }) => ({ id, remaining })))
        .toEqual(expected?.waits.map(({ id, remaining }) => ({ id, remaining })));
      expect(actual?.totalRemaining).toBe(expected?.totalRemaining);
    });
  });

  it('向听数为零但没有实际和牌等待的弃牌不得成为立直候选', () => {
    const state = readyState([6, 15, 4, 22, 6, 23, 6, 14, 20, 24, 4, 16, 12, 33]);
    const candidates = getRiichiDiscardCandidates(state, 0);
    expect(candidates.map((tile) => tile.id)).not.toContain(20);
    const threeSou = state.players[0].hand.find((tile) => tile.id === 20);
    expect(threeSou).toBeDefined();
    expect(evaluateRiichiDiscard(state, 0, threeSou!.instanceId)).toBeNull();
  });

  it('不听牌弃牌不进入候选，底层提交该instanceId不会扣点或改变状态', () => {
    const state = readyState([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const candidateIds = new Set(getRiichiDiscardCandidates(state, 0).map((tile) => tile.instanceId));
    const illegal = state.players[0].hand.find((tile) => !candidateIds.has(tile.instanceId));
    expect(illegal).toBeDefined();
    expect(evaluateRiichiDiscard(state, 0, illegal!.instanceId)).toBeNull();
    expect(declareRiichi(state, 0, illegal!.instanceId)).toBe(state);
  });

  it('赤五与普通五都保留为具体instanceId候选，正式弃牌不会删错物理牌', () => {
    const state = readyState([0, 1, 2, 9, 10, 11, 18, 19, 20, 31, 31, 3, 4, 4]);
    const fiveCandidates = getRiichiDiscardCandidates(state, 0).filter((tile) => tile.id === 4);
    const fiveGroups = getRiichiDiscardCandidateGroups(state, 0).filter((candidate) => candidate.tile.id === 4);
    expect(fiveCandidates).toHaveLength(2);
    expect(fiveCandidates.map((tile) => tile.red).sort()).toEqual([false, true]);
    expect(fiveGroups).toHaveLength(2);
    expect(fiveGroups.every((candidate) => candidate.instanceIds.length === 1)).toBe(true);

    fiveCandidates.forEach((discarded, index) => {
      const retained = fiveCandidates[1 - index];
      const after = declareRiichi(state, 0, discarded.instanceId);
      expect(after.players[0].river[after.players[0].river.length - 1]?.instanceId).toBe(discarded.instanceId);
      expect(after.players[0].hand.some((tile) => tile.instanceId === discarded.instanceId)).toBe(false);
      expect(after.players[0].hand.some((tile) => tile.instanceId === retained.instanceId)).toBe(true);
      expect(isPlayerTenpaiAtDraw(after, 0)).toBe(true);
    });
  });
});
