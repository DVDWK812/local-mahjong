import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './engine';
import { getVisibleTileCounts } from './visibility';
import { getVisibleCountsForPlayer } from './ai';
import { createTile } from './tileUtils';
import type { CallSet, GameState, Tile, TileId } from './types';

function tile(id: TileId, instanceId: string, red = false): Tile {
  return { ...createTile(id, 0), instanceId, red };
}

function calledState(call: CallSet, riverTile: Tile): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    doraIndicators: [],
    players: base.players.map((player) => ({
      ...player,
      hand: [],
      drawnTile: null,
      river: player.id === 0 ? [{ ...riverTile, claimed: true, claimedBy: 1 }] : [],
      calls: player.id === 1 ? [call] : [],
    })),
  };
}

function countFor(state: GameState, id: TileId) {
  return getVisibleTileCounts(state).find((count) => count.id === id)!;
}

describe('STAB-004 unique public tile instance counts', () => {
  it('counts a chi claimed river tile only once across river history and the call', () => {
    const called = tile(3, 'chi-called');
    const state = calledState({
      type: 'chi',
      tiles: [tile(2, 'chi-2'), called, tile(4, 'chi-4')],
      from: 0,
      opened: true,
      calledTile: called,
      sequence: [2, 3, 4],
      usedTileIds: [2, 4],
    }, called);

    expect(countFor(state, 3)).toMatchObject({ visible: 1, remaining: 3 });
    expect(countFor(state, 3).instances).toEqual([{
      instanceId: 'chi-called',
      tileId: 3,
      red: false,
      sourceRegions: ['player-0-river', 'player-1-call-0'],
    }]);
  });

  it('counts three distinct pon instances while deduplicating the claimed history alias', () => {
    const called = tile(5, 'pon-called');
    const state = calledState({
      type: 'pon',
      tiles: [called, tile(5, 'pon-hand-1'), tile(5, 'pon-hand-2')],
      from: 0,
      opened: true,
      calledTile: called,
    }, called);

    expect(countFor(state, 5)).toMatchObject({ visible: 3, remaining: 1 });
    expect(countFor(state, 5).instances.map((instance) => instance.instanceId)).toEqual(['pon-called', 'pon-hand-1', 'pon-hand-2']);
  });

  it('counts four distinct minkan instances and never produces a negative remaining count', () => {
    const called = tile(7, 'minkan-called');
    const state = calledState({
      type: 'kan',
      kanType: 'minkan',
      tiles: [called, tile(7, 'minkan-hand-1'), tile(7, 'minkan-hand-2'), tile(7, 'minkan-hand-3')],
      from: 0,
      opened: true,
      calledTile: called,
    }, called);

    expect(countFor(state, 7)).toMatchObject({ visible: 4, remaining: 0 });
    expect(getVisibleTileCounts(state).every((count) => count.visible <= 4 && count.remaining >= 0)).toBe(true);
  });

  it('counts red and normal five by tile.id while retaining instance-level uniqueness', () => {
    const redCalled = tile(4, 'red-five-called', true);
    const state = calledState({
      type: 'pon',
      tiles: [redCalled, tile(4, 'normal-five-1'), tile(4, 'normal-five-2')],
      from: 0,
      opened: true,
      calledTile: redCalled,
    }, redCalled);

    expect(countFor(state, 4)).toMatchObject({ visible: 3, remaining: 1 });
    expect(countFor(state, 4).instances.map((instance) => [instance.instanceId, instance.red])).toEqual([
      ['red-five-called', true],
      ['normal-five-1', false],
      ['normal-five-2', false],
    ]);
  });

  it('caps visible and remaining counts even when a corrupted state exposes a fifth distinct instance', () => {
    const base = calledState({
      type: 'kan',
      kanType: 'minkan',
      tiles: [tile(8, 'cap-1'), tile(8, 'cap-2'), tile(8, 'cap-3'), tile(8, 'cap-4')],
      from: 0,
      opened: true,
    }, tile(8, 'cap-1'));
    base.doraIndicators = [tile(8, 'cap-5')];

    expect(countFor(base, 8)).toMatchObject({ visible: 4, remaining: 0 });
    expect(countFor(base, 8).instances).toHaveLength(5);
  });

  it('keeps UI and AI visible counts on the same implementation for every player', () => {
    const called = tile(5, 'shared-called');
    const state = calledState({
      type: 'pon',
      tiles: [called, tile(5, 'shared-1'), tile(5, 'shared-2')],
      from: 0,
      opened: true,
      calledTile: called,
    }, called);
    state.players[2].hand = [tile(5, 'viewer-private')];

    expect(getVisibleCountsForPlayer(state, 2)).toEqual(getVisibleTileCounts(state, 2).map((count) => count.visible));
  });
});
