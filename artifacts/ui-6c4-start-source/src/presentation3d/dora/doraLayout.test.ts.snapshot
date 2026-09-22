import { describe, expect, it } from 'vitest';
import { TABLE_SCENE_LAYOUT } from '../coordinates/sceneTransforms';
import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';
import { createTile } from '../../game/tileUtils';
import { DORA_3D_LAYOUT, getDoraIndicatorTransform, resolveDora3DSlot } from './doraLayout';

describe('UI-5C.3 Dora layout', () => {
  it('centres one or more face-up indicators in an independent north-west lane', () => {
    expect(getDoraIndicatorTransform(0, 1)).toEqual({
      position: [DORA_3D_LAYOUT.centerX, DORA_3D_LAYOUT.centerY, DORA_3D_LAYOUT.z],
      rotationX: 0,
      rotationY: 0,
    });

    const first = getDoraIndicatorTransform(0, 3);
    const middle = getDoraIndicatorTransform(1, 3);
    const last = getDoraIndicatorTransform(2, 3);
    expect(middle.position[0]).toBe(DORA_3D_LAYOUT.centerX);
    expect(last.position[0] - DORA_3D_LAYOUT.centerX)
      .toBeCloseTo(DORA_3D_LAYOUT.centerX - first.position[0]);
    expect(middle.position[0] - first.position[0]).toBeCloseTo(DORA_3D_LAYOUT.spacing);
  });

  it('centres the complete five-slot area and maps hidden slots to backs without identity', () => {
    const first = getDoraIndicatorTransform(0, 5);
    const middle = getDoraIndicatorTransform(2, 5);
    const last = getDoraIndicatorTransform(4, 5);
    expect(middle.position[0]).toBe(DORA_3D_LAYOUT.centerX);
    expect(first.position[0]).toBeLessThan(last.position[0]);
    expect(last.position[0]).toBeLessThan(0);

    const revealed = resolveDora3DSlot({
      index: 0,
      state: 'revealed',
      tile: { ...createTile(4, 0), red: true },
    });
    const hidden = resolveDora3DSlot({ index: 1, state: 'hidden' });
    expect(revealed).toEqual({ tile: { id: 4, red: true }, faceState: 'face-up' });
    expect(hidden).toEqual({ faceState: 'face-down' });
    expect(hidden).not.toHaveProperty('tile');
  });

  it('does not overlap the river or meld lanes', () => {
    const riverOuterZ = TABLE_SCENE_LAYOUT.riverZ
      + TABLE_SCENE_LAYOUT.riverRowSpacing * 2;
    expect(Math.abs(DORA_3D_LAYOUT.z) - riverOuterZ)
      .toBeGreaterThanOrEqual(MAHJONG_TILE_DIMENSIONS.depth);
    expect(TABLE_SCENE_LAYOUT.meldZ - Math.abs(DORA_3D_LAYOUT.z))
      .toBeGreaterThan(MAHJONG_TILE_DIMENSIONS.depth);
  });
});
