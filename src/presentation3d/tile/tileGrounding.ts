import { TABLE_FELT_TOP_Y, TABLE_SURFACE_SPEC } from '../table/tableSurfaceSpec';
import { MAHJONG_TILE_GEOMETRY_SIZE } from './tileGeometry';

/** @deprecated Use TABLE_FELT_TOP_Y; retained for compatibility with existing 3D callers. */
export const TABLE_SURFACE_Y = TABLE_FELT_TOP_Y;
export const TILE_GROUND_EPSILON = TABLE_SURFACE_SPEC.flatEpsilon;
export const STANDING_TILE_GROUND_EPSILON = TABLE_SURFACE_SPEC.standingEpsilon;

export function getTileVerticalHalfExtent(rotationX: number, scale = 1): number {
  return (
    Math.abs(Math.cos(rotationX)) * MAHJONG_TILE_GEOMETRY_SIZE.height
    + Math.abs(Math.sin(rotationX)) * MAHJONG_TILE_GEOMETRY_SIZE.depth
  ) * scale / 2;
}

export function getFlatTileGroundOffset(scale = 1): number {
  return getTileVerticalHalfExtent(0, scale) + TILE_GROUND_EPSILON;
}

export function getStandingTileGroundOffset(scale = 1): number {
  return getTileVerticalHalfExtent(Math.PI / 2, scale) + STANDING_TILE_GROUND_EPSILON;
}

export function getFlatTileCenterY(scale = 1): number {
  return TABLE_FELT_TOP_Y + getFlatTileGroundOffset(scale);
}

export function getStandingTileCenterY(scale = 1): number {
  return TABLE_FELT_TOP_Y + getStandingTileGroundOffset(scale);
}

export function getGroundedTileCenterY(rotationX: number, scale = 1): number {
  return TABLE_FELT_TOP_Y
    + getTileVerticalHalfExtent(rotationX, scale)
    + TILE_GROUND_EPSILON;
}

export function getTileWorldBottomY(
  centerY: number,
  rotationX: number,
  scale = 1,
): number {
  return centerY - getTileVerticalHalfExtent(rotationX, scale);
}

export function getTileScaleGroundingLift(rotationX: number, scale: number): number {
  if (scale <= 1) return 0;
  return getTileVerticalHalfExtent(rotationX, scale)
    - getTileVerticalHalfExtent(rotationX, 1);
}
