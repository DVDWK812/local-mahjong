import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { ALL_TILE_TEXTURE_SOURCES, configureTileTexture } from './tileTextures';

/** Loads every public tile-face asset before gameplay tiles mount, preventing later Suspense flashes. */
export function TileTextureWarmup() {
  const textures = useTexture([...ALL_TILE_TEXTURE_SOURCES]);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    textures.forEach((texture) => configureTileTexture(texture, maxAnisotropy));
    invalidate();
  }, [invalidate, maxAnisotropy, textures]);

  return null;
}
