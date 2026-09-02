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
  resolveTileVisual,
} from './tileTextures';

describe('3D tile visual resolver', () => {
  it('maps every base tile id to its authoritative visual key and resource', () => {
    expect(ALL_TILE_IDS).toHaveLength(34);
    for (const id of ALL_TILE_IDS) {
      expect(resolveTileVisual({ id, red: false })).toEqual({
        visualKey: getTileAssetKeyById(id),
        textureSource: getTileImageById(id),
        kind: 'face',
        isRed: false,
      });
    }
  });

  it('derives all three red fives only from the authoritative red flag', () => {
    expect(resolveTileVisual({ id: 4, red: true }).visualKey).toBe('red5m');
    expect(resolveTileVisual({ id: 13, red: true }).visualKey).toBe('red5p');
    expect(resolveTileVisual({ id: 22, red: true }).visualKey).toBe('red5s');
    expect(resolveTileVisual({ id: 5, red: true }).visualKey).toBe('m6');
  });

  it('uses the shared back for face-down tiles and a safe placeholder for unknown tiles', () => {
    expect(resolveTileVisual({ id: 4, red: true }, 'face-down')).toEqual({
      visualKey: 'back',
      textureSource: getTileBackImage(),
      kind: 'back',
      isRed: false,
    });
    expect(resolveTileVisual({ id: 99, red: false } as never)).toEqual({
      visualKey: 'unknown',
      textureSource: getTilePlaceholderImage(),
      kind: 'fallback',
      isRed: false,
    });
  });

  it('provides a concrete resource for every visual key without duplicating red-five textures', () => {
    expect(ALL_TILE_VISUAL_KEYS).toHaveLength(39);
    for (const visualKey of ALL_TILE_VISUAL_KEYS) {
      expect(getTileTextureSource(visualKey)).toBeTruthy();
    }
    expect(getTileTextureSource('red5m')).toBe(getTileImageById(4));
    expect(getTileTextureSource('red5p')).toBe(getTileImageById(13));
    expect(getTileTextureSource('red5s')).toBe(getTileImageById(22));
    expect(getTileTextureResourceCount()).toBe(36);
    expect(ALL_TILE_TEXTURE_SOURCES).toHaveLength(36);
  });

  it('applies bounded color and filtering settings to cached textures', () => {
    const texture = configureTileTexture(new Texture(), 32);
    expect(texture.anisotropy).toBe(8);
    expect(texture.generateMipmaps).toBe(true);

    const lowEndTexture = configureTileTexture(new Texture(), 0);
    expect(lowEndTexture.anisotropy).toBe(1);
  });
});
