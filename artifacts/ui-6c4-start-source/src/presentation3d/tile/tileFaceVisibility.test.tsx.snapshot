import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Texture } from 'three';
import { readFileSync } from 'node:fs';
import { TILE_FACE_VIEW, MAHJONG_TILE_FACE, getTileFaceImageFit } from './tileGeometry';
import { configureBuiltinFaceFit, getTileTextureSource } from './tileTextures';
import { TILE_APPEARANCE_IDS } from '../../presentation/appearance/appearanceSettings';
import { TileFaceAkaMarker, TILE_FACE_CROP_ASPECT } from '../../components/settings/TileFaceSettings';
import { AppearanceLibraryGrid } from '../../components/settings/AppearanceImageLibrary';

describe('full face visibility and shared top-left Aka marker', () => {
  it('covers all 37 identities with transparent glyph resources, including three separate Aka slots', () => {
    expect(TILE_APPEARANCE_IDS).toHaveLength(37);
    for (const key of TILE_APPEARANCE_IDS) expect(getTileTextureSource(key)).toMatch(/faces-transparent\/(?:[mps][1-9]|z[1-7])\.png/);
  });
  it('fits without cropping or aspect distortion in the common preview/3D face rectangle', () => {
    expect(TILE_FACE_CROP_ASPECT).toBe(TILE_FACE_VIEW.aspect);
    for (const [width, height] of [[74, 104], [512, 728]]) {
      const fit = getTileFaceImageFit(width, height);
      expect(fit.width).toBeLessThanOrEqual(1); expect(fit.height).toBeLessThanOrEqual(1);
      expect(fit.width * MAHJONG_TILE_FACE.width / (fit.height * MAHJONG_TILE_FACE.depth)).toBeCloseTo(width / height);
      const texture = new Texture({ width, height }); configureBuiltinFaceFit(texture);
      expect(texture.repeat.x).toBeCloseTo(1 / fit.width);
      expect(texture.repeat.y).toBeCloseTo(1 / fit.height);
      expect(texture.offset.y).toBeCloseTo((1 - texture.repeat.y) / 2);
    }
  });
  it('keeps the complete marker at face-local top-left, above glyph depth, across consumers', () => {
    const { u, v, radius } = TILE_FACE_VIEW.aka;
    expect((u - 0.5) * MAHJONG_TILE_FACE.width).toBeCloseTo(-0.387);
    expect((v - 0.5) * MAHJONG_TILE_FACE.depth).toBeCloseTo(-0.576);
    expect(u - radius / MAHJONG_TILE_FACE.width).toBeGreaterThan(0);
    expect(v - radius / MAHJONG_TILE_FACE.depth).toBeGreaterThan(0);
    expect(v + radius / MAHJONG_TILE_FACE.depth).toBeLessThan(10 / 104);
    const html = renderToStaticMarkup(<TileFaceAkaMarker />);
    expect(html).toContain('top:5%'); expect(html).toContain('left:7.000000000000001%');
    const source = (path: string) => readFileSync(decodeURIComponent(new URL(path, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), 'utf8');
    expect(source('./Tile3D.tsx')).toContain('(TILE_FACE_VIEW.aka.u - 0.5)');
    expect(source('./tileMaterials.ts')).toContain('polygonOffsetFactor: -2');
    for (const path of ['../hand/Hand3D.tsx', '../river/River3D.tsx', '../meld/Meld3D.tsx', '../animation/HandAction3D.tsx']) expect(source(path)).toContain('<Tile3D');
  });
  it('includes the same marker over both default and custom library thumbnails', () => {
    const html = renderToStaticMarkup(<AppearanceLibraryGrid entries={[{ assetId: 'red-face', kind: 'tileFace', tileKey: 'red5s', createdAt: 1, width: 512, height: 728, mimeType: 'image/png' }]} selected={{ kind: 'builtin', id: 'default' }} defaultRef={{ kind: 'builtin', id: 'default' }} defaultPreview={<img src={getTileTextureSource('red5s')} />} label="赤五索" aspectRatio={TILE_FACE_VIEW.aspect} imageFit="contain" thumbnailOverlay={<TileFaceAkaMarker />} onSelect={() => undefined} onDelete={() => undefined} />);
    expect(html.match(/aria-label="赤牌"/g)).toHaveLength(2);
    expect(html).toContain('--library-image-fit:contain');
  });
});
