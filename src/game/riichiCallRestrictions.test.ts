import { describe, expect, it } from 'vitest';
import { canPon, executePon, getPonOptions } from './callChecker';
import { canChi, executeChi, getChiOptions } from './chiChecker';
import { createInitialGameState, discardTile } from './engine';
import { canKakan, canMinkan, executeKan, getKakanCandidates, getMinkanOptions } from './kanChecker';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, Tile, TileId } from './types';

function tiles(ids: TileId[]): Tile[] {
  return ids.map((id, index) => createTile(id, index % 4));
}

function withRiichiPlayer(state: GameState, playerId: PlayerId, handIds: TileId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? {
      ...player,
      hand: tiles(handIds),
      riichi: true,
      riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' },
    } : player),
  };
}

describe('riichi call restrictions', () => {
  it('立直后不生成吃、碰、明杠候选', () => {
    const discard = createTile(3, 0);
    const state = withRiichiPlayer(createInitialGameState(), 1, [1, 2, 3, 3, 3, 4, 5, 6, 10, 11, 12, 18, 18]);
    expect(getChiOptions(state, 0, discard).filter((option) => option.player === 1)).toHaveLength(0);
    expect(getPonOptions(state, 0, discard).filter((option) => option.player === 1)).toHaveLength(0);
    expect(getMinkanOptions(state, 0, discard).filter((option) => option.player === 1)).toHaveLength(0);
  });

  it('引擎拒绝立直后的吃、碰和明杠请求', () => {
    const discard = createTile(3, 0);
    const base = withRiichiPlayer(createInitialGameState(), 1, [1, 2, 3, 3, 3, 4, 5, 6, 10, 11, 12, 18, 18]);
    const state: GameState = {
      ...base,
      phase: 'call-window',
      pendingCall: {
        discarder: 0,
        tile: discard,
        options: [
          { type: 'chi', player: 1, sequence: [1, 2, 3], usedTileIds: [1, 2] },
          { type: 'pon', player: 1 },
          { type: 'kan', kanType: 'minkan', player: 1 },
        ],
      },
      players: base.players.map((player) => player.id === 0 ? { ...player, river: [discard] } : player),
    };
    expect(canChi(state, 1)).toBe(false);
    expect(canPon(state, 1)).toBe(false);
    expect(canMinkan(state, 1)).toBe(false);
    expect(executeChi(state, 1)).toBe(state);
    expect(executePon(state, 1)).toBe(state);
    expect(executeKan(state, 1, 'minkan')).toBe(state);
  });

  it('立直后不生成加杠候选，执行加杠会被拒绝', () => {
    const added = createTile(27, 3);
    const state = withRiichiPlayer(createInitialGameState(), 1, [27, 1, 2, 3, 9, 10, 11, 18, 19, 20, 13, 13, 14, 14]);
    const ready: GameState = {
      ...state,
      currentPlayer: 1,
      phase: 'discard',
      players: state.players.map((player) => player.id === 1 ? {
        ...player,
        hand: [added, ...player.hand.filter((tile) => tile.id !== 27)],
        calls: [{ type: 'pon', tiles: tiles([27, 27, 27]), from: 0, opened: true }],
      } : player),
    };
    expect(getKakanCandidates(ready, 1)).toHaveLength(0);
    expect(canKakan(ready, 1, 27)).toBe(false);
    expect(executeKan(ready, 1, 'kakan', 27)).toBe(ready);
  });

  it('底层弃牌规则拒绝立直后的非摸切，只接受摸入牌实例', () => {
    const hand = tiles([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 31]);
    const drawnTile = hand[hand.length - 1];
    const concealedTile = hand[0];
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      currentPlayer: 1,
      phase: 'discard',
      players: base.players.map((player) => player.id === 1
        ? {
            ...player,
            hand,
            drawnTile,
            riichi: true,
            riichiState: {
              declaredAtTurn: 1,
              ippatsuAvailable: false,
              kind: 'riichi',
              riichiDiscardInstanceId: 'previous-riichi-discard',
            },
          }
        : player),
    };

    expect(discardTile(state, 1, concealedTile.instanceId)).toBe(state);
    const after = discardTile(state, 1, drawnTile.instanceId);
    expect(after.players[1].river[after.players[1].river.length - 1]).toMatchObject({ instanceId: drawnTile.instanceId, isTsumogiri: true });
    expect(after.players[1].hand.some((tile) => tile.instanceId === concealedTile.instanceId)).toBe(true);
  });
});
