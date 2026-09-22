import { describe, expect, it } from 'vitest';
import { TABLE_FELT_TOP_Y, TABLE_SURFACE_SPEC } from '../table/tableSurfaceSpec';
import { MAHJONG_TILE_GEOMETRY_SIZE } from './tileGeometry';
import {
  getFlatTileCenterY,
  getFlatTileGroundOffset,
  getGroundedTileCenterY,
  getStandingTileCenterY,
  getStandingTileGroundOffset,
  getTileScaleGroundingLift,
  getTileVerticalHalfExtent,
  getTileWorldBottomY,
  STANDING_TILE_GROUND_EPSILON,
  TABLE_SURFACE_Y,
  TILE_GROUND_EPSILON,
} from './tileGrounding';

describe('3D tile grounding', () => {
  it('places flat and standing tile geometry on the one authoritative table surface', () => {
    expect(TABLE_SURFACE_Y).toBe(TABLE_FELT_TOP_Y);
    expect(TABLE_FELT_TOP_Y).toBeCloseTo(
      TABLE_SURFACE_SPEC.feltCenterY + TABLE_SURFACE_SPEC.feltThickness / 2,
    );
    expect(getFlatTileCenterY() - MAHJONG_TILE_GEOMETRY_SIZE.height / 2)
      .toBeCloseTo(TABLE_FELT_TOP_Y + TILE_GROUND_EPSILON);
    expect(getStandingTileCenterY() - MAHJONG_TILE_GEOMETRY_SIZE.depth / 2)
      .toBeCloseTo(TABLE_FELT_TOP_Y + STANDING_TILE_GROUND_EPSILON);
    expect(getFlatTileGroundOffset()).toBeCloseTo(MAHJONG_TILE_GEOMETRY_SIZE.height / 2 + TILE_GROUND_EPSILON);
    expect(getStandingTileGroundOffset()).toBeCloseTo(
      MAHJONG_TILE_GEOMETRY_SIZE.depth / 2 + STANDING_TILE_GROUND_EPSILON,
    );
    expect(getTileVerticalHalfExtent(Math.PI / 2)).toBeCloseTo(MAHJONG_TILE_GEOMETRY_SIZE.depth / 2);
    expect(getTileWorldBottomY(getFlatTileCenterY(), 0))
      .toBeCloseTo(TABLE_FELT_TOP_Y + TILE_GROUND_EPSILON);
    expect(getTileWorldBottomY(getStandingTileCenterY(), Math.PI / 2))
      .toBeCloseTo(TABLE_FELT_TOP_Y + STANDING_TILE_GROUND_EPSILON);
  });

  it('compensates interaction scale so the lowest point stays grounded', () => {
    expect(getTileScaleGroundingLift(0, 1.035))
      .toBeCloseTo(MAHJONG_TILE_GEOMETRY_SIZE.height / 2 * 0.035);
    expect(getTileScaleGroundingLift(Math.PI / 2, 1.012))
      .toBeCloseTo(MAHJONG_TILE_GEOMETRY_SIZE.depth / 2 * 0.012);
    expect(getTileScaleGroundingLift(Math.PI / 2, 1)).toBe(0);
  });

  it('matches the frozen interpolation baseline and grounds every intermediate pitch', () => {
    const halfwayRotation = Math.PI / 4;
    const linearlyInterpolatedCenter = (getStandingTileCenterY() + getFlatTileCenterY()) / 2;
    expect(getTileWorldBottomY(linearlyInterpolatedCenter, halfwayRotation))
      .toBeCloseTo(1.1316800089587027, 12);
    expect(getTileWorldBottomY(getGroundedTileCenterY(halfwayRotation), halfwayRotation))
      .toBeCloseTo(TABLE_FELT_TOP_Y + TILE_GROUND_EPSILON);
  });
});
