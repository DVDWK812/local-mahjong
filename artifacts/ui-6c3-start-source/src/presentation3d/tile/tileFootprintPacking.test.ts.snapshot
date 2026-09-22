import { describe, expect, it } from 'vitest';
import { MAHJONG_TILE_GEOMETRY_SIZE } from './tileGeometry';
import {
  getFlatTileFootprint,
  packCenteredFootprints,
  packedWidth,
  packFromRightEdge,
  TILE_PACKING_GAPS,
} from './tileFootprintPacking';

describe('3D variable tile-footprint packing', () => {
  it('derives normal and sideways footprints from actual geometry bounds', () => {
    expect(getFlatTileFootprint('upright')).toEqual({
      x: MAHJONG_TILE_GEOMETRY_SIZE.width,
      z: MAHJONG_TILE_GEOMETRY_SIZE.depth,
    });
    expect(getFlatTileFootprint('sideways')).toEqual({
      x: MAHJONG_TILE_GEOMETRY_SIZE.depth,
      z: MAHJONG_TILE_GEOMETRY_SIZE.width,
    });
    expect(getFlatTileFootprint('upright', 0.8)).toEqual({
      x: MAHJONG_TILE_GEOMETRY_SIZE.width * 0.8,
      z: MAHJONG_TILE_GEOMETRY_SIZE.depth * 0.8,
    });
    expect(getFlatTileFootprint('sideways', 0.8)).toEqual({
      x: MAHJONG_TILE_GEOMETRY_SIZE.depth * 0.8,
      z: MAHJONG_TILE_GEOMETRY_SIZE.width * 0.8,
    });
  });

  it('packs mixed orientations tightly without intersecting neighbours', () => {
    const footprints = ['upright', 'sideways', 'upright'].map(
      (orientation) => getFlatTileFootprint(orientation as 'upright' | 'sideways').x,
    );
    const centers = packCenteredFootprints(footprints, TILE_PACKING_GAPS.riverInline);
    for (let index = 1; index < centers.length; index += 1) {
      expect(centers[index] - centers[index - 1])
        .toBeCloseTo(footprints[index - 1] / 2 + TILE_PACKING_GAPS.riverInline + footprints[index] / 2);
    }
    expect(
      centers[centers.length - 1] - centers[0]
      + footprints[0] / 2
      + footprints[footprints.length - 1] / 2,
    )
      .toBeCloseTo(packedWidth(footprints, TILE_PACKING_GAPS.riverInline));
  });

  it('packs meld tiles from a stable right edge', () => {
    const footprints = [1.08, 1.46, 1.08];
    const centers = packFromRightEdge(footprints, 12, TILE_PACKING_GAPS.meldInline);
    expect(centers[0]).toBeCloseTo(12 - footprints[0] / 2);
    expect(centers[0] - centers[1])
      .toBeCloseTo(footprints[0] / 2 + TILE_PACKING_GAPS.meldInline + footprints[1] / 2);
  });
});
