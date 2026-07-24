import { describe, expect, it } from 'vitest';
import { advanceAIAction } from './ai';
import { passCall } from './callChecker';
import { createInitialGameState, declareRiichi, discardTile, getRiichiDiscardCandidates } from './engine';
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
        : { ...player, hand: tiles([4, 5, 6, 13, 14, 15, 22, 23, 24, 28, 29, 30, 31]), calls: [], riichi: false, riichiState: null },
    ),
  };
}

function northRiichiState(): GameState {
  return setHand(createInitialGameState(), 3, [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
}

describe('北家立直流程回归', () => {
  it('北家声明立直后弃牌并进入下一家东家的摸牌流程', () => {
    const state = northRiichiState();
    const [candidate] = getRiichiDiscardCandidates(state, 3);
    const riichi = declareRiichi(state, 3);
    const after = discardTile(riichi, 3, candidate.instanceId);
    expect(after.currentPlayer).toBe(0);
    expect(after.currentPlayer).not.toBe(4);
    expect(after.phase).toBe('draw');
    expect(after.players[3].riichi).toBe(true);
    expect(after.players[3].riichiState?.riichiDiscardInstanceId).toBe(candidate.instanceId);
    expect(after.pendingCall).toBeNull();
  });

  it('北家立直弃牌后若出现鸣牌窗口，跳过后回到东家摸牌并清理窗口', () => {
    const state = northRiichiState();
    const [candidate] = getRiichiDiscardCandidates(state, 3);
    const withHumanPon = {
      ...state,
      players: state.players.map((player) =>
        player.id === 0
          ? { ...player, hand: [createTile(candidate.id, 10), createTile(candidate.id, 11), ...tiles([4, 5, 6, 13, 14, 15, 22, 23, 24, 28, 29])] }
          : player,
      ),
    };
    const afterDiscard = discardTile(declareRiichi(withHumanPon, 3), 3, candidate.instanceId);
    expect(afterDiscard.phase).toBe('call-window');
    const afterPass = passCall(afterDiscard);
    expect(afterPass.currentPlayer).toBe(0);
    expect(afterPass.phase).toBe('draw');
    expect(afterPass.pendingCall).toBeNull();
  });

  it('AI北家立直弃牌后不会产生 playerIndex 4，后续自动流程继续', () => {
    const state = northRiichiState();
    const after = advanceAIAction(state, () => 0);
    expect(after.currentPlayer).toBeGreaterThanOrEqual(0);
    expect(after.currentPlayer).toBeLessThan(4);
    expect(after.players[3].riichi).toBe(true);
    expect(after.players[3].riichiState?.riichiDiscardInstanceId).toBeTruthy();
  });
});
