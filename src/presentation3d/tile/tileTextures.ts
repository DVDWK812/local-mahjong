import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, type Texture } from 'three';
import {
  getTileAssetKeyById,
  getTileBackImage,
  type TileAssetKey,
} from '../../game/tileAssets';
import type { Tile, TileId } from '../../game/types';
import type { TileDoraVisualKind } from '../../presentation/table/tileVisualSemantics';
import { getTile3DFaceFallbackTexture, getTile3DFaceTextureById } from './tileFaceTextures3d';
import type { TileFaceState } from './tileOrientation';

export type TileDefinition = Readonly<Pick<Tile, 'id' | 'red'> & {
  doraKind?: TileDoraVisualKind | null;
}>;
export type RedFiveVisualKey = 'red5m' | 'red5p' | 'red5s';
export type TileVisualKey = TileAssetKey | RedFiveVisualKey | 'back' | 'unknown';

export type TileVisualDefinition = Readonly<{
  visualKey: TileVisualKey;
  textureSource: string;
  kind: 'face' | 'back' | 'fallback';
  isRed: boolean;
}>;

export const ALL_TILE_IDS = Array.from({ length: 34 }, (_, id) => id as TileId);
export const ALL_BASE_TILE_VISUAL_KEYS = ALL_TILE_IDS.map(getTileAssetKeyById);
export const ALL_TILE_VISUAL_KEYS: readonly TileVisualKey[] = [
  ...ALL_BASE_TILE_VISUAL_KEYS,
  'red5m',
  'red5p',
  'red5s',
  'back',
  'unknown',
];

const RED_FIVE_VISUALS: Partial<Record<TileId, RedFiveVisualKey>> = {
  4: 'red5m',
  13: 'red5p',
  22: 'red5s',
};

const visualTextureSources = new Map<TileVisualKey, string>();
for (const id of ALL_TILE_IDS) {
  visualTextureSources.set(getTileAssetKeyById(id), getTile3DFaceTextureById(id));
}
visualTextureSources.set('red5m', getTile3DFaceTextureById(4));
visualTextureSources.set('red5p', getTile3DFaceTextureById(13));
visualTextureSources.set('red5s', getTile3DFaceTextureById(22));
visualTextureSources.set('back', getTileBackImage());
visualTextureSources.set('unknown', getTile3DFaceFallbackTexture());

export const ALL_TILE_TEXTURE_SOURCES = Object.freeze([
  ...new Set(ALL_TILE_VISUAL_KEYS.map((visualKey) => getTileTextureSource(visualKey))),
]);

function isTileId(value: number): value is TileId {
  return Number.isInteger(value) && value >= 0 && value <= 33;
}

export function getTileTextureSource(visualKey: TileVisualKey): string {
  return visualTextureSources.get(visualKey) ?? getTile3DFaceFallbackTexture();
}

/** Resolves only the 3D Tile3D face layer; DOM/2.5D keeps game/tileAssets.ts. */
export function resolveTile3DVisual(
  tile: TileDefinition | undefined,
  faceState: TileFaceState = 'face-up',
): TileVisualDefinition {
  if (faceState === 'face-down') {
    return {
      visualKey: 'back',
      textureSource: getTileTextureSource('back'),
      kind: 'back',
      isRed: false,
    };
  }

  if (!tile || !isTileId(tile.id)) {
    return {
      visualKey: 'unknown',
      textureSource: getTileTextureSource('unknown'),
      kind: 'fallback',
      isRed: false,
    };
  }

  const redVisualKey = tile.red ? RED_FIVE_VISUALS[tile.id] : undefined;
  const visualKey = redVisualKey ?? getTileAssetKeyById(tile.id);
  return {
    visualKey,
    textureSource: getTileTextureSource(visualKey),
    kind: 'face',
    isRed: redVisualKey !== undefined,
  };
}

/** @deprecated Use resolveTile3DVisual to make the renderer boundary explicit. */
export function resolveTileVisual(
  tile: TileDefinition | undefined,
  faceState: TileFaceState = 'face-up',
): TileVisualDefinition {
  return resolveTile3DVisual(tile, faceState);
}

export function configureTileTexture(texture: Texture, deviceMaxAnisotropy: number): Texture {
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, Math.max(1, deviceMaxAnisotropy));
  texture.needsUpdate = true;
  return texture;
}

export function getTileTextureResourceCount(): number {
  return new Set(visualTextureSources.values()).size;
}
