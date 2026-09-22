import { describe, expect, it } from 'vitest';
import { validateSavedMatch } from './storageValidation';
import { sampleSavedMatch } from './saveTestUtils';
import { createTile } from '../tileUtils';
import type { CallSet, GameState, PlayerId, Tile, TileId } from '../types';

function fixedTile(id: TileId, instanceId: string): Tile {
  return { ...createTile(id, 0), instanceId };
}

function emptyZones(): GameState {
  const state = sampleSavedMatch().gameState!;
  return {
    ...state,
    wall: [],
    deadWall: [],
    doraIndicators: [],
    players: state.players.map((player) => ({ ...player, hand: [], river: [], calls: [], drawnTile: null })),
  };
}

function stateWithCall(type: 'chi' | 'pon' | 'minkan' | 'kakan'): GameState {
  const state = emptyZones();
  const called = fixedTile(type === 'chi' ? 1 : 27, `${type}-called`);
  const ownTiles = type === 'chi'
    ? [fixedTile(0, 'chi-own-0'), fixedTile(2, 'chi-own-2')]
    : Array.from({ length: type === 'pon' ? 2 : 3 }, (_, index) => fixedTile(27, `${type}-own-${index}`));
  const call: CallSet = type === 'chi'
    ? { type: 'chi', tiles: [...ownTiles, called], from: 0, opened: true, calledTile: called, sequence: [0, 1, 2], usedTileIds: [0, 2] }
    : type === 'pon'
      ? { type: 'pon', tiles: [...ownTiles, called], from: 0, opened: true }
      : { type: 'kan', kanType: type, tiles: [...ownTiles, called], from: 0, opened: true, calledTile: type === 'minkan' ? called : undefined };
  return {
    ...state,
    kuikaeForbiddenTileIds: { 1: type === 'chi' ? [0, 2] : [27] },
    players: state.players.map((player) => {
      if (player.id === 0) return { ...player, river: [{ ...called, claimed: true, claimedBy: 1 }] };
      if (player.id === 1) return { ...player, calls: [call] };
      return player;
    }),
  };
}

function savedWithGame(gameState: GameState) {
  const save = sampleSavedMatch();
  return {
    ...save,
    gameState,
    matchState: { ...save.matchState, currentGame: gameState },
  };
}

function addCall(state: GameState, playerId: PlayerId, call: CallSet): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, calls: [...player.calls, call] } : player),
  };
}

describe('storageValidation', () => {
  it('accepts a valid save and rejects structural mismatches', () => {
    expect(() => validateSavedMatch(sampleSavedMatch())).not.toThrow();
    expect(() => validateSavedMatch({ ...sampleSavedMatch(), saveId: '' })).toThrow(/saveId/);
    const mismatched = sampleSavedMatch();
    mismatched.gameState = { ...mismatched.gameState!, dealer: 1 };
    expect(() => validateSavedMatch(mismatched)).toThrow(/dealer/);
  });

  it.each(['chi', 'pon', 'minkan', 'kakan'] as const)('accepts the controlled claimed river alias for %s', (type) => {
    expect(() => validateSavedMatch(savedWithGame(stateWithCall(type)))).not.toThrow();
  });

  it('accepts ankan and an ordinary state without a claimed alias', () => {
    const state = emptyZones();
    const ankan: CallSet = {
      type: 'kan',
      kanType: 'ankan',
      tiles: [0, 1, 2, 3].map((copy) => fixedTile(5, `ankan-${copy}`)),
      from: 1,
      opened: false,
    };
    expect(() => validateSavedMatch(savedWithGame(addCall(state, 1, ankan)))).not.toThrow();
    expect(() => validateSavedMatch(savedWithGame(state))).not.toThrow();
  });

  it('rejects an open call whose claimed river history was removed', () => {
    const state = stateWithCall('pon');
    state.players[0].river = [];
    expect(() => validateSavedMatch(savedWithGame(state))).toThrow(/claimed river alias/i);
  });

  it.each([
    ['hand and live wall', (state: GameState) => {
      const duplicate = fixedTile(3, 'hand-wall');
      state.players[0].hand = [duplicate];
      state.wall = [duplicate];
    }],
    ['hand and dead wall', (state: GameState) => {
      const duplicate = fixedTile(3, 'hand-dead-wall');
      state.players[0].hand = [duplicate];
      state.deadWall = [duplicate, ...Array.from({ length: 13 }, (_, index) => fixedTile(4, `dead-${index + 1}`))];
      state.doraIndicators = [state.deadWall[4], fixedTile(5, 'forged-extra-dora')];
    }],
    ['hand and call', (state: GameState) => {
      const duplicate = state.players[1].calls[0].tiles[0];
      state.players[2].hand = [duplicate];
    }],
    ['two different calls', (state: GameState) => {
      const duplicate = state.players[1].calls[0].tiles[0];
      state.players[2].calls = [{ type: 'pon', tiles: [duplicate, fixedTile(27, 'other-1'), fixedTile(27, 'other-2')], from: 3, opened: true }];
    }],
    ['unclaimed river and call', (state: GameState) => {
      state.players[0].river[0] = { ...state.players[0].river[0], claimed: false, claimedBy: undefined };
    }],
    ['one claimed instance and multiple calls', (state: GameState) => {
      const duplicate = state.players[0].river[0];
      state.players[2].calls = [{ type: 'pon', tiles: [duplicate, fixedTile(27, 'extra-1'), fixedTile(27, 'extra-2')], from: 0, opened: true }];
    }],
  ] as const)('rejects duplicate occupancy between %s', (_label, tamper) => {
    const state = stateWithCall('pon');
    tamper(state);
    expect(() => validateSavedMatch(savedWithGame(state))).toThrow(/tile instance|claimed river alias/i);
  });

  it.each([
    ['claimedBy', (state: GameState) => { state.players[0].river[0].claimedBy = 2; }],
    ['source', (state: GameState) => { state.players[1].calls[0].from = 3; }],
    ['called tile', (state: GameState) => { state.players[1].calls[0].calledTile = fixedTile(27, 'wrong-called'); }],
    ['call type', (state: GameState) => {
      state.players[1].calls[0] = { ...state.players[1].calls[0], type: 'kan', kanType: 'ankan', opened: false };
    }],
  ] as const)('rejects a claimed alias with mismatched %s', (_label, tamper) => {
    const state = stateWithCall('pon');
    tamper(state);
    expect(() => validateSavedMatch(savedWithGame(state))).toThrow(/claimed river alias/i);
  });
});
