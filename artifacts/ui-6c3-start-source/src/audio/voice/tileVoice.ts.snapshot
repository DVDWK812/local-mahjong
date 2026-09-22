import type { Tile, TileId } from '../../game/types';

export const TILE_VOICE_KEYS = [
  'tile.m1', 'tile.m2', 'tile.m3', 'tile.m4', 'tile.m5', 'tile.m6', 'tile.m7', 'tile.m8', 'tile.m9',
  'tile.p1', 'tile.p2', 'tile.p3', 'tile.p4', 'tile.p5', 'tile.p6', 'tile.p7', 'tile.p8', 'tile.p9',
  'tile.s1', 'tile.s2', 'tile.s3', 'tile.s4', 'tile.s5', 'tile.s6', 'tile.s7', 'tile.s8', 'tile.s9',
  'tile.z1', 'tile.z2', 'tile.z3', 'tile.z4', 'tile.z5', 'tile.z6', 'tile.z7',
] as const;
export type TileVoiceKey = typeof TILE_VOICE_KEYS[number];

/** Stable tile-id mapping; red fives share the normal five ID and therefore its voice key. */
export function voiceKeyForTile(tile: Pick<Tile, 'id'>): TileVoiceKey {
  return voiceKeyForTileId(tile.id);
}

export function voiceKeyForTileId(id: TileId): TileVoiceKey {
  if (id <= 8) return `tile.m${id + 1}` as TileVoiceKey;
  if (id <= 17) return `tile.p${id - 8}` as TileVoiceKey;
  if (id <= 26) return `tile.s${id - 17}` as TileVoiceKey;
  return `tile.z${id - 26}` as TileVoiceKey;
}
