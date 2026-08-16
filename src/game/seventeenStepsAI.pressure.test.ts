import { describe, expect, it } from 'vitest';
import { buildSeventeenStepsHandV21 } from './seventeenStepsAI';
import { createSeventeenStepsGame } from './seventeenSteps';
import { ALL_TILE_IDS, createTile } from './tileUtils';

interface PressureMetrics {
  total: number;
  tenpaiFound: number;
  legalHanFound: number;
  zeroForcedWaitDiscardFound: number;
  forcedWaitDiscard1: number;
  forcedWaitDiscard2: number;
  forcedWaitDiscard3Plus: number;
  completedWithoutFuriten: number;
  forcedFuritenGames: number;
  discardDeadlockCount: number;
  averageLegalWaitTypes: number;
  averagePotentialRonCopies: number;
  meanBuildTime: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

const pressureEnabled = Boolean((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.RUN_SEVENTEEN_STEPS_PRESSURE);

describe('17步麻将 V2.1 5000局压力测试', () => {
  it('输出构筑、强制振听和性能分布指标', { timeout: 15 * 60 * 1000, skip: !pressureEnabled }, () => {
    const metrics = runPressure(5000);
    console.info(JSON.stringify(metrics));
    expect(metrics.total).toBe(5000);
    expect(metrics.discardDeadlockCount).toBe(0);
    expect(metrics.tenpaiFound).toBeGreaterThan(0);
  });
});

function runPressure(total: number): PressureMetrics {
  const buildTimes: number[] = [];
  let tenpaiFound = 0;
  let legalHanFound = 0;
  let zeroForcedWaitDiscardFound = 0;
  let forcedWaitDiscard1 = 0;
  let forcedWaitDiscard2 = 0;
  let forcedWaitDiscard3Plus = 0;
  let completedWithoutFuriten = 0;
  let forcedFuritenGames = 0;
  let discardDeadlockCount = 0;
  let legalWaitTypes = 0;
  let potentialRonCopies = 0;

  for (let seed = 0; seed < total; seed += 1) {
    const state = createSeventeenStepsGame({ hanRestriction: 2, countDoraForHanRestriction: false });
    state.players[1].sourceTiles = privateSource(seed);
    const started = performance.now();
    const result = buildSeventeenStepsHandV21(state, 1, {
      seed,
      beamWidth: 4,
      maxEvaluatedCandidates: 1,
      localSwapRounds: 0,
    });
    buildTimes.push(performance.now() - started);

    const { diagnostics } = result;
    if (diagnostics.structureWaitIds.length > 0) tenpaiFound += 1;
    if (diagnostics.hasLegalWait) legalHanFound += 1;
    if (diagnostics.forcedWaitDiscards === 0) zeroForcedWaitDiscardFound += 1;
    if (diagnostics.forcedWaitDiscards === 1) forcedWaitDiscard1 += 1;
    if (diagnostics.forcedWaitDiscards === 2) forcedWaitDiscard2 += 1;
    if (diagnostics.forcedWaitDiscards >= 3) forcedWaitDiscard3Plus += 1;
    legalWaitTypes += diagnostics.legalWaitTypeCount;
    potentialRonCopies += diagnostics.potentialRonCopies;

    const waitIds = new Set(diagnostics.structureWaitIds);
    let candidates = [...result.discardCandidates];
    let forced = false;
    let deadlock = false;
    for (let discard = 0; discard < 17; discard += 1) {
      const safeIndex = candidates.findIndex((tile) => !waitIds.has(tile.id));
      if (safeIndex >= 0) {
        candidates.splice(safeIndex, 1);
        continue;
      }
      const forcedIndex = candidates.findIndex((tile) => waitIds.has(tile.id));
      if (forcedIndex < 0) {
        deadlock = true;
        break;
      }
      candidates.splice(forcedIndex, 1);
      forced = true;
    }
    if (deadlock) discardDeadlockCount += 1;
    if (diagnostics.forcedFuriten || forced) forcedFuritenGames += 1;
    else if (!deadlock) completedWithoutFuriten += 1;
  }

  const sorted = [...buildTimes].sort((a, b) => a - b);
  return {
    total,
    tenpaiFound,
    legalHanFound,
    zeroForcedWaitDiscardFound,
    forcedWaitDiscard1,
    forcedWaitDiscard2,
    forcedWaitDiscard3Plus,
    completedWithoutFuriten,
    forcedFuritenGames,
    discardDeadlockCount,
    averageLegalWaitTypes: legalWaitTypes / total,
    averagePotentialRonCopies: potentialRonCopies / total,
    meanBuildTime: buildTimes.reduce((sum, value) => sum + value, 0) / total,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function privateSource(seed: number) {
  const ids = ALL_TILE_IDS.flatMap((id) => [id, id, id, id]);
  let state = (seed + 1) >>> 0;
  for (let index = ids.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 16), 2246822519) >>> 0;
    const swap = state % (index + 1);
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
  }
  const copies = new Map<number, number>();
  return ids.slice(0, 34).map((id) => {
    const copy = copies.get(id) ?? 0;
    copies.set(id, copy + 1);
    return createTile(id, copy);
  });
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
}
