import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  MAHJONG_TILE_ANATOMY,
  MAHJONG_TILE_DIMENSIONS,
  MAHJONG_TILE_FACE,
  MAHJONG_TILE_GEOMETRY_SIZE,
  sharedTileBodyGeometry,
} from './tileGeometry';
import { getFlatTileFootprint } from './tileFootprintPacking';

function sourcePath(relativePath: string): string {
  return decodeURIComponent(new URL(relativePath, import.meta.url).pathname)
    .replace(/^\/([A-Za-z]:)/, '$1');
}

describe('UI-5G.1A Tile3D visual anatomy', () => {
  it('keeps the exact gameplay envelope and sideways footprint', () => {
    expect(MAHJONG_TILE_GEOMETRY_SIZE.width).toBeCloseTo(MAHJONG_TILE_DIMENSIONS.width);
    expect(MAHJONG_TILE_GEOMETRY_SIZE.height).toBeCloseTo(MAHJONG_TILE_DIMENSIONS.height);
    expect(MAHJONG_TILE_GEOMETRY_SIZE.depth).toBeCloseTo(MAHJONG_TILE_DIMENSIONS.depth);
    const upright = getFlatTileFootprint('upright');
    const sideways = getFlatTileFootprint('sideways');
    expect(upright.x).toBeCloseTo(1.08);
    expect(upright.z).toBeCloseTo(1.46);
    expect(sideways.x).toBeCloseTo(1.46);
    expect(sideways.z).toBeCloseTo(1.08);
  });

  it('fits a dominant ivory layer and thinner back layer inside that envelope', () => {
    const bounds = sharedTileBodyGeometry.boundingBox;
    if (!bounds) throw new Error('Visual body must expose bounds.');
    const size = bounds.getSize(new Vector3());

    expect(MAHJONG_TILE_ANATOMY.ivoryHeight / MAHJONG_TILE_DIMENSIONS.height).toBe(0.75);
    expect(MAHJONG_TILE_ANATOMY.backHeight / MAHJONG_TILE_DIMENSIONS.height).toBe(0.25);
    expect(MAHJONG_TILE_ANATOMY.seamY).toBeCloseTo(-0.15);
    expect(bounds.min.y).toBeCloseTo(-MAHJONG_TILE_DIMENSIONS.height / 2);
    expect(bounds.max.y).toBeCloseTo(MAHJONG_TILE_DIMENSIONS.height / 2);
    expect(size.x).toBeCloseTo(MAHJONG_TILE_DIMENSIONS.width);
    expect(size.y).toBeCloseTo(MAHJONG_TILE_DIMENSIONS.height);
    expect(size.z).toBeCloseTo(MAHJONG_TILE_DIMENSIONS.depth);
    expect(MAHJONG_TILE_FACE.surfaceOffset).toBe(0);
    expect(MAHJONG_TILE_FACE.markerOffset).toBe(0);
  });

  it('exposes independent face/back inputs while preserving the stable hit target', () => {
    const source = readFileSync(sourcePath('./Tile3D.tsx'), 'utf8');
    expect(source).toContain('faceTexture?: Texture;');
    expect(source).toContain('backTexture?: Texture;');
    expect(source).toContain('backColor?: ColorRepresentation;');
    expect(source).toContain('geometry={sharedStandingHandHitGeometry}');
    expect(source).toContain('userData={{ ...metadata, hitTarget: true }}');
    expect(source).toContain("transform.faceState === 'face-up' && faceVisual.isRed");
    expect(source).toContain('<DoraHighlight3D');
  });
});
