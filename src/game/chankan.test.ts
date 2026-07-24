import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './engine';
import { beginKakan, canChankan, declareChankanRon, passChankan } from './kanChecker';
import { createTile } from './tileUtils';
import type { CallSet, GameState, PlayerId, TileId } from './types';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, hand: tiles(ids), drawnTile: null } : player),
  };
}

function kakanState(withRon = true): GameState {
  const ponTiles = tiles([5, 5, 5]);
  const pon: CallSet = { type: 'pon', tiles: ponTiles, from: 3, opened: true, calledTile: ponTiles[0] };
  let state = createInitialGameState();
  state = {
    ...state,
    currentPlayer: 0,
    phase: 'discard',
    deadWall: [createTile(7, 0), createTile(8, 0), createTile(9, 0), createTile(10, 0), createTile(11, 0), ...state.deadWall],
    players: state.players.map((player) => player.id === 0 ? { ...player, calls: [pon] } : player),
  };
  state = setHand(state, 0, [5, 0, 1, 2, 3, 4, 9, 10, 11, 18, 19]);
  state = setHand(state, 1, withRon ? [0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 4, 14, 14] : [0, 2, 4, 6, 8, 10, 12, 16, 18, 20, 22, 24, 26]);
  return state;
}

describe('chankan kakan interruption', () => {
  it('opens a chankan window before upgrading pon to kakan', () => {
    const before = kakanState(true);
    const after = beginKakan(before, 0, 5);
    expect(after.phase).toBe('chankan-window');
    expect(after.pendingKakan?.declarer).toBe(0);
    expect(after.pendingKakan?.eligibleRonPlayers).toContain(1);
    expect(after.players[0].calls[0].type).toBe('pon');
    expect(after.players[0].hand.some((tile) => tile.id === 5)).toBe(true);
    expect(after.doraIndicators).toHaveLength(before.doraIndicators.length);
  });

  it('declares chankan ron, keeps original pon, and does not draw rinshan', () => {
    const window = beginKakan(kakanState(true), 0, 5);
    expect(canChankan(window, 1)).toBe(true);
    const after = declareChankanRon(window, 1);
    expect(after.phase).toBe('round-ended');
    expect(after.result?.type).toBe('ron');
    if (!after.result || after.result.type !== 'ron') throw new Error('Expected ron result');
    expect(after.result.winners.map((win) => win.winner)).toContain(1);
    expect(after.players[0].calls[0].type).toBe('pon');
    expect(after.players[0].calls[0].kanType).toBeUndefined();
    expect(after.players[0].hand.some((tile) => tile.id === 5)).toBe(false);
    expect(after.lastDrawSource).not.toBe('rinshan');
  });

  it('resolves kakan after all eligible players pass', () => {
    const window = beginKakan(kakanState(true), 0, 5);
    const after = passChankan(window, 1);
    expect(after.phase).toBe('discard');
    expect(after.pendingKakan).toBeNull();
    expect(after.players[0].calls[0]).toMatchObject({ type: 'kan', kanType: 'kakan', opened: true, from: 3 });
    expect(after.players[0].calls[0].tiles).toHaveLength(4);
    expect(after.players[0].drawnTile).not.toBeNull();
    expect(after.lastDrawSource).toBe('rinshan');
    expect(after.doraIndicators.length).toBeGreaterThan(window.doraIndicators.length);
  });

  it('directly resolves kakan when no one can rob it', () => {
    const after = beginKakan(kakanState(false), 0, 5);
    expect(after.phase).toBe('discard');
    expect(after.players[0].calls[0]).toMatchObject({ type: 'kan', kanType: 'kakan' });
  });
});
