import back from '../assets/tiles/back.png';
import m1 from '../assets/tiles/m1.png';
import m2 from '../assets/tiles/m2.png';
import m3 from '../assets/tiles/m3.png';
import m4 from '../assets/tiles/m4.png';
import m5 from '../assets/tiles/m5.png';
import m6 from '../assets/tiles/m6.png';
import m7 from '../assets/tiles/m7.png';
import m8 from '../assets/tiles/m8.png';
import m9 from '../assets/tiles/m9.png';
import p1 from '../assets/tiles/p1.png';
import p2 from '../assets/tiles/p2.png';
import p3 from '../assets/tiles/p3.png';
import p4 from '../assets/tiles/p4.png';
import p5 from '../assets/tiles/p5.png';
import p6 from '../assets/tiles/p6.png';
import p7 from '../assets/tiles/p7.png';
import p8 from '../assets/tiles/p8.png';
import p9 from '../assets/tiles/p9.png';
import placeholder from '../assets/tiles/placeholder.png';
import s1 from '../assets/tiles/s1.png';
import s2 from '../assets/tiles/s2.png';
import s3 from '../assets/tiles/s3.png';
import s4 from '../assets/tiles/s4.png';
import s5 from '../assets/tiles/s5.png';
import s6 from '../assets/tiles/s6.png';
import s7 from '../assets/tiles/s7.png';
import s8 from '../assets/tiles/s8.png';
import s9 from '../assets/tiles/s9.png';
import z1 from '../assets/tiles/z1.png';
import z2 from '../assets/tiles/z2.png';
import z3 from '../assets/tiles/z3.png';
import z4 from '../assets/tiles/z4.png';
import z5 from '../assets/tiles/z5.png';
import z6 from '../assets/tiles/z6.png';
import z7 from '../assets/tiles/z7.png';
import type { Tile, TileId } from './types';

export type TileAssetKey =
  | 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'm7' | 'm8' | 'm9'
  | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7' | 'p8' | 'p9'
  | 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9'
  | 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6' | 'z7';

const TILE_ASSETS: Record<TileAssetKey, string> = {
  m1, m2, m3, m4, m5, m6, m7, m8, m9,
  p1, p2, p3, p4, p5, p6, p7, p8, p9,
  s1, s2, s3, s4, s5, s6, s7, s8, s9,
  z1, z2, z3, z4, z5, z6, z7,
};

const TILE_ALT: Record<TileAssetKey, string> = {
  m1: '一万',
  m2: '二万',
  m3: '三万',
  m4: '四万',
  m5: '五万',
  m6: '六万',
  m7: '七万',
  m8: '八万',
  m9: '九万',
  p1: '一筒',
  p2: '二筒',
  p3: '三筒',
  p4: '四筒',
  p5: '五筒',
  p6: '六筒',
  p7: '七筒',
  p8: '八筒',
  p9: '九筒',
  s1: '一索',
  s2: '二索',
  s3: '三索',
  s4: '四索',
  s5: '五索',
  s6: '六索',
  s7: '七索',
  s8: '八索',
  s9: '九索',
  z1: '东',
  z2: '南',
  z3: '西',
  z4: '北',
  z5: '白',
  z6: '发',
  z7: '中',
};

export function isRedFive(tile: Tile): boolean {
  return tile.red && (tile.id === 4 || tile.id === 13 || tile.id === 22);
}

export function getTileAssetKey(tile: Tile): TileAssetKey {
  return getTileAssetKeyById(tile.id);
}

export function getTileImage(tile: Tile): string {
  return TILE_ASSETS[getTileAssetKey(tile)] ?? placeholder;
}

export function getTileBackImage(): string {
  return back;
}

export function getTilePlaceholderImage(): string {
  return placeholder;
}

export function getTileAlt(tile: Tile): string {
  const baseAlt = TILE_ALT[getTileAssetKey(tile)] ?? '未知牌';
  return isRedFive(tile) ? `赤${baseAlt}` : baseAlt;
}

export function getTileAssetKeyById(id: TileId): TileAssetKey {
  if (id <= 8) return `m${id + 1}` as TileAssetKey;
  if (id <= 17) return `p${id - 8}` as TileAssetKey;
  if (id <= 26) return `s${id - 17}` as TileAssetKey;
  return `z${id - 26}` as TileAssetKey;
}

export function getTileImageById(id: TileId): string {
  return TILE_ASSETS[getTileAssetKeyById(id)] ?? placeholder;
}

export function getTileAltById(id: TileId): string {
  return TILE_ALT[getTileAssetKeyById(id)] ?? '未知牌';
}
