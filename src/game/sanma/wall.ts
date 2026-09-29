import type { Tile, TileId } from '../types';
import { getTileRank, getTileSuit } from '../tileUtils';

export const SANMA_TILE_IDS = Object.freeze([0, ...Array.from({ length: 26 }, (_, i) => i + 8)] as TileId[]);
export const isSanmaTile = (id: number): id is TileId => id === 0 || id >= 8 && id <= 33 && Number.isInteger(id);
export function nextRandom(state: number): number {
  let n = state >>> 0 || 0x6d2b79f5; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return n >>> 0;
}
export function createSanmaTiles(prefix: string): Tile[] {
  return SANMA_TILE_IDS.flatMap(id => Array.from({ length: 4 }, (_, copy) => ({
    id, suit: getTileSuit(id), rank: getTileRank(id), red: (id === 13 || id === 22) && copy === 0, instanceId: `${prefix}:${id}:${copy}`,
  })));
}
/** tiles is a canonical catalogue, not a second ownership zone. All zones own physical indices. */
export interface SanmaWall { tiles: Tile[]; live: number[]; replacements: number[]; indicators: number[]; used: number[]; replacementCount: number }
export function createSanmaWall(seed: number, round: number): SanmaWall {
  const tiles = createSanmaTiles(`s${seed}:r${round}`);
  let random = nextRandom(seed ^ Math.imul(round + 1, 0x9e3779b9));
  for (let i = tiles.length - 1; i > 0; i--) { random = nextRandom(random); const j = random % (i + 1); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  return { tiles, live: Array.from({ length: 94 }, (_, i) => i), replacements: [94, 95, 96, 97], indicators: Array.from({ length: 10 }, (_, i) => 98 + i), used: [], replacementCount: 0 };
}
export function takeLive(wall: SanmaWall): number | undefined {
  const index = wall.live.shift(); if (index !== undefined) wall.used.push(index); return index;
}
export const canReplace = (wall: SanmaWall) => wall.live.length > 0 && wall.replacementCount < 8 && wall.replacements.length === 4;
export function takeReplacement(wall: SanmaWall): number | undefined {
  if (!canReplace(wall)) return undefined;
  const index = wall.replacements.shift()!;
  wall.replacements.push(wall.live.pop()!); wall.used.push(index); wall.replacementCount++; return index;
}
export function sanmaDora(id: TileId): TileId {
  if (id === 0) return 8;
  if (id === 8) return 0;
  if (id < 27) return (Math.floor(id / 9) * 9 + (id + 1) % 9) as TileId;
  return (id < 31 ? 27 + (id - 27 + 1) % 4 : 31 + (id - 31 + 1) % 3) as TileId;
}
export function assertWall(wall: SanmaWall): void {
  const indices = [...wall.live, ...wall.replacements, ...wall.indicators, ...wall.used];
  if (wall.tiles.length !== 108 || indices.length !== 108 || new Set(indices).size !== 108 || indices.some(i => !Number.isInteger(i) || i < 0 || i >= 108)) throw new Error('三人牌墙实体索引不守恒');
  if (wall.indicators.length !== 10 || wall.replacements.length !== 4 || wall.replacementCount < 0 || wall.replacementCount > 8) throw new Error('三人保留边界损坏');
  if (new Set(wall.tiles.map(t => t.instanceId)).size !== 108) throw new Error('牌实例重复');
  for (const id of SANMA_TILE_IDS) if (wall.tiles.filter(t => t.id === id).length !== 4) throw new Error('三人牌种数量损坏');
  if (wall.tiles.some(t => !isSanmaTile(t.id) || t.suit !== getTileSuit(t.id) || t.rank !== getTileRank(t.id)) || wall.tiles.filter(t => t.red).length !== 2
    || [13, 22].some(id => wall.tiles.filter(t => t.id === id && t.red).length !== 1)) throw new Error('三人牌库或赤牌损坏');
}
