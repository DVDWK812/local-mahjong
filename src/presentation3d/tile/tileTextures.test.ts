import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import {
  getTileAssetKeyById,
  getTileBackImage,
  getTileImageById,
  getTilePlaceholderImage,
} from '../../game/tileAssets';
import {
  ALL_TILE_IDS,
  ALL_TILE_TEXTURE_SOURCES,
  ALL_TILE_VISUAL_KEYS,
  configureTileTexture,
  getTileTextureResourceCount,
  getTileTextureSource,
  resolveTile3DVisual,
  resolveTileVisual,
} from './tileTextures';
import { getTile3DFaceFallbackTexture, getTile3DFaceTextureById } from './tileFaceTextures3d';

describe('3D tile visual resolver', () => {
  it('maps every base tile id to a 3D-only transparent face resource', () => {
    expect(ALL_TILE_IDS).toHaveLength(34);
    for (const id of ALL_TILE_IDS) {
      expect(resolveTile3DVisual({ id, red: false })).toEqual({
        visualKey: getTileAssetKeyById(id),
        textureSource: getTile3DFaceTextureById(id),
        kind: 'face',
        isRed: false,
      });
    }
  });

  it('derives all three red fives only from the authoritative red flag', () => {
    expect(resolveTile3DVisual({ id: 4, red: true }).visualKey).toBe('red5m');
    expect(resolveTile3DVisual({ id: 13, red: true }).visualKey).toBe('red5p');
    expect(resolveTile3DVisual({ id: 22, red: true }).visualKey).toBe('red5s');
    expect(resolveTile3DVisual({ id: 5, red: true }).visualKey).toBe('m6');
    expect(resolveTile3DVisual({ id: 4, red: true }).textureSource).toBe(getTile3DFaceTextureById(4));
    expect(resolveTile3DVisual({ id: 13, red: true }).textureSource).toBe(getTile3DFaceTextureById(13));
    expect(resolveTile3DVisual({ id: 22, red: true }).textureSource).toBe(getTile3DFaceTextureById(22));
  });

  it('uses the shared back for face-down tiles and a safe placeholder for unknown tiles', () => {
    expect(resolveTile3DVisual({ id: 4, red: true }, 'face-down')).toEqual({
      visualKey: 'back',
      textureSource: getTileBackImage(),
      kind: 'back',
      isRed: false,
    });
    expect(resolveTile3DVisual({ id: 99, red: false } as never)).toEqual({
      visualKey: 'unknown',
      textureSource: getTile3DFaceFallbackTexture(),
      kind: 'fallback',
      isRed: false,
    });
  });

  it('provides a concrete resource for every visual key without duplicating red-five textures', () => {
    expect(ALL_TILE_VISUAL_KEYS).toHaveLength(39);
    for (const visualKey of ALL_TILE_VISUAL_KEYS) {
      expect(getTileTextureSource(visualKey)).toBeTruthy();
    }
    expect(getTileTextureSource('red5m')).toBe(getTile3DFaceTextureById(4));
    expect(getTileTextureSource('red5p')).toBe(getTile3DFaceTextureById(13));
    expect(getTileTextureSource('red5s')).toBe(getTile3DFaceTextureById(22));
    expect(getTileTextureResourceCount()).toBe(36);
    expect(ALL_TILE_TEXTURE_SOURCES).toHaveLength(36);
  });

  it('leaves the DOM and 2.5D image authority on the original tile resources', () => {
    expect(getTileImageById(0)).not.toBe(getTile3DFaceTextureById(0));
    expect(getTilePlaceholderImage()).not.toBe(getTile3DFaceFallbackTexture());
    expect(resolveTileVisual({ id: 0, red: false })).toEqual(resolveTile3DVisual({ id: 0, red: false }));
  });

  it('applies bounded color and filtering settings to cached textures', () => {
    const texture = configureTileTexture(new Texture(), 32);
    expect(texture.anisotropy).toBe(8);
    expect(texture.generateMipmaps).toBe(true);

    const lowEndTexture = configureTileTexture(new Texture(), 0);
    expect(lowEndTexture.anisotropy).toBe(1);
  });
});
