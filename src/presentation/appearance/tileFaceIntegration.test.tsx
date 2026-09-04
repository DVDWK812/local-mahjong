import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { Texture } from 'three';
import { createDefaultAppearanceSettings, migrateAppearanceSettings, TILE_APPEARANCE_IDS } from './appearanceSettings';
import { resolveTileAppearanceId } from './TileFaceDomAppearance';
import { TileFaceSettings, TILE_FACE_GROUPS, TILE_FACE_CROP_ASPECT } from '../../components/settings/TileFaceSettings';
import { drawOutput } from '../../components/settings/ImagePickerCropDialog';
import { getSharedTileBicolorBodyMaterial, getSharedTileFaceBaseMaterial, getSharedTileFaceGlyphMaterial } from '../../presentation3d/tile/tileMaterials';
import { resolveTile3DVisual } from '../../presentation3d/tile/tileTextures';
import { AppearanceTextureCache } from '../../presentation3d/appearance/AppearanceTextureCache';
import { configureLocalAppearanceTexture } from '../../presentation3d/appearance/AppearanceResources3D';
import { removeAppearanceAssetReferences, selectLibraryAppearance } from './appearanceLibrary';
import { DEFAULT_AVATAR_ID } from '../../profile/avatars';
import { Tile } from '../../components/Tile';
import type { TileId } from '../../game/types';

describe('37-slot face editor and renderer contract', () => {
  it('renders exactly 37 cards in four groups and uses the actual face surface aspect', () => {
    const keys = TILE_FACE_GROUPS.flatMap(group => [...group.keys]);
    expect(new Set(keys)).toEqual(new Set(TILE_APPEARANCE_IDS));
    expect(keys).toHaveLength(37);
    const html = renderToStaticMarkup(<TileFaceSettings settings={createDefaultAppearanceSettings()} onChange={() => undefined} onBack={() => undefined} />);
    expect(html.match(/data-tile-face-key=/g)).toHaveLength(37);
    expect(TILE_FACE_CROP_ASPECT).toBe(0.9 / 1.28);
  });
  it('resolves every tile and red-five identically for WebGL and opt-in DOM', () => {
    for (let id = 0; id < 34; id++) for (const red of [false, true]) {
      expect(resolveTileAppearanceId(id as TileId, red)).toBe(resolveTile3DVisual({ id: id as TileId, red }).visualKey);
    }
    expect([4, 13, 22].map(id => resolveTileAppearanceId(id as TileId, true))).toEqual(['red5m', 'red5p', 'red5s']);
  });
  it('migrates only pre-renderer placeholder defaults, retaining explicit colors after reload', () => {
    const old = { ...createDefaultAppearanceSettings(), tileFaceColorsReady: undefined };
    const faces = { ...old.tileFaces, m1: { ...old.tileFaces.m1, sideColor: '#ece5d4' } };
    expect(migrateAppearanceSettings({ ...old, tileFaces: faces })?.tileFaces.m1.sideColor).toBe('#f2e6c9');
    expect(migrateAppearanceSettings({ ...old, tileFaceColorsReady: true, tileFaces: faces })?.tileFaces.m1.sideColor).toBe('#ece5d4');
  });
  it('deletes only the selected asset, retains other keys/colors and reloads independent selections', () => {
    let settings = createDefaultAppearanceSettings();
    settings = selectLibraryAppearance(settings, { kind: 'tileFace', tileKey: 'm1' }, { kind: 'local', assetId: 'one' });
    settings = selectLibraryAppearance(settings, { kind: 'tileFace', tileKey: 'red5s' }, { kind: 'local', assetId: 'red' });
    settings = { ...settings, tileFaces: { ...settings.tileFaces, m1: { ...settings.tileFaces.m1, sideColor: '#ff0000' } } };
    expect(migrateAppearanceSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
    const removed = removeAppearanceAssetReferences(settings, DEFAULT_AVATAR_ID, 'one').settings;
    expect(removed.tileFaces.m1.face.kind).toBe('builtin');
    expect(removed.tileFaces.m1.sideColor).toBe('#ff0000');
    expect(removed.tileFaces.red5s).toEqual(settings.tileFaces.red5s);
    expect(removed.tileFaces.m2).toEqual(settings.tileFaces.m2);
  });
  it('crops tile faces with alpha, while existing other consumers retain their opaque export', () => {
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
    const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    const image = { naturalWidth: 74, naturalHeight: 104 } as HTMLImageElement;
    drawOutput(image, canvas, TILE_FACE_CROP_ASPECT, 2, { x: 0, y: 0 }, true);
    expect(context.fillRect).not.toHaveBeenCalled(); expect(context.drawImage).toHaveBeenCalledOnce();
    expect(canvas.height).toBe(728);
    drawOutput(image, canvas, TILE_FACE_CROP_ASPECT, 2, { x: 0, y: 0 });
    expect(context.fillRect).toHaveBeenCalledOnce();
  });
  it('splits front and back colors without changing the seam or glyph/Aka materials', () => {
    const a = getSharedTileBicolorBodyMaterial('#0000ff', '#ff0000');
    const b = getSharedTileBicolorBodyMaterial('#0000ff', '#00ff00');
    expect(a).toBe(getSharedTileBicolorBodyMaterial('#0000ff', '#ff0000')); expect(a).not.toBe(b);
    const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' };
    a.onBeforeCompile(shader as never, {} as never);
    expect(shader.fragmentShader).toContain('vTileLocalY < -0.150000 ? vec3(0.000000, 0.000000, 1.000000) : vec3(1.000000, 0.000000, 0.000000)');
    expect(a.fog).toBe(false);
    const red = resolveTile3DVisual({ id: 22, red: true });
    const texture = new Texture();
    const glyph = getSharedTileFaceGlyphMaterial(red, texture);
    expect(glyph.map).toBe(texture); expect(glyph.transparent).toBe(true);
    expect(getSharedTileFaceBaseMaterial(red).map).toBeNull();
    expect(getSharedTileFaceBaseMaterial(red).polygonOffsetFactor).toBe(-0.5);
    expect(glyph.polygonOffsetFactor).toBe(-1);
    const disposed = vi.spyOn(glyph, 'dispose'); texture.dispose(); expect(disposed).toHaveBeenCalledOnce();
  });
  it('shares one face decode, releases after all users and safely falls back for corrupt images', async () => {
    const texture = new Texture({ width: 512, height: 728 });
    const decode = vi.fn(async () => texture); const release = vi.fn();
    const cache = new AppearanceTextureCache(configureLocalAppearanceTexture, { acquire: () => ({ promise: Promise.resolve('blob:test'), release }) }, decode);
    const leases = Array.from({ length: 37 }, () => cache.acquire({ kind: 'local', assetId: 'face' }, 'tile-face'));
    expect((await Promise.all(leases.map(l => l.promise))).every(t => t === texture)).toBe(true);
    expect(decode).toHaveBeenCalledOnce(); expect(texture.flipY).toBe(true);
    const dispose = vi.spyOn(texture, 'dispose'); leases.forEach(l => l.release());
    await Promise.resolve(); await Promise.resolve(); expect(dispose).toHaveBeenCalledOnce();
    decode.mockRejectedValueOnce(new Error('corrupt'));
    const bad = cache.acquire({ kind: 'local', assetId: 'bad' }, 'tile-face');
    expect(await bad.promise).toBeUndefined(); bad.release();
  });
  it('keeps legacy DOM default assets and restricts the custom provider to 3D consumers', () => {
    const html = renderToStaticMarkup(<Tile id={0} interactive={false} />);
    expect(html).toContain('/src/assets/tiles/m1.png'); expect(html).not.toContain('tile--custom-face-3d');
    const source = (path: string) => readFileSync(decodeURIComponent(new URL(path, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), 'utf8');
    expect(source('../../components/game/GameScreen.tsx')).toContain("settings={activeTableRenderer === '3d' ? appearanceSettings : undefined}");
    for (const consumer of ['Hand3D', 'River3D', 'Meld3D']) expect(source(`../../presentation3d/${consumer.replace('3D', '').toLowerCase()}/${consumer}.tsx`)).toContain('<Tile3D');
    expect(source('../../presentation3d/animation/HandAction3D.tsx')).toContain('<Tile3D');
    expect(source('../../presentation3d/appearance/AppearanceResources3D.tsx')).not.toMatch(/useFrame|requestAnimationFrame|setInterval/);
  });
});
