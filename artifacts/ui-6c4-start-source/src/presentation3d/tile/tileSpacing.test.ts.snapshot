import { describe, expect, it } from 'vitest';
import { MAHJONG_TILE_DIMENSIONS } from './tileGeometry';
import { TILE_SPACING_3D } from './tileSpacing';

describe('3D tile spacing baseline', () => {
  it('derives tight hand, stable river, meld, and drawn gaps from physical dimensions', () => {
    expect(TILE_SPACING_3D.standingHand / MAHJONG_TILE_DIMENSIONS.width).toBeCloseTo(1.03);
    expect(TILE_SPACING_3D.drawnGap).toBeGreaterThan(MAHJONG_TILE_DIMENSIONS.width * 0.3);
    expect(TILE_SPACING_3D.riverX).toBeGreaterThan(MAHJONG_TILE_DIMENSIONS.width);
    expect(TILE_SPACING_3D.riverX).toBeLessThan(MAHJONG_TILE_DIMENSIONS.depth);
    expect(TILE_SPACING_3D.riverZ).toBeGreaterThan(MAHJONG_TILE_DIMENSIONS.depth);
    expect(TILE_SPACING_3D.meldTile).toBeGreaterThan(MAHJONG_TILE_DIMENSIONS.depth);
    expect(TILE_SPACING_3D.meldGroup).toBeGreaterThan(TILE_SPACING_3D.meldTile * 3);
  });
});
