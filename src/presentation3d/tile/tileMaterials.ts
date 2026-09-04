import {
  DoubleSide,
  FrontSide,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type ColorRepresentation,
  type Texture,
} from 'three';
import type { TileVisualDefinition, TileVisualKey } from './tileTextures';
import { MAHJONG_TILE_ANATOMY } from './tileGeometry';

export const MAHJONG_TILE_MATERIAL_BASELINE = {
  ivoryColor: '#f2e6c9',
  ivoryRoughness: 0.38,
  ivoryMetalness: 0.006,
  backColor: '#17483f',
  backBodyRoughness: 0.43,
  faceColor: '#fffaf0',
  redFaceColor: '#fff0e9',
  faceRoughness: 0.34,
  backRoughness: 0.46,
} as const;

export const sharedTileIvoryBodyMaterial = new MeshStandardMaterial({
  color: MAHJONG_TILE_MATERIAL_BASELINE.ivoryColor,
  roughness: MAHJONG_TILE_MATERIAL_BASELINE.ivoryRoughness,
  metalness: MAHJONG_TILE_MATERIAL_BASELINE.ivoryMetalness,
  fog: false,
});
sharedTileIvoryBodyMaterial.name = 'shared-ivory-tile-body';

const sharedBicolorBodyMaterials = new Map<string, MeshStandardMaterial>();

/**
 * One continuous rounded body owns the external silhouette. The local-space
 * split is only color, so the ivory/back seam cannot gain a second bevel,
 * contact shadow, gap, or extra rounded corners.
 */
export function getSharedTileBicolorBodyMaterial(
  backColor: ColorRepresentation = MAHJONG_TILE_MATERIAL_BASELINE.backColor,
  frontColor: ColorRepresentation = MAHJONG_TILE_MATERIAL_BASELINE.ivoryColor,
): MeshStandardMaterial {
  const resolvedBackColor = new Color(backColor);
  const colorKey = `${resolvedBackColor.getHexString()}:${new Color(frontColor).getHexString()}`;
  const cached = sharedBicolorBodyMaterials.get(colorKey);
  if (cached) return cached;

  const ivoryColor = new Color(frontColor);
  const toGlslRgb = (color: Color) => [color.r, color.g, color.b]
    .map((channel) => channel.toFixed(6)).join(', ');
  const material = new MeshStandardMaterial({
    color: MAHJONG_TILE_MATERIAL_BASELINE.ivoryColor,
    roughness: MAHJONG_TILE_MATERIAL_BASELINE.ivoryRoughness,
    metalness: MAHJONG_TILE_MATERIAL_BASELINE.ivoryMetalness,
    fog: false,
  });
  const seamY = MAHJONG_TILE_ANATOMY.seamY.toFixed(6);
  const ivoryRgb = toGlslRgb(ivoryColor);
  const backRgb = toGlslRgb(resolvedBackColor);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying float vTileLocalY;\n${shader.vertexShader}`
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vTileLocalY = position.y;',
      );
    shader.fragmentShader = `varying float vTileLocalY;\n${shader.fragmentShader}`
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n  diffuseColor.rgb = vTileLocalY < ${seamY} ? vec3(${backRgb}) : vec3(${ivoryRgb});`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\n  roughnessFactor = vTileLocalY < ${seamY} ? ${MAHJONG_TILE_MATERIAL_BASELINE.backBodyRoughness.toFixed(6)} : ${MAHJONG_TILE_MATERIAL_BASELINE.ivoryRoughness.toFixed(6)};`,
      );
  };
  material.customProgramCacheKey = () => `mahjong-tile-bicolor-body-${colorKey}`;
  material.name = `shared-tile-bicolor-body-${colorKey}`;
  sharedBicolorBodyMaterials.set(colorKey, material);
  return material;
}

export const sharedTileBicolorBodyMaterial = getSharedTileBicolorBodyMaterial();

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

const sharedFaceBaseMaterials = new Map<TileVisualKey, MeshStandardMaterial>();
const sharedFaceGlyphMaterials = new Map<string, MeshStandardMaterial>();
const sharedBackSurfaceMaterials = new Map<string, MeshStandardMaterial>();

export function getSharedTileFaceBaseMaterial(
  visual: TileVisualDefinition,
): MeshStandardMaterial {
  const cached = sharedFaceBaseMaterials.get(visual.visualKey);
  if (cached) return cached;

  const material = new MeshStandardMaterial({
    color: visual.isRed
      ? MAHJONG_TILE_MATERIAL_BASELINE.redFaceColor
      : MAHJONG_TILE_MATERIAL_BASELINE.faceColor,
    roughness: MAHJONG_TILE_MATERIAL_BASELINE.faceRoughness,
    metalness: 0,
    fog: false,
    side: FrontSide,
    // Coplanar body top must not win over the opaque ivory base. Glyph (-1)
    // and Aka marker (-2) remain in front without moving the geometry.
    polygonOffset: true,
    polygonOffsetFactor: -0.5,
  });
  material.name = `shared-tile-face-base-${visual.visualKey}`;
  sharedFaceBaseMaterials.set(visual.visualKey, material);
  return material;
}

export function getSharedTileFaceGlyphMaterial(
  visual: TileVisualDefinition,
  texture: Texture,
): MeshStandardMaterial {
  const materialKey = `${visual.visualKey}:${texture.uuid}`;
  const cached = sharedFaceGlyphMaterials.get(materialKey);
  if (cached) return cached;

  const material = new MeshStandardMaterial({
    map: texture,
    color: '#ffffff',
    roughness: MAHJONG_TILE_MATERIAL_BASELINE.faceRoughness,
    metalness: 0,
    fog: false,
    transparent: true,
    alphaTest: 0.03,
    depthWrite: false,
    side: FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  material.name = `shared-tile-face-glyph-${visual.visualKey}`;
  sharedFaceGlyphMaterials.set(materialKey, material);
  const release = () => {
    sharedFaceGlyphMaterials.delete(materialKey);
    material.dispose();
    texture.removeEventListener('dispose', release);
  };
  texture.addEventListener('dispose', release);
  return material;
}

export function getSharedTileFaceMaterialCount(): number {
  return sharedFaceBaseMaterials.size + sharedFaceGlyphMaterials.size;
}

export function getSharedTileBackSurfaceMaterial(texture: Texture): MeshStandardMaterial {
  const cached = sharedBackSurfaceMaterials.get(texture.uuid);
  if (cached) return cached;
  const material = new MeshStandardMaterial({
    map: texture,
    color: '#ffffff',
    roughness: MAHJONG_TILE_MATERIAL_BASELINE.backRoughness,
    metalness: 0,
    fog: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  material.name = `shared-tile-back-surface-${texture.uuid}`;
  sharedBackSurfaceMaterials.set(texture.uuid, material);
  const release = () => {
    if (sharedBackSurfaceMaterials.get(texture.uuid) === material) sharedBackSurfaceMaterials.delete(texture.uuid);
    material.dispose();
    texture.removeEventListener('dispose', release);
  };
  texture.addEventListener('dispose', release);
  return material;
}
