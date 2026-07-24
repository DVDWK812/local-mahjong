import type { Tile, TileId } from './types';
import { ALL_TILE_IDS } from './tileUtils';

export type TileCounts = number[];
export type VisibleTiles = Tile[] | TileCounts;

export function emptyCounts(): TileCounts {
  return Array.from({ length: 34 }, () => 0);
}

export function tilesToCounts(tiles: Tile[]): TileCounts {
  const counts = emptyCounts();
  tiles.forEach((tile) => {
    counts[tile.id] += 1;
  });
  return counts;
}

export function idsToCounts(ids: TileId[]): TileCounts {
  const counts = emptyCounts();
  ids.forEach((id) => {
    counts[id] += 1;
  });
  return counts;
}

export function normalizeCounts(input: Tile[] | TileCounts): TileCounts {
  if (input.length === 34 && typeof input[0] === 'number') return [...input] as TileCounts;
  return tilesToCounts(input as Tile[]);
}

export function remainingCounts(visibleTiles: VisibleTiles): TileCounts {
  const visible = normalizeCounts(visibleTiles);
  return ALL_TILE_IDS.map((id) => Math.max(0, 4 - visible[id]));
}

export function countTiles(counts: TileCounts): number {
  return counts.reduce((sum, count) => sum + count, 0);
}

export function cloneCounts(counts: TileCounts): TileCounts {
  return [...counts];
}
