import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_TILE_IDS } from './tileTextures';
import { getTile3DFaceFallbackTexture, getTile3DFaceTextureById } from './tileFaceTextures3d';

function sourcePath(relativePath: string): string {
  return decodeURIComponent(new URL(relativePath, import.meta.url).pathname)
    .replace(/^\/([A-Za-z]:)/, '$1');
}

describe('3D transparent tile face assets', () => {
  it('maps all normal, red-five, and honor faces to 3D-only resources', () => {
    const fallback = getTile3DFaceFallbackTexture();
    for (const id of ALL_TILE_IDS) expect(getTile3DFaceTextureById(id)).not.toBe(fallback);
    expect(getTile3DFaceTextureById(4)).not.toBe(fallback);
    expect(getTile3DFaceTextureById(13)).not.toBe(fallback);
    expect(getTile3DFaceTextureById(22)).not.toBe(fallback);
    expect(getTile3DFaceTextureById(27)).not.toBe(fallback);
  });

  it('keeps transparent-face imports isolated under the 3D asset directory', () => {
    const source = readFileSync(sourcePath('./tileFaceTextures3d.ts'), 'utf8');
    expect(source).toContain("../assets/tiles/faces-transparent/m1.png");
    expect(source).toContain("../assets/tiles/faces-transparent/m5.png");
    expect(source).toContain("../assets/tiles/faces-transparent/p5.png");
    expect(source).toContain("../assets/tiles/faces-transparent/s5.png");
    expect(source).toContain("../assets/tiles/faces-transparent/z7.png");
    expect(source).not.toContain("../../assets/tiles/");
  });
});
