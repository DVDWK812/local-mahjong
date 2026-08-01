import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './engine';
import { getAIAnkanCandidates } from './ai';
import { getDrawActionState } from './interaction';
import { canAnkan, evaluateRiichiAnkanWaits, executeKan, getLegalAnkanCandidates } from './kanChecker';
import { createTile } from './tileUtils';
import type { GameState, Tile, TileId } from './types';

function makeTiles(ids: TileId[]): Tile[] {
  const copies = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = copies.get(id) ?? 0;
    copies.set(id, copy + 1);
    return { ...createTile(id, copy), instanceId: `stab-006-${id}-${copy}` };
  });
}

function riichiAnkanState(tileId: TileId, remaining: TileId[], drawnInQuad = true, playerId = 0): GameState {
  const hand = makeTiles([tileId, tileId, tileId, tileId, ...remaining]);
  const drawnTile = drawnInQuad ? hand[3] : hand[hand.length - 1];
  const base = createInitialGameState();
  return {
    ...base,
    currentPlayer: playerId as 0 | 1 | 2 | 3,
    phase: 'discard',
    players: base.players.map((player) => player.id === playerId ? {
      ...player,
      hand,
      drawnTile,
      riichi: true,
      riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' },
    } : player),
  };
}

describe('STAB-006 riichi ankan legality differential', () => {
  it('keeps UI candidates, interaction wait check, bottom canAnkan, and execution identical when the drawn tile belongs to the quad', () => {
    const state = riichiAnkanState(0, [3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    const uiCandidates = getDrawActionState(state, 0).ankanCandidates.map((candidate) => candidate.tileId);
    const bottomAllowed = canAnkan(state, 0, 0);

    expect(evaluateRiichiAnkanWaits(state, 0, 0)).toMatchObject({ beforeWaits: [31], afterWaits: [31], waitPreserving: true });
    expect(uiCandidates.includes(0)).toBe(bottomAllowed);
    const after = executeKan(state, 0, 'ankan', 0);
    expect(after !== state).toBe(bottomAllowed);
  });

  it.each(Array.from({ length: 34 }, (_, id) => id as TileId))('keeps all four consumers differential-equivalent for tile type %s', (tileId) => {
    const remaining = unchangedWaitStructure(tileId);
    const state = riichiAnkanState(tileId, remaining);
    const legalIds = getLegalAnkanCandidates(state, 0).map((candidate) => candidate.tileId);
    const uiIds = getDrawActionState(state, 0).ankanCandidates.map((candidate) => candidate.tileId);
    const aiState = riichiAnkanState(tileId, remaining, true, 1);
    const aiIds = getAIAnkanCandidates(aiState, 1).map((candidate) => candidate.tileId);

    expect(canAnkan(state, 0, tileId), `bottom tile ${tileId}`).toBe(true);
    expect(legalIds, `shared tile ${tileId}`).toContain(tileId);
    expect(uiIds, `UI tile ${tileId}`).toEqual(legalIds);
    expect(aiIds, `AI tile ${tileId}`).toContain(tileId);
    expect(executeKan(state, 0, 'ankan', tileId)).not.toBe(state);
  });

  it('rejects a wait-changing quad everywhere and does not mutate state before returning failure', () => {
    const state = riichiAnkanState(0, [1, 2, 3, 4, 5, 6, 7, 8, 8, 8]);
    const before = structuredClone(state);
    const evaluation = evaluateRiichiAnkanWaits(state, 0, 0);
    expect(evaluation.waitPreserving).toBe(false);
    expect(evaluation.beforeWaits).not.toEqual(evaluation.afterWaits);
    expect(getLegalAnkanCandidates(state, 0)).toEqual([]);
    expect(getDrawActionState(state, 0).ankanCandidates).toEqual([]);
    expect(canAnkan(state, 0, 0)).toBe(false);
    expect(executeKan(state, 0, 'ankan', 0)).toBe(state);
    expect(state).toEqual(before);
  });

  it('uses the same shared result when the drawn tile is not one of the four quad tiles', () => {
    const state = riichiAnkanState(27, [0, 1, 2, 9, 10, 11, 18, 19, 20, 31], false);
    const allowed = canAnkan(state, 0, 27);
    expect(getLegalAnkanCandidates(state, 0).some((candidate) => candidate.tileId === 27)).toBe(allowed);
    expect(getDrawActionState(state, 0).ankanCandidates.some((candidate) => candidate.tileId === 27)).toBe(allowed);
    expect(executeKan(state, 0, 'ankan', 27) !== state).toBe(allowed);
  });

  it('returns no legal candidate when the hand has no four identical tiles', () => {
    const state = riichiAnkanState(0, [3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    const hand = makeTiles([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27, 31]);
    state.players[0] = { ...state.players[0], hand, drawnTile: hand[hand.length - 1] };
    expect(getLegalAnkanCandidates(state, 0)).toEqual([]);
    expect(getDrawActionState(state, 0).ankanCandidates).toEqual([]);
    expect(canAnkan(state, 0)).toBe(false);
  });
});

function unchangedWaitStructure(tileId: TileId): TileId[] {
  const groups: TileId[][] = [];
  for (let suit = 0; suit < 3; suit += 1) {
    for (let rank = 0; rank < 7; rank += 1) {
      const group = [(suit * 9 + rank) as TileId, (suit * 9 + rank + 1) as TileId, (suit * 9 + rank + 2) as TileId];
      if (!group.includes(tileId)) groups.push(group);
    }
  }
  const selected = groups.slice(0, 3).flat();
  const singleton = ([31, 32, 33, 30] as TileId[]).find((id) => id !== tileId)!;
  return [...selected, singleton];
}
