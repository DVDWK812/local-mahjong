import type { Tile, TileId } from './types';
import { filterKuikaeDiscardTiles } from './kuikae';
import { ALL_TILE_IDS, tileLabel } from './tileUtils';
import { cloneCounts, countTiles, normalizeCounts, remainingCounts, tilesToCounts, type TileCounts, type VisibleTiles } from './tileCounts';

export interface ShantenResult {
  standard: number;
  sevenPairs: number;
  thirteenOrphans: number;
  best: number;
}

export interface UkeireTile {
  id: TileId;
  label: string;
  remaining: number;
  shanten: number;
}

export interface DiscardRecommendation {
  tileId: TileId;
  label: string;
  shanten: number;
  ukeireCount: number;
  ukeireTiles: UkeireTile[];
  reasons: string[];
}

const TERMINAL_OR_HONOR_IDS = new Set<TileId>([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
const ORPHAN_IDS = [...TERMINAL_OR_HONOR_IDS];

export function standardShanten(hand: Tile[] | TileCounts): number {
  const counts = normalizeCounts(hand);
  let best = 8;

  function evaluate(melds: number, pairs: number, taatsu: number) {
    const cappedTaatsu = Math.min(taatsu, 4 - melds);
    best = Math.min(best, 8 - melds * 2 - cappedTaatsu - Math.min(1, pairs));
  }

  function removeTaatsu(work: TileCounts, start: number, melds: number, pairs: number, taatsu: number) {
    let found = false;
    for (let i = start; i < 34; i += 1) {
      if (work[i] >= 2) {
        found = true;
        work[i] -= 2;
        removeTaatsu(work, i, melds, pairs + 1, taatsu + 1);
        work[i] += 2;
      }
      if (i <= 24 && i % 9 <= 7 && work[i] > 0 && work[i + 1] > 0) {
        found = true;
        work[i] -= 1;
        work[i + 1] -= 1;
        removeTaatsu(work, i, melds, pairs, taatsu + 1);
        work[i] += 1;
        work[i + 1] += 1;
      }
      if (i <= 24 && i % 9 <= 6 && work[i] > 0 && work[i + 2] > 0) {
        found = true;
        work[i] -= 1;
        work[i + 2] -= 1;
        removeTaatsu(work, i, melds, pairs, taatsu + 1);
        work[i] += 1;
        work[i + 2] += 1;
      }
    }
    if (!found) evaluate(melds, pairs, taatsu);
  }

  function removeMelds(work: TileCounts, start: number, melds: number, pairs: number, taatsu: number) {
    let found = false;
    for (let i = start; i < 34; i += 1) {
      if (work[i] >= 3) {
        found = true;
        work[i] -= 3;
        removeMelds(work, i, melds + 1, pairs, taatsu);
        work[i] += 3;
      }
      if (i <= 24 && i % 9 <= 6 && work[i] > 0 && work[i + 1] > 0 && work[i + 2] > 0) {
        found = true;
        work[i] -= 1;
        work[i + 1] -= 1;
        work[i + 2] -= 1;
        removeMelds(work, i, melds + 1, pairs, taatsu);
        work[i] += 1;
        work[i + 1] += 1;
        work[i + 2] += 1;
      }
    }
    removeTaatsu(work, 0, melds, pairs, taatsu);
    if (!found) evaluate(melds, pairs, taatsu);
  }

  removeMelds(cloneCounts(counts), 0, 0, 0, 0);

  for (let i = 0; i < 34; i += 1) {
    if (counts[i] >= 2) {
      const work = cloneCounts(counts);
      work[i] -= 2;
      removeMelds(work, 0, 0, 1, 0);
    }
  }

  return best;
}

export function sevenPairsShanten(hand: Tile[] | TileCounts): number {
  const counts = normalizeCounts(hand);
  const pairs = counts.filter((count) => count >= 2).length;
  const unique = counts.filter((count) => count > 0).length;
  return 6 - pairs + Math.max(0, 7 - unique);
}

export function thirteenOrphansShanten(hand: Tile[] | TileCounts): number {
  const counts = normalizeCounts(hand);
  const uniqueOrphans = ORPHAN_IDS.filter((id) => counts[id] > 0).length;
  const hasPair = ORPHAN_IDS.some((id) => counts[id] >= 2);
  return 13 - uniqueOrphans - (hasPair ? 1 : 0);
}

export function shanten(hand: Tile[] | TileCounts): ShantenResult {
  const standard = standardShanten(hand);
  const sevenPairs = sevenPairsShanten(hand);
  const thirteenOrphans = thirteenOrphansShanten(hand);
  return {
    standard,
    sevenPairs,
    thirteenOrphans,
    best: Math.min(standard, sevenPairs, thirteenOrphans),
  };
}

export function ukeire(hand: Tile[] | TileCounts, visibleTiles: VisibleTiles): UkeireTile[] {
  const counts = normalizeCounts(hand);
  const current = shanten(counts).best;
  const remaining = remainingCounts(visibleTiles);

  return ALL_TILE_IDS.flatMap((id) => {
    if (remaining[id] <= 0 || countTiles(counts) >= 14) return [];
    const next = cloneCounts(counts);
    next[id] += 1;
    const nextShanten = shanten(next).best;
    return nextShanten < current
      ? [{ id, label: tileLabel(id), remaining: remaining[id], shanten: nextShanten }]
      : [];
  });
}

export function ukeireCount(hand: Tile[] | TileCounts, visibleTiles: VisibleTiles): number {
  return ukeire(hand, visibleTiles).reduce((sum, tile) => sum + tile.remaining, 0);
}

export function recommendDiscards(hand: Tile[], visibleTiles: VisibleTiles, forbiddenTileIds: readonly TileId[] = []): DiscardRecommendation[] {
  const uniqueDiscardIds = [...new Set(filterKuikaeDiscardTiles(hand, forbiddenTileIds).map((tile) => tile.id))] as TileId[];
  const recommendations = uniqueDiscardIds.map((tileId) => {
    const afterDiscard = [...hand];
    const index = afterDiscard.findIndex((tile) => tile.id === tileId);
    afterDiscard.splice(index, 1);
    const waits = ukeire(afterDiscard, visibleTiles);
    const result = shanten(afterDiscard);
    return {
      tileId,
      label: tileLabel(tileId),
      shanten: result.best,
      ukeireCount: waits.reduce((sum, tile) => sum + tile.remaining, 0),
      ukeireTiles: waits,
      reasons: recommendationReasons(tileId, hand, afterDiscard, waits.length),
    };
  });

  return recommendations
    .sort((a, b) => {
      if (a.shanten !== b.shanten) return a.shanten - b.shanten;
      if (a.ukeireCount !== b.ukeireCount) return b.ukeireCount - a.ukeireCount;
      const middleDiff = discardMiddlePenalty(a.tileId) - discardMiddlePenalty(b.tileId);
      if (middleDiff !== 0) return middleDiff;
      return structureBreakPenalty(a.tileId, hand) - structureBreakPenalty(b.tileId, hand);
    })
    .slice(0, 3);
}

function discardMiddlePenalty(id: TileId): number {
  if (id >= 27) return 0;
  const rank = (id % 9) + 1;
  if (rank === 1 || rank === 9) return 0;
  if (rank === 2 || rank === 8) return 1;
  return 2;
}

function structureBreakPenalty(id: TileId, hand: Tile[]): number {
  const counts = tilesToCounts(hand);
  let penalty = counts[id] >= 2 ? 3 : 0;
  if (id < 27) {
    const rankIndex = id % 9;
    if (rankIndex >= 1 && counts[id - 1] > 0) penalty += 1;
    if (rankIndex <= 7 && counts[id + 1] > 0) penalty += 1;
    if (rankIndex >= 2 && counts[id - 2] > 0) penalty += 1;
    if (rankIndex <= 6 && counts[id + 2] > 0) penalty += 1;
  }
  return penalty;
}

function recommendationReasons(tileId: TileId, hand: Tile[], afterDiscard: Tile[], waitKinds: number): string[] {
  const reasons: string[] = [];
  const result = shanten(afterDiscard);
  reasons.push(`打出后 ${formatShanten(result.best)}`);
  reasons.push(waitKinds > 0 ? `形成 ${waitKinds} 种有效牌` : '当前没有直接降向听有效牌');
  if (discardMiddlePenalty(tileId) === 0) reasons.push('优先处理幺九或字牌，保留中张');
  if (structureBreakPenalty(tileId, hand) <= 1) reasons.push('较少破坏对子或顺子搭子');
  return reasons;
}

export function formatShanten(value: number): string {
  if (value < 0) return '和牌';
  if (value === 0) return '听牌';
  return `${value} 向听`;
}
