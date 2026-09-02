import { describe, expect, it } from 'vitest';
import { MAHJONG_TILE_DIMENSIONS } from './tileGeometry';
import {
  GALLERY_ROWS,
  GALLERY_TILE_CENTER_Y,
  SEAT_SAMPLES,
  SEAT_SAMPLE_TILE_CENTER_Y,
} from './tileGalleryData';

describe('3D tile gallery data', () => {
  it('contains all 34 base tile ids exactly once in the first four rows', () => {
    const ids = GALLERY_ROWS.slice(0, 4).flatMap((row) => row.map((item) => item.tile?.id));
    expect(ids).toEqual(Array.from({ length: 34 }, (_, id) => id));
  });

  it('contains all red fives, face-down and sideways samples', () => {
    const variants = GALLERY_ROWS[4];
    expect(variants.filter((item) => item.tile?.red).map((item) => item.tile?.id)).toEqual([4, 13, 22]);
    expect(variants.some((item) => item.faceState === 'face-down')).toBe(true);
    expect(variants.some((item) => item.orientation === 'sideways')).toBe(true);
  });

  it('retains independent samples for all four visual seats', () => {
    expect(Object.keys(SEAT_SAMPLES)).toEqual(['bottom', 'right', 'top', 'left']);
    expect(Object.values(SEAT_SAMPLES).every((samples) => samples.length === 3)).toBe(true);
  });

  it('raises the thicker tiles so their bases remain on the two table surfaces', () => {
    expect(GALLERY_TILE_CENTER_Y - MAHJONG_TILE_DIMENSIONS.height / 2).toBeCloseTo(0.56);
    expect(SEAT_SAMPLE_TILE_CENTER_Y - MAHJONG_TILE_DIMENSIONS.height / 2).toBeCloseTo(0.53);
  });
});
