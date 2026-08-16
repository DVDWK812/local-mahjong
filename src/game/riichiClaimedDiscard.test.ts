import { describe, expect, it } from 'vitest';
import { executePon } from './callChecker';
import { executeChi } from './chiChecker';
import { createInitialGameState, discardTile } from './engine';
import { executeKan } from './kanChecker';
import { settleExhaustiveDraw } from './exhaustiveDraw';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, Tile, TileId } from './types';

function hand(ids: TileId[], offset = 0): Tile[] {
  return ids.map((id, index) => createTile(id, offset + index));
}

function riichiDiscardState(discardId: TileId, callerHand: Tile[], discarder: PlayerId = 0): GameState {
  const state = createInitialGameState();
  const declaration = createTile(discardId, 900);
  const nextSideways = createTile(1, 901);
  const later = createTile(2, 902);
  return {
    ...state,
    currentPlayer: discarder,
    phase: 'discard',
    turn: 8,
    players: state.players.map((player) => {
      if (player.id === discarder) {
        return {
          ...player,
          hand: [declaration, nextSideways, later],
          drawnTile: declaration,
          river: [],
          calls: [],
          riichi: true,
          riichiState: {
            declaredAtTurn: 8,
            ippatsuAvailable: true,
            kind: 'riichi' as const,
          },
          pendingRiichiSidewaysDiscard: false,
        };
      }
      if (player.id === 1) {
        return {
          ...player,
          hand: callerHand,
          drawnTile: null,
          river: [],
          calls: [],
          riichi: false,
          riichiState: null,
          pendingRiichiSidewaysDiscard: false,
        };
      }
      return {
        ...player,
        hand: hand([3, 4, 5, 6, 7, 8, 18, 19, 20, 21, 22, 23, 27], player.id * 100),
        drawnTile: null,
        river: [],
        calls: [],
        riichi: false,
        riichiState: null,
        pendingRiichiSidewaysDiscard: false,
      };
    }),
  };
}

function discardDeclaration(state: GameState): GameState {
  const tile = state.players[0].hand[0];
  return discardTile(state, 0, tile.instanceId);
}

function discardNextForRiichiPlayer(state: GameState): GameState {
  const player = state.players[0];
  const nextTile = player.hand[0];
  const readyState: GameState = {
    ...state,
    currentPlayer: 0,
    phase: 'discard',
    players: state.players.map((candidate) => candidate.id === 0
      ? { ...candidate, drawnTile: nextTile }
      : candidate),
  };
  return discardTile(readyState, 0, nextTile.instanceId);
}

describe('立直宣言牌被鸣后的横牌显示状态', () => {
  it('立直宣言牌未被鸣时自身横置', () => {
    const after = discardDeclaration(riichiDiscardState(12, hand([0, 1, 2, 3, 4, 5, 18, 19, 20, 21, 22, 23, 27], 100)));
    expect(after.players[0].river[0]?.isRiichiDiscard).toBe(true);
    expect(after.players[0].riichiState?.riichiDiscardInstanceId).toBe(after.players[0].river[0]?.instanceId);
    expect(after.players[0].pendingRiichiSidewaysDiscard).toBe(false);
  });

  it('立直宣言牌被碰后，下一张实际弃牌横置且只生效一次', () => {
    const afterDiscard = discardDeclaration(riichiDiscardState(12, hand([12, 12, 0, 1, 2, 3, 4, 5, 18, 19, 20, 21, 22], 100)));
    const afterPon = executePon(afterDiscard, 1);
    expect(afterPon.players[0].river[0]?.claimed).toBe(true);
    expect(afterPon.players[0].river[0]?.isRiichiDiscard).toBe(true);
    expect(afterPon.players[0].pendingRiichiSidewaysDiscard).toBe(true);

    const afterNext = discardNextForRiichiPlayer(afterPon);
    expect(afterNext.players[0].river[1]?.isRiichiDiscard).toBe(true);
    expect(afterNext.players[0].pendingRiichiSidewaysDiscard).toBe(false);

    const afterLater = discardNextForRiichiPlayer(afterNext);
    expect(afterLater.players[0].river[2]?.isRiichiDiscard).not.toBe(true);
  });

  it('立直宣言牌被吃后，同样让下一张实际弃牌横置', () => {
    const afterDiscard = discardDeclaration(riichiDiscardState(12, hand([13, 14, 0, 1, 2, 3, 4, 5, 18, 19, 20, 21, 22], 100)));
    const afterChi = executeChi(afterDiscard, 1, 0);
    expect(afterChi.players[0].pendingRiichiSidewaysDiscard).toBe(true);

    const afterNext = discardNextForRiichiPlayer(afterChi);
    expect(afterNext.players[0].river[1]?.isRiichiDiscard).toBe(true);
    expect(afterNext.players[0].pendingRiichiSidewaysDiscard).toBe(false);
  });

  it('立直宣言牌被明杠后，同样让下一张实际弃牌横置', () => {
    const afterDiscard = discardDeclaration(riichiDiscardState(12, hand([12, 12, 12, 0, 1, 2, 3, 4, 5, 18, 19, 20, 21], 100)));
    const nonWinningKanState = {
      ...afterDiscard,
      deadWall: [createTile(33, 9999), ...afterDiscard.deadWall.slice(1)],
    };
    const afterKan = executeKan(nonWinningKanState, 1, 'minkan');
    expect(afterKan.players[0].pendingRiichiSidewaysDiscard).toBe(true);

    const afterNext = discardNextForRiichiPlayer(afterKan);
    expect(afterNext.players[0].river[1]?.isRiichiDiscard).toBe(true);
    expect(afterNext.players[0].pendingRiichiSidewaysDiscard).toBe(false);
  });

  it('顺延横牌再次被碰后继续顺延到再下一张弃牌', () => {
    const afterDeclaration = discardDeclaration(riichiDiscardState(12, hand([12, 12, 0, 1, 2, 3, 4, 5, 18, 19, 20, 21, 22], 100)));
    const afterFirstPon = executePon(afterDeclaration, 1);
    const readyForSecondCall = {
      ...afterFirstPon,
      players: afterFirstPon.players.map((player) => player.id === 2
        ? { ...player, hand: hand([1, 1, 3, 4, 5, 6, 7, 8, 18, 19, 20, 21, 22], 300) }
        : player),
    };
    const afterSidewaysDiscard = discardNextForRiichiPlayer(readyForSecondCall);
    const afterSecondPon = executePon(afterSidewaysDiscard, 2);
    expect(afterSecondPon.players[0].river[1]).toMatchObject({ isRiichiDiscard: true, claimed: true, claimedBy: 2 });
    expect(afterSecondPon.players[0].pendingRiichiSidewaysDiscard).toBe(true);

    const afterNext = discardNextForRiichiPlayer(afterSecondPon);
    expect(afterNext.players[0].river[2]?.isRiichiDiscard).toBe(true);
  });

  it('本局结算时清除尚未落定的横牌顺延状态', () => {
    const state = riichiDiscardState(12, hand([0, 1, 2, 3, 4, 5, 18, 19, 20, 21, 22, 23, 27], 100));
    state.players[0].pendingRiichiSidewaysDiscard = true;
    expect(settleExhaustiveDraw(state).players.every((player) => player.pendingRiichiSidewaysDiscard === false)).toBe(true);
  });
});
