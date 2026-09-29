import { findWinningShapes } from '../scoreCalculator';
import { standardShanten, sevenPairsShanten, thirteenOrphansShanten } from '../shanten';
import { getTileRank, getTileSuit } from '../tileUtils';
import type { Tile, TileId } from '../types';
import { SANMA_TILE_IDS } from './wall';
import type { SanmaMeld } from './types';

export const theoreticalTile = (id: TileId): Tile => ({ id, rank: getTileRank(id), suit: getTileSuit(id), red: false, instanceId: `wait:${id}` });
export const isOrphan = (id: TileId) => id >= 27 || id % 9 === 0 || id % 9 === 8;
export const closedHand = (melds: readonly SanmaMeld[]) => melds.every(m => m.kind === 'ankan');
export function winningShape(hand: Tile[], meldCount: number): boolean {
  return hand.length === 14 - meldCount * 3 && findWinningShapes(hand).some(s => s.type === 'standard' ? s.melds.length + meldCount === 4 : meldCount === 0);
}
/** Availability does not require a yaku. A physical fifth copy cannot be a wait. */
export function sanmaWaits(hand: Tile[], meldTiles: Tile[][] = []): TileId[] {
  if (hand.length !== 13 - meldTiles.length * 3) return [];
  const own = [...hand, ...meldTiles.flat()];
  return SANMA_TILE_IDS.filter(id => own.filter(t => t.id === id).length < 4 && winningShape([...hand, theoreticalTile(id)], meldTiles.length));
}
const distanceCache = new Map<string, number>();
/** For open hands, complete fixed sets are supplied to the existing shape distance routine. */
export function sanmaShanten(hand: Tile[], meldTiles: Tile[][] = []): number {
  const key = `${hand.map(t => t.id).sort((a, b) => a - b).join(',')}/${meldTiles.map(m => m[0].id).sort((a, b) => a - b).join(',')}`;
  const cached = distanceCache.get(key); if (cached !== undefined) return cached;
  const value = meldTiles.length ? standardShanten(hand, meldTiles.length) : Math.min(standardShanten(hand), sevenPairsShanten(hand), thirteenOrphansShanten(hand));
  if (distanceCache.size > 20000) distanceCache.clear(); distanceCache.set(key, value); return value;
}
export function sanmaUkeire(hand: Tile[], meldTiles: Tile[][], visible: Tile[]) {
  const before = sanmaShanten(hand, meldTiles);
  return SANMA_TILE_IDS.flatMap(id => {
    const remaining = Math.max(0, 4 - visible.filter(t => t.id === id).length);
    return remaining && sanmaShanten([...hand, theoreticalTile(id)], meldTiles) < before ? [{ id, remaining }] : [];
  });
}
