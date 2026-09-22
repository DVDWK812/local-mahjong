import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { ALL_TILE_TEXTURE_SOURCES, configureTileTexture, getTileTextureSource } from './tileTextures';

// useLoader caches the complete input tuple, not each URL separately. Match Tile3D.
export const TILE_TEXTURE_LOAD_INPUTS = ALL_TILE_TEXTURE_SOURCES.map(source => [source, getTileTextureSource('back')]);
if (typeof document !== 'undefined') TILE_TEXTURE_LOAD_INPUTS.forEach(input => useTexture.preload(input));

/** Loads every public tile-face asset before gameplay tiles mount, preventing later Suspense flashes. */
export function TileTextureWarmup() {
  return <>{TILE_TEXTURE_LOAD_INPUTS.map(input => <TileTexturePairWarmup key={input[0]} input={input} />)}</>;
}

function TileTexturePairWarmup({ input }: { input: string[] }) {
  const textures = useTexture(input);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    textures.forEach((texture) => configureTileTexture(texture, maxAnisotropy));
    invalidate();
  }, [invalidate, maxAnisotropy, textures]);

  return null;
}
