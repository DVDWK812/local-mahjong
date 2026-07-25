import type { Suit, Tile, TileId, Wind } from './types';

export const ALL_TILE_IDS: TileId[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 30, 31, 32, 33,
];

export const WIND_ORDER: Wind[] = ['east', 'south', 'west', 'north'];

export function getTileSuit(id: TileId): Suit {
  if (id <= 8) return 'man';
  if (id <= 17) return 'pin';
  if (id <= 26) return 'sou';
  return 'honor';
}

export function getTileRank(id: TileId): number {
  if (id <= 8) return id + 1;
  if (id <= 17) return id - 8;
  if (id <= 26) return id - 17;
  return id - 26;
}

export function createTile(id: TileId, copyIndex: number): Tile {
  const red = (id === 4 || id === 13 || id === 22) && copyIndex === 0;

  return {
    id,
    suit: getTileSuit(id),
    rank: getTileRank(id),
    red,
    instanceId: `${id}-${copyIndex}-${crypto.randomUUID()}`,
  };
}

export function tileLabel(tileOrId: Tile | TileId): string {
  const id = typeof tileOrId === 'number' ? tileOrId : tileOrId.id;

  if (id <= 8) return `${id + 1}万`;
  if (id <= 17) return `${id - 8}筒`;
  if (id <= 26) return `${id - 17}索`;

  return ['东', '南', '西', '北', '白', '发', '中'][id - 27];
}

export function suitClass(tile: Tile): string {
  if (tile.red) return 'tile--red';
  return `tile--${tile.suit}`;
}

export function sortTiles(a: Tile, b: Tile): number {
  if (a.id !== b.id) return a.id - b.id;
  if (a.red !== b.red) return a.red ? -1 : 1;
  return a.instanceId.localeCompare(b.instanceId);
}

export function windLabel(wind: Wind): string {
  return {
    east: '东',
    south: '南',
    west: '西',
    north: '北',
  }[wind];
}
