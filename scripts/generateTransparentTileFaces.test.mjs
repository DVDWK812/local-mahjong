import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertTileGlyphAsset,
  decodeRgbaPng,
  inspectTileGlyph,
  outputDirectory,
  TILE_GLYPH_PRINT_REGION,
  TILE_GLYPH_SOURCE_REGION,
  extractTileGlyph,
} from './generateTransparentTileFaces.mjs';

const glyphFiles = readdirSync(resolve(outputDirectory))
  .filter((fileName) => /^(?:[mps][1-9]|z[1-7]|placeholder)\.png$/.test(fileName));

function readGlyph(fileName) {
  return decodeRgbaPng(readFileSync(join(outputDirectory, fileName)));
}

function hasInk(fileName, predicate) {
  const { pixels } = readGlyph(fileName);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] >= 32 && predicate(pixels[offset], pixels[offset + 1], pixels[offset + 2])) return true;
  }
  return false;
}

describe('ink-only transparent 3D tile glyph generation', () => {
  it.each(['p1', 'p2', 'p3', 'p7', 'p8', 'p9', 's7', 's9'])('%s preserves ink beyond the old hard mask, fitting rather than clipping', (key) => {
    const source = decodeRgbaPng(readFileSync(join('src/assets/tiles', `${key}.png`)));
    const result = extractTileGlyph(source.pixels, source.width, source.height);
    expect(result.fit).toBeDefined();
    const actual = readGlyph(`${key}.png`);
    expect(actual.pixels.equals(result.pixels)).toBe(true);
    let recovered = 0;
    const region = TILE_GLYPH_SOURCE_REGION;
    for (let y = region.top; y < region.bottom; y++) for (let x = region.left; x < region.right; x++) {
      const i = (y * source.width + x) * 4;
      if (Math.hypot(...[0, 1, 2].map(c => source.pixels[i + c] - result.paper[c])) < 100) continue;
      if (x < 8 || x >= 66 || y < 10 || y >= 94) recovered++;
      const { scale, cx, cy, tx, ty } = result.fit;
      const px = Math.round((x - cx) * scale + tx), py = Math.round((y - cy) * scale + ty);
      // Every strong source ink pixel must still have visible support after fit.
      expect(actual.pixels[(py * actual.width + px) * 4 + 3]).toBeGreaterThan(0);
    }
    expect(recovered).toBeGreaterThan(0);
  });
  it('regenerates all 35 PNGs deterministically without touching original DOM resources', () => {
    for (const file of glyphFiles) {
      const source = decodeRgbaPng(readFileSync(join('src/assets/tiles', file)));
      expect(readGlyph(file).pixels.equals(extractTileGlyph(source.pixels, source.width, source.height).pixels)).toBe(true);
    }
  });
  it('keeps every generated asset inside the audited print region with no card silhouette', () => {
    expect(glyphFiles).toHaveLength(35);
    for (const fileName of glyphFiles) {
      const asset = readGlyph(fileName);
      const inspection = assertTileGlyphAsset(fileName, asset);
      expect(inspection.outsidePrintRegionAlphaCount).toBe(0);
      expect(inspection.maxComponentPixels).toBeLessThanOrEqual(3600);
      for (let x = 0; x < asset.width; x += 1) {
        expect(asset.pixels[x * 4 + 3]).toBe(0);
        expect(asset.pixels[((asset.height - 1) * asset.width + x) * 4 + 3]).toBe(0);
      }
      for (let y = 0; y < asset.height; y += 1) {
        expect(asset.pixels[(y * asset.width) * 4 + 3]).toBe(0);
        expect(asset.pixels[(y * asset.width + asset.width - 1) * 4 + 3]).toBe(0);
      }
    }
  });

  it('retains the representative black, red, blue, and green printing inks', () => {
    expect(hasInk('m1.png', (red, green, blue) => red < 70 && green < 70 && blue < 70)).toBe(true);
    expect(hasInk('m1.png', (red, green, blue) => red > green * 1.45 && red > blue * 1.45)).toBe(true);
    expect(hasInk('p1.png', (red, green, blue) => blue > red * 1.25 && blue > green * 1.1)).toBe(true);
    expect(hasInk('p1.png', (red, green, blue) => red > green * 1.35 && red > blue * 1.35)).toBe(true);
    expect(hasInk('s1.png', (red, green, blue) => green > red * 1.3 && green > blue * 1.1)).toBe(true);
    expect(hasInk('z1.png', (red, green, blue) => red < 70 && green < 70 && blue < 70)).toBe(true);
  });

  it('keeps the blank white-dragon glyph transparent instead of restoring the old ivory card body', () => {
    const whiteDragon = readGlyph('z5.png');
    expect(inspectTileGlyph(whiteDragon).alphaPixelCount).toBe(0);
    expect(TILE_GLYPH_PRINT_REGION).toEqual({ left: 8, top: 10, right: 66, bottom: 94 });
  });
});
