import type { TileOrientation } from './tileOrientation';
import { MAHJONG_TILE_GEOMETRY_SIZE } from './tileGeometry';

export type TileFootprint = Readonly<{ x: number; z: number }>;

export const TILE_PACKING_GAPS = {
  riverInline: MAHJONG_TILE_GEOMETRY_SIZE.width * 0.045,
  riverRow: MAHJONG_TILE_GEOMETRY_SIZE.depth * 0.075,
  meldInline: MAHJONG_TILE_GEOMETRY_SIZE.width * 0.025,
  meldGroup: MAHJONG_TILE_GEOMETRY_SIZE.width * 0.34,
} as const;

export function getFlatTileFootprint(
  orientation: TileOrientation,
  scale = 1,
): TileFootprint {
  const footprint = orientation === 'sideways'
    ? { x: MAHJONG_TILE_GEOMETRY_SIZE.depth, z: MAHJONG_TILE_GEOMETRY_SIZE.width }
    : { x: MAHJONG_TILE_GEOMETRY_SIZE.width, z: MAHJONG_TILE_GEOMETRY_SIZE.depth };
  return { x: footprint.x * scale, z: footprint.z * scale };
}

export function packCenteredFootprints(
  footprints: readonly number[],
  gap: number,
): readonly number[] {
  const total = footprints.reduce((sum, footprint) => sum + footprint, 0)
    + Math.max(0, footprints.length - 1) * gap;
  let edge = -total / 2;
  return footprints.map((footprint) => {
    const center = edge + footprint / 2;
    edge += footprint + gap;
    return center;
  });
}

export function packFromRightEdge(
  footprints: readonly number[],
  rightEdge: number,
  gap: number,
): readonly number[] {
  let edge = rightEdge;
  return footprints.map((footprint) => {
    const center = edge - footprint / 2;
    edge -= footprint + gap;
    return center;
  });
}

export function packFromLeftEdge(
  footprints: readonly number[],
  leftEdge: number,
  gap: number,
): readonly number[] {
  let edge = leftEdge;
  return footprints.map((footprint) => {
    const center = edge + footprint / 2;
    edge += footprint + gap;
    return center;
  });
}

export function packedWidth(footprints: readonly number[], gap: number): number {
  return footprints.reduce((sum, footprint) => sum + footprint, 0)
    + Math.max(0, footprints.length - 1) * gap;
}
