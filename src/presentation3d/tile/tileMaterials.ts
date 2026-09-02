import {
  DoubleSide,
  FrontSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Texture,
} from 'three';
import type { TileVisualDefinition, TileVisualKey } from './tileTextures';

export const MAHJONG_TILE_MATERIAL_BASELINE = {
  bodyColor: '#d8b170',
  bodyRoughness: 0.44,
  bodyMetalness: 0.008,
  faceColor: '#fffaf0',
  redFaceColor: '#fff0e9',
  faceRoughness: 0.34,
  backRoughness: 0.46,
} as const;

export const sharedTileBodyMaterial = new MeshStandardMaterial({
  color: MAHJONG_TILE_MATERIAL_BASELINE.bodyColor,
  roughness: MAHJONG_TILE_MATERIAL_BASELINE.bodyRoughness,
  metalness: MAHJONG_TILE_MATERIAL_BASELINE.bodyMetalness,
  fog: false,
});
sharedTileBodyMaterial.name = 'shared-warm-tile-side-body';

export const sharedRedFiveMarkerMaterial = new MeshStandardMaterial({
  color: '#d32f2f',
  roughness: 0.42,
  metalness: 0,
  fog: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
sharedRedFiveMarkerMaterial.name = 'shared-red-five-marker';

export const sharedSelectedTileOverlayMaterial = new MeshBasicMaterial({
  color: '#ffd568',
  fog: false,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
sharedSelectedTileOverlayMaterial.name = 'shared-selected-tile-overlay';

export const sharedRiichiCandidateOverlayMaterial = new MeshBasicMaterial({
  color: '#78d7bd',
  fog: false,
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
sharedRiichiCandidateOverlayMaterial.name = 'shared-riichi-candidate-overlay';

export const sharedHoveredMatchOverlayMaterial = new MeshBasicMaterial({
  color: '#10211c',
  fog: false,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -3,
});
sharedHoveredMatchOverlayMaterial.name = 'shared-hovered-match-overlay';

export const sharedDoraHighlightMaterial = new MeshBasicMaterial({
  color: '#ffd34f',
  fog: false,
  transparent: true,
  opacity: 0.98,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});
sharedDoraHighlightMaterial.name = 'shared-dora-highlight-frame';

export const sharedRedDoraHighlightMaterial = new MeshBasicMaterial({
  color: '#ff4f58',
  fog: false,
  transparent: true,
  opacity: 0.98,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});
sharedRedDoraHighlightMaterial.name = 'shared-red-dora-highlight-frame';

export const sharedTileHitMaterial = new MeshBasicMaterial({
  fog: false,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
});
sharedTileHitMaterial.name = 'shared-stable-tile-hit-target';

const sharedFaceMaterials = new Map<TileVisualKey, MeshStandardMaterial>();

export function getSharedTileFaceMaterial(
  visual: TileVisualDefinition,
  texture: Texture,
): MeshStandardMaterial {
  const cached = sharedFaceMaterials.get(visual.visualKey);
  if (cached) {
    if (cached.map !== texture) cached.map = texture;
    return cached;
  }

  const material = new MeshStandardMaterial({
    map: texture,
    color: visual.isRed
      ? MAHJONG_TILE_MATERIAL_BASELINE.redFaceColor
      : MAHJONG_TILE_MATERIAL_BASELINE.faceColor,
    roughness:
      visual.kind === 'back'
        ? MAHJONG_TILE_MATERIAL_BASELINE.backRoughness
        : MAHJONG_TILE_MATERIAL_BASELINE.faceRoughness,
    metalness: 0,
    fog: false,
    side: visual.kind === 'back' ? DoubleSide : FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  material.name = `shared-tile-face-${visual.visualKey}`;
  sharedFaceMaterials.set(visual.visualKey, material);
  return material;
}

export function getSharedTileFaceMaterialCount(): number {
  return sharedFaceMaterials.size;
}
