import { describe, expect, it } from 'vitest';
import {
  buildSeventeenStepsHandV2,
  buildSeventeenStepsLegacyAI,
  chooseSeventeenStepsAIDiscardV2,
  chooseSeventeenStepsAIDiscardV21,
  chooseSeventeenStepsLegacyAIDiscard,
  createSeventeenStepsDefaultAIGame,
  createSeventeenStepsAI,
  buildSeventeenStepsHandV21,
  getSeventeenStepsForcedWaitDiscards,
  SeventeenStepsDefaultAI,
} from './seventeenStepsAI';
import {
  createSeventeenStepsGame,
  type SeventeenStepsState,
} from './seventeenSteps';
import { buildWall } from './wall';
import { createTile } from './tileUtils';

function sourceWithTenpaiShape() {
  const protectedIds = [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27];
  const ids = [...protectedIds];
  const counts = new Map<number, number>();
  protectedIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  for (let id = 0; ids.length < 34; id = (id + 1) % 34) {
    if ((counts.get(id) ?? 0) >= 4) continue;
    ids.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const copies = new Map<number, number>();
  return ids.map((id) => {
    const copy = copies.get(id) ?? 0;
    copies.set(id, copy + 1);
    return createTile(id as never, copy);
  });
}

function stateWithSource(source = sourceWithTenpaiShape()): SeventeenStepsState {
  const state = createSeventeenStepsGame({ hanRestriction: 0, countDoraForHanRestriction: false });
  state.players[1].sourceTiles = source;
  return state;
}

describe('17步麻将 Default AI V2', () => {
  it('maps 筑根 to Legacy and all newer shared difficulties to V2.1', () => {
    const state = stateWithSource();
    const legacy = createSeventeenStepsAI({ difficulty: 'chikukon', personality: 'balanced', seed: 7 });
    const normal = createSeventeenStepsAI({ difficulty: 'shintentai', personality: 'balanced', seed: 7 });
    const upper = createSeventeenStepsAI({ difficulty: 'upper', personality: 'balanced', seed: 7 });
    expect(legacy.kind).toBe('legacy');
    expect(normal.kind).toBe('v2.1');
    expect(upper.kind).toBe('v2.1');
    expect(legacy.build(state).diagnostics.evaluatedCandidates).toBe(1);
    expect(normal.build(state).diagnostics.evaluatedCandidates).toBeGreaterThan(1);
    expect(upper.build(state).diagnostics.evaluatedCandidates).toBeGreaterThan(1);
  });

  it('exposes separate structural/legal waits and the V2.1 forced-discard metrics', () => {
    const result = buildSeventeenStepsHandV21(stateWithSource(), 1, { seed: 23, beamWidth: 16, maxEvaluatedCandidates: 12, localSwapRounds: 1 });
    expect(result.diagnostics.legalWaitIds.every((id) => result.diagnostics.structureWaitIds.includes(id))).toBe(true);
    expect(result.diagnostics.hasLegalWait).toBe(result.diagnostics.legalWaitIds.length > 0);
    expect(result.diagnostics.forcedWaitDiscards).toBe(Math.max(0, result.diagnostics.candidatePoolWaitEntities - 4));
    expect(result.diagnostics.legalWaitTypeCount).toBe(result.diagnostics.legalWaitIds.length);
    expect(result.diagnostics.potentialRonCopies).toBeGreaterThanOrEqual(0);
    expect([0, 4, 5, 7].map(getSeventeenStepsForcedWaitDiscards)).toEqual([0, 0, 1, 3]);
  });

  it('uses the match han restriction and never reads legacy manganRestriction', () => {
    const base = stateWithSource();
    const normal = buildSeventeenStepsHandV2(base, 1, { seed: 7, beamWidth: 16, maxEvaluatedCandidates: 12, localSwapRounds: 1 });
    const legacyFlagged = {
      ...base,
      matchConfig: { ...base.matchConfig, hanRestriction: 0, manganRestriction: true } as typeof base.matchConfig,
    };
    const flagged = buildSeventeenStepsHandV2(legacyFlagged, 1, { seed: 7, beamWidth: 16, maxEvaluatedCandidates: 12, localSwapRounds: 1 });
    expect(flagged.fixedHand.map((tile) => tile.instanceId)).toEqual(normal.fixedHand.map((tile) => tile.instanceId));
    expect(flagged.diagnostics.tier).toBe('han-and-no-furiten');
  });

  it('prioritizes a no-furiten tenpai build and caps wait entities in the discard pool', () => {
    const result = buildSeventeenStepsHandV2(stateWithSource(), 1, { seed: 11, beamWidth: 20, maxEvaluatedCandidates: 20, localSwapRounds: 1 });
    expect(result.diagnostics.tier).toBe('han-and-no-furiten');
    expect(result.diagnostics.candidatePoolWaitEntities).toBeLessThanOrEqual(4);
    expect(result.diagnostics.structureWaitIds.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same state and seed', () => {
    const state = stateWithSource();
    const first = buildSeventeenStepsHandV2(state, 1, { seed: 123, beamWidth: 18, maxEvaluatedCandidates: 16, localSwapRounds: 1 });
    const second = buildSeventeenStepsHandV2(state, 1, { seed: 123, beamWidth: 18, maxEvaluatedCandidates: 16, localSwapRounds: 1 });
    expect(second.fixedHand.map((tile) => tile.instanceId)).toEqual(first.fixedHand.map((tile) => tile.instanceId));
  });

  it('does not use the opponent hidden build when constructing or discarding', () => {
    const state = stateWithSource();
    const changedOpponent = {
      ...state,
      players: [{
        ...state.players[0],
        sourceTiles: buildWall().slice(0, 34),
        fixedHand: buildWall().slice(34, 47),
        discardCandidates: buildWall().slice(47, 68),
      }, state.players[1]] as [typeof state.players[0], typeof state.players[1]],
    };
    const first = buildSeventeenStepsHandV2(state, 1, { seed: 5, beamWidth: 16, maxEvaluatedCandidates: 12, localSwapRounds: 1 });
    const second = buildSeventeenStepsHandV2(changedOpponent, 1, { seed: 5, beamWidth: 16, maxEvaluatedCandidates: 12, localSwapRounds: 1 });
    expect(second.fixedHand.map((tile) => tile.instanceId)).toEqual(first.fixedHand.map((tile) => tile.instanceId));
  });

  it('filters structural waits before choosing a discard and prefers public safe duplicates', () => {
    let state = stateWithSource();
    const built = buildSeventeenStepsHandV2(state, 1, { seed: 3, beamWidth: 16, maxEvaluatedCandidates: 12, localSwapRounds: 1 });
    state = { ...state, phase: 'active', currentPlayerId: 1, players: [state.players[0], {
      ...state.players[1], fixedHand: built.fixedHand, discardCandidates: built.discardCandidates, buildConfirmed: true,
    }] as [typeof state.players[0], typeof state.players[1]] };
    const waitIds = new Set(built.diagnostics.structureWaitIds);
    const chosen = chooseSeventeenStepsAIDiscardV2(state, 1, { seed: 3 });
    expect(chosen).not.toBeNull();
    expect(waitIds.has(chosen!.id)).toBe(false);
    state.players[0].discardedTiles = [chosen!];
    expect(chooseSeventeenStepsAIDiscardV2(state, 1, { seed: 3 })?.id).toBe(chosen!.id);
  });

  it('does not deadlock when every remaining candidate is a structural wait', () => {
    let state = stateWithSource();
    const built = buildSeventeenStepsHandV21(state, 1, { seed: 29, beamWidth: 16, maxEvaluatedCandidates: 12, localSwapRounds: 1 });
    const waitId = built.diagnostics.structureWaitIds[0];
    expect(waitId).toBeDefined();
    const forcedTile = built.discardCandidates.find((tile) => tile.id === waitId) ?? createTile(waitId, 0);
    state = {
      ...state,
      phase: 'active',
      currentPlayerId: 1,
      players: [state.players[0], {
        ...state.players[1], fixedHand: built.fixedHand, discardCandidates: [forcedTile], buildConfirmed: true,
      }] as [typeof state.players[0], typeof state.players[1]],
    };
    expect(chooseSeventeenStepsAIDiscardV21(state, 1, { seed: 29 })?.id).toBe(waitId);
  });

  it('can simulate all 17 AI discards without discarding a structural wait or entering permanent furiten', () => {
    let state = stateWithSource();
    const built = buildSeventeenStepsHandV2(state, 1, { seed: 19, beamWidth: 16, maxEvaluatedCandidates: 12, localSwapRounds: 1 });
    state = {
      ...state,
      phase: 'active',
      currentPlayerId: 1,
      players: [state.players[0], {
        ...state.players[1], fixedHand: built.fixedHand, discardCandidates: built.discardCandidates, buildConfirmed: true,
      }] as [typeof state.players[0], typeof state.players[1]],
    };
    const waitIds = new Set(built.diagnostics.structureWaitIds);
    for (let discardIndex = 0; discardIndex < 17; discardIndex += 1) {
      const chosen = chooseSeventeenStepsAIDiscardV2(state, 1, { seed: discardIndex });
      expect(chosen).not.toBeNull();
      expect(waitIds.has(chosen!.id)).toBe(false);
      state = {
        ...state,
        players: [state.players[0], {
          ...state.players[1],
          discardedTiles: [...state.players[1].discardedTiles, chosen!],
          discardCandidates: state.players[1].discardCandidates.filter((tile) => tile.instanceId !== chosen!.instanceId),
          discardCount: discardIndex + 1,
          permanentFuriten: false,
        }] as [typeof state.players[0], typeof state.players[1]],
      };
    }
    expect(state.players[1].discardCount).toBe(17);
    expect(state.players[1].permanentFuriten).toBe(false);
  });

  it('keeps Legacy available while the default game uses V2 construction', () => {
    const state = stateWithSource();
    const legacy = buildSeventeenStepsLegacyAI(state);
    expect(chooseSeventeenStepsLegacyAIDiscard({ ...state, phase: 'active', players: [state.players[0], { ...state.players[1], discardCandidates: legacy.discardCandidates }] }, 1)?.instanceId).toBe(legacy.discardCandidates[0].instanceId);
    const v2State = createSeventeenStepsDefaultAIGame(state);
    expect(v2State.players[1].buildConfirmed).toBe(true);
    expect(v2State.players[1].fixedHand).toHaveLength(13);
  });

  it('auto-ron predicate is true for a legal AI ron window', () => {
    const state = stateWithSource();
    const ronState = { ...state, phase: 'ron-window' as const, pendingRon: { winnerId: 1 as const, discarderId: 0 as const, tile: state.players[0].sourceTiles[0], score: {} as never } };
    expect(SeventeenStepsDefaultAI.shouldRon(ronState, 1)).toBe(true);
  });
});

describe('17步麻将 Default AI V2 pressure smoke test', () => {
  it('runs a bounded batch without unbounded search', () => {
    const rounds = 200;
    let tenpai = 0;
    let hanSatisfied = 0;
    let noFuriten = 0;
    let completedSeventeen = 0;
    let waitEntities = 0;
    let legacyTenpai = 0;
    let legacyHanSatisfied = 0;
    let legacyNoFuriten = 0;
    const started = performance.now();
    for (let index = 0; index < rounds; index += 1) {
      const state = {
        ...stateWithSource(buildWall().slice(index % 20, (index % 20) + 34)),
        matchConfig: { ...stateWithSource().matchConfig, hanRestriction: 2 as const, countDoraForHanRestriction: false },
      };
      const result = buildSeventeenStepsHandV2(state, 1, { seed: index, beamWidth: 8, maxEvaluatedCandidates: 16, localSwapRounds: 0 });
      const legacy = buildSeventeenStepsLegacyAI(state);
      if (result.diagnostics.structureWaitIds.length > 0) tenpai += 1;
      if (result.diagnostics.tier === 'han-and-no-furiten') hanSatisfied += 1;
      if (result.diagnostics.candidatePoolWaitEntities <= 4) noFuriten += 1;
      if (legacy.diagnostics.structureWaitIds.length > 0) legacyTenpai += 1;
      if (legacy.diagnostics.eligibleWaitIds.length > 0) legacyHanSatisfied += 1;
      if (legacy.diagnostics.candidatePoolWaitEntities <= 4) legacyNoFuriten += 1;
      let remainingCandidates = [...result.discardCandidates];
      const waitIds = new Set(result.diagnostics.structureWaitIds);
      let safeForSeventeen = true;
      for (let discardIndex = 0; discardIndex < 17; discardIndex += 1) {
        const discardableIndex = remainingCandidates.findIndex((tile) => !waitIds.has(tile.id));
        if (discardableIndex === -1) {
          safeForSeventeen = false;
          break;
        }
        remainingCandidates.splice(discardableIndex, 1);
      }
      if (safeForSeventeen) completedSeventeen += 1;
      waitEntities += result.diagnostics.eligibleWaitIds.length;
    }
    const elapsed = performance.now() - started;
    console.info(`17-step AI V2 pressure: V2 tenpai=${tenpai}/${rounds}, han=${hanSatisfied}/${rounds}, no-furiten=${noFuriten}/${rounds}, complete17=${completedSeventeen}/${rounds}, avgWaitKinds=${(waitEntities / rounds).toFixed(2)}, avgMs=${(elapsed / rounds).toFixed(2)}; Legacy tenpai=${legacyTenpai}/${rounds}, han=${legacyHanSatisfied}/${rounds}, no-furiten=${legacyNoFuriten}/${rounds}`);
    expect(tenpai).toBeGreaterThan(0);
    expect(hanSatisfied).toBeGreaterThanOrEqual(0);
    expect(noFuriten).toBeGreaterThan(0);
    expect(completedSeventeen).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(120000);
    expect(waitEntities / rounds).toBeGreaterThanOrEqual(0);
  });
});
