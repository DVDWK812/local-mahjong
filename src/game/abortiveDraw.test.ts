import { describe, expect, it } from 'vitest';
import { buildAbortiveDrawResult, canDeclareKyuushuKyuuhai, checkAbortiveDrawAfterDiscard, declareKyuushuKyuuhai } from './abortiveDraw';
import { createInitialGameState } from './engine';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, TileId } from './types';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, hand: tiles(ids), river: [] } : player),
  };
}

describe('kyuushu kyuuhai', () => {
  it('allows declaration with nine distinct terminal/honor kinds', () => {
    const state = setHand(createInitialGameState(), 0, [0, 8, 9, 17, 18, 26, 27, 28, 31, 1, 2, 3, 4, 5]);
    expect(canDeclareKyuushuKyuuhai(state, 0)).toBe(true);
  });

  it('rejects eight kinds and repeated nine tiles with fewer than nine kinds', () => {
    expect(canDeclareKyuushuKyuuhai(setHand(createInitialGameState(), 0, [0, 8, 9, 17, 18, 26, 27, 28, 1, 2, 3, 4, 5, 6]), 0)).toBe(false);
    expect(canDeclareKyuushuKyuuhai(setHand(createInitialGameState(), 0, [0, 0, 0, 8, 8, 9, 9, 17, 18, 1, 2, 3, 4, 5]), 0)).toBe(false);
  });

  it('rejects after discard, after calls, and during rinshan draw', () => {
    const base = setHand(createInitialGameState(), 0, [0, 8, 9, 17, 18, 26, 27, 28, 31, 1, 2, 3, 4, 5]);
    expect(canDeclareKyuushuKyuuhai({ ...base, playerDiscardCounts: [1, 0, 0, 0] }, 0)).toBe(false);
    expect(canDeclareKyuushuKyuuhai({ ...base, callsOccurred: true }, 0)).toBe(false);
    expect(canDeclareKyuushuKyuuhai({ ...base, lastDrawSource: 'rinshan' }, 0)).toBe(false);
  });

  it('declares only when the player chooses to declare', () => {
    const base = setHand(createInitialGameState(), 0, [0, 8, 9, 17, 18, 26, 27, 28, 31, 1, 2, 3, 4, 5]);
    expect(base.result).toBeNull();
    const after = declareKyuushuKyuuhai(base, 0);
    expect(after.result?.type).toBe('abortive-draw');
    if (!after.result || after.result.type !== 'abortive-draw') throw new Error('Expected abortive draw result');
    expect(after.result?.reason).toBe('kyuushu-kyuuhai');
  });
});

describe('abortive draw checks after discard', () => {
  it('detects four identical first wind discards', () => {
    const state = {
      ...createInitialGameState(),
      players: createInitialGameState().players.map((player) => ({ ...player, river: [createTile(27, player.id)] })),
    };
    expect(checkAbortiveDrawAfterDiscard(state, 3, createTile(27, 3))?.reason).toBe('suufon-renda');
  });

  it('rejects different winds, dragon tiles, and interrupted first row', () => {
    const base = createInitialGameState();
    const different = { ...base, players: base.players.map((player) => ({ ...player, river: [createTile((27 + player.id) as TileId, 0)] })) };
    const dragons = { ...base, players: base.players.map((player) => ({ ...player, river: [createTile(31, player.id)] })) };
    const interrupted = { ...base, callsOccurred: true, players: base.players.map((player) => ({ ...player, river: [createTile(27, player.id)] })) };
    expect(checkAbortiveDrawAfterDiscard(different, 3, createTile(30, 0))).toBeNull();
    expect(checkAbortiveDrawAfterDiscard(dragons, 3, createTile(31, 0))).toBeNull();
    expect(checkAbortiveDrawAfterDiscard(interrupted, 3, createTile(27, 0))).toBeNull();
  });

  it('detects four riichi and counts double riichi as riichi', () => {
    const state = {
      ...createInitialGameState(),
      players: createInitialGameState().players.map((player, index) => ({
        ...player,
        riichi: true,
        riichiState: { declaredAtTurn: index + 1, ippatsuAvailable: true, kind: index === 3 ? 'double-riichi' as const : 'riichi' as const },
      })),
    };
    expect(checkAbortiveDrawAfterDiscard(state, 3, createTile(1, 0))?.reason).toBe('suucha-riichi');
  });

  it('detects four kans by two or more players but not one player four kans', () => {
    const twoPlayers = {
      ...createInitialGameState(),
      pendingAbortiveDrawAfterFourthKan: true,
    };
    expect(checkAbortiveDrawAfterDiscard(twoPlayers, 1, createTile(1, 0))?.reason).toBe('suukan-sanra');
    const onePlayer = {
      ...createInitialGameState(),
      pendingAbortiveDrawAfterFourthKan: false,
    };
    expect(checkAbortiveDrawAfterDiscard(onePlayer, 0, createTile(1, 0))).toBeNull();
  });

  it('builds an abortive result with zero deltas, honba increment, dealer repeat, and stick carry-over', () => {
    const result = buildAbortiveDrawResult('sanchahou', { triggeringPlayer: 0 });
    expect(result.pointDeltas).toEqual([0, 0, 0, 0]);
    expect(result.honbaIncrement).toBe(1);
    expect(result.dealerContinues).toBe(true);
    expect(result.riichiSticksCarryOver).toBe(true);
  });
});
