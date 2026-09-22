import type { SceneTileTransform } from '../coordinates/sceneTransforms';
import type { TileFaceState } from '../tile/tileOrientation';
import type { TileDefinition } from '../tile/tileTextures';
import type { DoraIndicatorSlot } from '../../presentation/table/TablePresentationContract';
import { getFlatTileCenterY } from '../tile/tileGrounding';
import { TILE_SPACING_3D } from '../tile/tileSpacing';

export const DORA_3D_LAYOUT = {
  centerX: -5.5,
  z: -7.4,
  spacing: TILE_SPACING_3D.riverX,
  centerY: getFlatTileCenterY(),
} as const;

export function getDoraIndicatorTransform(
  index: number,
  indicatorCount: number,
): SceneTileTransform {
  const firstX = DORA_3D_LAYOUT.centerX
    - Math.max(0, indicatorCount - 1) * DORA_3D_LAYOUT.spacing / 2;
  return {
    position: [
      firstX + index * DORA_3D_LAYOUT.spacing,
      DORA_3D_LAYOUT.centerY,
      DORA_3D_LAYOUT.z,
    ],
    rotationX: 0,
    rotationY: 0,
  };
}

export function resolveDora3DSlot(slot: DoraIndicatorSlot): Readonly<{
  tile?: TileDefinition;
  faceState: TileFaceState;
}> {
  return slot.state === 'revealed'
    ? { tile: { id: slot.tile.id, red: slot.tile.red }, faceState: 'face-up' }
    : { faceState: 'face-down' };
}
