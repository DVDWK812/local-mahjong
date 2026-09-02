import { DoubleSide, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { MAHJONG_TILE_DIMENSIONS, MAHJONG_TILE_FACE } from './tileGeometry';
import {
  getSharedTileFaceMaterial,
  MAHJONG_TILE_MATERIAL_BASELINE,
  sharedDoraHighlightMaterial,
  sharedHoveredMatchOverlayMaterial,
  sharedRedDoraHighlightMaterial,
  sharedRedFiveMarkerMaterial,
  sharedRiichiCandidateOverlayMaterial,
  sharedSelectedTileOverlayMaterial,
  sharedTileBodyMaterial,
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
      surfaceOffset: 0.002,
      markerOffset: 0.003,
    });
  });

  it('keeps a warm matte side body distinct from the warm-white face', () => {
    expect(`#${sharedTileBodyMaterial.color.getHexString()}`).toBe(
      MAHJONG_TILE_MATERIAL_BASELINE.bodyColor,
    );
    expect(sharedTileBodyMaterial.roughness).toBe(
      MAHJONG_TILE_MATERIAL_BASELINE.bodyRoughness,
    );
    expect(sharedTileBodyMaterial.metalness).toBe(
      MAHJONG_TILE_MATERIAL_BASELINE.bodyMetalness,
    );

    const face = getSharedTileFaceMaterial(
      resolveTileVisual({ id: 0, red: false }),
      new Texture(),
    );
    expect(`#${face.color.getHexString()}`).toBe(
      MAHJONG_TILE_MATERIAL_BASELINE.faceColor,
    );
    expect(face.roughness).toBe(MAHJONG_TILE_MATERIAL_BASELINE.faceRoughness);
  });

  it('reuses one face material for repeated instances of the same visual key', () => {
    const visual = resolveTileVisual({ id: 0, red: false });
    const texture = new Texture();
    expect(getSharedTileFaceMaterial(visual, texture)).toBe(getSharedTileFaceMaterial(visual, texture));
  });

  it('keeps hidden standing hands readable from the rear without revealing identities', () => {
    const back = getSharedTileFaceMaterial(
      resolveTileVisual(undefined, 'face-down'),
      new Texture(),
    );
    expect(back.side).toBe(DoubleSide);
  });

  it('keeps red-five treatment separate from the ordinary five', () => {
    const texture = new Texture();
    const ordinary = getSharedTileFaceMaterial(resolveTileVisual({ id: 4, red: false }), texture);
    const red = getSharedTileFaceMaterial(resolveTileVisual({ id: 4, red: true }), texture);
    expect(red).not.toBe(ordinary);
    expect(red.color.getHex()).not.toBe(ordinary.color.getHex());
  });

  it('renders the authoritative red-five marker in front of the offset face decal', () => {
    const face = getSharedTileFaceMaterial(
      resolveTileVisual({ id: 13, red: true }),
      new Texture(),
    );
    expect(face.polygonOffset).toBe(true);
    expect(face.polygonOffsetFactor).toBe(-1);
    expect(sharedRedFiveMarkerMaterial.polygonOffset).toBe(true);
    expect(sharedRedFiveMarkerMaterial.polygonOffsetFactor)
      .toBeLessThan(face.polygonOffsetFactor);
  });

  it('keeps every Tile3D shared material outside scene fog', () => {
    const texture = new Texture();
    const face = getSharedTileFaceMaterial(resolveTileVisual({ id: 0, red: false }), texture);
    const back = getSharedTileFaceMaterial(resolveTileVisual(undefined, 'face-down'), texture);

    expect([
      sharedTileBodyMaterial,
      face,
      back,
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
