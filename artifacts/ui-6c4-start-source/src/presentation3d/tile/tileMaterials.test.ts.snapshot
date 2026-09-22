import { DoubleSide, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { MAHJONG_TILE_DIMENSIONS, MAHJONG_TILE_FACE } from './tileGeometry';
import {
  getSharedTileFaceBaseMaterial,
  getSharedTileFaceGlyphMaterial,
  getSharedTileBicolorBodyMaterial,
  getSharedTileBackSurfaceMaterial,
  MAHJONG_TILE_MATERIAL_BASELINE,
  sharedDoraHighlightMaterial,
  sharedHoveredMatchOverlayMaterial,
  sharedRedDoraHighlightMaterial,
  sharedRedFiveMarkerMaterial,
  sharedRiichiCandidateOverlayMaterial,
  sharedSelectedTileOverlayMaterial,
  sharedTileBicolorBodyMaterial,
  sharedTileIvoryBodyMaterial,
  sharedTileHitMaterial,
} from './tileMaterials';
import { resolveTileVisual } from './tileTextures';

describe('3D tile shared materials', () => {
  it('freezes the UI-5B.1 thickness and flush face baseline', () => {
    expect(MAHJONG_TILE_DIMENSIONS).toEqual({
      width: 1.08,
      height: 0.6,
      depth: 1.46,
      radius: 0.11,
    });
    expect(MAHJONG_TILE_FACE).toEqual({
      width: 0.9,
      depth: 1.28,
      cornerRadius: 0.075,
      surfaceOffset: 0,
      markerOffset: 0,
    });
  });

  it('keeps one ivory/back body material distinct from the warm-white face', () => {
    expect(`#${sharedTileIvoryBodyMaterial.color.getHexString()}`).toBe(
      MAHJONG_TILE_MATERIAL_BASELINE.ivoryColor,
    );
    expect(sharedTileIvoryBodyMaterial.roughness).toBe(
      MAHJONG_TILE_MATERIAL_BASELINE.ivoryRoughness,
    );
    expect(sharedTileIvoryBodyMaterial.metalness).toBe(
      MAHJONG_TILE_MATERIAL_BASELINE.ivoryMetalness,
    );
    expect(sharedTileBicolorBodyMaterial.name).toContain('bicolor-body');

    const visual = resolveTileVisual({ id: 0, red: false });
    const faceBase = getSharedTileFaceBaseMaterial(visual);
    const glyph = getSharedTileFaceGlyphMaterial(visual, new Texture());
    expect(`#${faceBase.color.getHexString()}`).toBe(
      MAHJONG_TILE_MATERIAL_BASELINE.faceColor,
    );
    expect(faceBase.map).toBeNull();
    expect(faceBase.roughness).toBe(MAHJONG_TILE_MATERIAL_BASELINE.faceRoughness);
    expect(glyph.transparent).toBe(true);
    expect(glyph.alphaTest).toBe(0.03);
    expect(glyph.depthWrite).toBe(false);
  });

  it('reuses one base and glyph material for repeated instances of the same visual key', () => {
    const visual = resolveTileVisual({ id: 0, red: false });
    const texture = new Texture();
    expect(getSharedTileFaceBaseMaterial(visual)).toBe(getSharedTileFaceBaseMaterial(visual));
    expect(getSharedTileFaceGlyphMaterial(visual, texture))
      .toBe(getSharedTileFaceGlyphMaterial(visual, texture));
  });

  it('keeps custom face textures and back appearances independently cached', () => {
    const visual = resolveTileVisual({ id: 0, red: false });
    const faceA = getSharedTileFaceGlyphMaterial(visual, new Texture());
    const faceB = getSharedTileFaceGlyphMaterial(visual, new Texture());
    const backTexture = new Texture();
    expect(faceA).not.toBe(faceB);
    expect(faceA.map).not.toBe(faceB.map);
    expect(getSharedTileBackSurfaceMaterial(backTexture))
      .toBe(getSharedTileBackSurfaceMaterial(backTexture));
    expect(getSharedTileBicolorBodyMaterial('#17483f'))
      .toBe(getSharedTileBicolorBodyMaterial('#17483f'));
    expect(getSharedTileBicolorBodyMaterial('#225c50'))
      .not.toBe(getSharedTileBicolorBodyMaterial('#17483f'));
  });

  it('splits one shared rounded body at the frozen local-space seam without a second body material', () => {
    const material = getSharedTileBicolorBodyMaterial('#225c50');
    const shader = {
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>',
    };
    material.onBeforeCompile(
      shader as unknown as Parameters<typeof material.onBeforeCompile>[0],
      {} as never,
    );

    expect(shader.vertexShader).toContain('vTileLocalY = position.y');
    expect(shader.fragmentShader).toContain('vTileLocalY < -0.150000');
    expect(shader.fragmentShader).toContain('roughnessFactor = vTileLocalY');
    expect(material.customProgramCacheKey()).toContain('mahjong-tile-bicolor-body');
  });

  it('keeps hidden standing hands readable from the rear without revealing identities', () => {
    expect(getSharedTileFaceBaseMaterial(resolveTileVisual({ id: 0, red: false })).side)
      .not.toBe(DoubleSide);
    expect(getSharedTileBackSurfaceMaterial(new Texture()).side).toBe(DoubleSide);
  });

  it('keeps red-five treatment separate from the ordinary five', () => {
    const texture = new Texture();
    const ordinary = getSharedTileFaceBaseMaterial(resolveTileVisual({ id: 4, red: false }));
    const red = getSharedTileFaceBaseMaterial(resolveTileVisual({ id: 4, red: true }));
    expect(red).not.toBe(ordinary);
    expect(red.color.getHex()).not.toBe(ordinary.color.getHex());
    expect(getSharedTileFaceGlyphMaterial(resolveTileVisual({ id: 4, red: true }), texture))
      .not.toBe(getSharedTileFaceGlyphMaterial(resolveTileVisual({ id: 4, red: false }), texture));
  });

  it('renders the authoritative red-five marker in front of the offset face decal', () => {
    const glyph = getSharedTileFaceGlyphMaterial(
      resolveTileVisual({ id: 13, red: true }),
      new Texture(),
    );
    expect(glyph.polygonOffset).toBe(true);
    expect(glyph.polygonOffsetFactor).toBe(-1);
    expect(sharedRedFiveMarkerMaterial.polygonOffset).toBe(true);
    expect(sharedRedFiveMarkerMaterial.polygonOffsetFactor)
      .toBeLessThan(glyph.polygonOffsetFactor);
  });

  it('keeps every Tile3D shared material outside scene fog', () => {
    const texture = new Texture();
    const faceBase = getSharedTileFaceBaseMaterial(resolveTileVisual({ id: 0, red: false }));
    const glyph = getSharedTileFaceGlyphMaterial(resolveTileVisual({ id: 0, red: false }), texture);

    expect([
      sharedTileIvoryBodyMaterial,
      sharedTileBicolorBodyMaterial,
      faceBase,
      glyph,
      getSharedTileBackSurfaceMaterial(new Texture()),
      sharedRedFiveMarkerMaterial,
      sharedSelectedTileOverlayMaterial,
      sharedRiichiCandidateOverlayMaterial,
      sharedHoveredMatchOverlayMaterial,
      sharedDoraHighlightMaterial,
      sharedRedDoraHighlightMaterial,
      sharedTileHitMaterial,
    ].every((material) => material.fog === false)).toBe(true);
  });
});
