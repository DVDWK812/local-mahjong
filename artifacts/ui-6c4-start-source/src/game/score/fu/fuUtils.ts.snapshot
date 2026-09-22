import type { TileId, Wind } from '../../types';
import type { FuMeld } from './fuRules';

export const DRAGONS = new Set<TileId>([31, 32, 33]);
export const TERMINALS = new Set<TileId>([0, 8, 9, 17, 18, 26]);
export const YAOCHU = new Set<TileId>([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);

export function windToTileId(wind: Wind): TileId {
  return { east: 27, south: 28, west: 29, north: 30 }[wind] as TileId;
}

export function roundFu(fu: number): number {
  return Math.ceil(fu / 10) * 10;
}

export function isPinfuShape(melds: FuMeld[], pair: TileId | null, seatWind: Wind, roundWind: Wind): boolean {
  if (pair === null) return false;
  if (melds.some((meld) => meld.type !== 'sequence')) return false;
  if (DRAGONS.has(pair)) return false;
  if (pair === windToTileId(seatWind) || pair === windToTileId(roundWind)) return false;
  return true;
}

export function pairFu(pair: TileId | null, seatWind: Wind, roundWind: Wind, doubleWindPairFu: boolean): number {
  if (pair === null) return 0;
  let fu = 0;
  if (DRAGONS.has(pair)) fu += 2;
  const seat = pair === windToTileId(seatWind);
  const round = pair === windToTileId(roundWind);
  if (seat) fu += 2;
  if (round) fu += 2;
  if (!doubleWindPairFu && seat && round) return 2;
  return fu;
}

export function meldFu(meld: FuMeld): number {
  if (meld.type === 'sequence') return 0;
  const yaochu = YAOCHU.has(meld.ids[0]);
  if (meld.type === 'triplet') {
    if (meld.open) return yaochu ? 4 : 2;
    return yaochu ? 8 : 4;
  }
  if (meld.open) return yaochu ? 16 : 8;
  return yaochu ? 32 : 16;
}
