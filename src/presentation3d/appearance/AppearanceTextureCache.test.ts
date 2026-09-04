import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'three';
import { AppearanceTextureCache } from './AppearanceTextureCache';
import { resolveOwnedAppearance3D, resolveLoadedPlayerAppearance3D } from './TileAppearance3DContext';
import { DEFAULT_RIICHI_STICK_3D_APPEARANCE } from '../riichi/riichiStickAppearance';
import { getSharedTileBackSurfaceMaterial } from '../tile/tileMaterials';

describe('shared player appearance GPU resources', () => {
  it('releases the cached back material when the final texture lease is disposed', () => {
    const texture = new Texture();
    const material = getSharedTileBackSurfaceMaterial(texture);
    const dispose = vi.spyOn(material, 'dispose');
    expect(getSharedTileBackSurfaceMaterial(texture)).toBe(material);
    texture.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(getSharedTileBackSurfaceMaterial(texture)).not.toBe(material);
    texture.dispose();
  });
  it('resolves missing Blob to global, explicit builtin to default, and custom decode to owner texture', () => {
    const global = { backTexture: new Texture(), backColor: '#123456', riichiStickAppearance: { ...DEFAULT_RIICHI_STICK_3D_APPEARANCE, texture: new Texture() } };
    const missing = { tileBack: { texture: { kind: 'local' as const, assetId: 'missing' }, sideColor: 'inherit' }, riichiStick: { kind: 'local' as const, assetId: 'missing' } };
    expect(resolveLoadedPlayerAppearance3D(missing, global)).toEqual(global);
    const back = new Texture(); const stick = new Texture();
    expect(resolveLoadedPlayerAppearance3D(missing, global, back, stick).backTexture).toBe(back);
    expect(resolveLoadedPlayerAppearance3D(missing, global, back, stick).riichiStickAppearance?.texture).toBe(stick);
    const builtin = { kind: 'builtin' as const, id: 'default' };
    const resolved = resolveLoadedPlayerAppearance3D({ tileBack: { texture: builtin, sideColor: '#ff0000' }, riichiStick: builtin }, global);
    expect(resolved.backTexture).toBeUndefined(); expect(resolved.backColor).toBe('#ff0000');
    expect(resolved.riichiStickAppearance).toBe(DEFAULT_RIICHI_STICK_3D_APPEARANCE);
  });
  it('deduplicates URL leases/decode/Texture for global and four slots, disposing only after final release', async () => {
    const texture = new Texture(); const dispose = vi.spyOn(texture, 'dispose'); const releaseUrl = vi.fn();
    const acquire = vi.fn(() => ({ promise: Promise.resolve('blob:shared'), release: releaseUrl }));
    const decode = vi.fn(async () => texture);
    const cache = new AppearanceTextureCache(t => t, { acquire }, decode);
    const leases = Array.from({ length: 5 }, () => cache.acquire({ kind: 'local', assetId: 'shared' }, 'tile-back'));
    const loaded = await Promise.all(leases.map(l => l.promise));
    expect(loaded.every(t => t === texture)).toBe(true); expect(acquire).toHaveBeenCalledTimes(1); expect(decode).toHaveBeenCalledTimes(1);
    leases.slice(0, 4).forEach(l => l.release()); await Promise.resolve(); expect(dispose).not.toHaveBeenCalled();
    leases[4].release(); await Promise.resolve(); await Promise.resolve(); expect(dispose).toHaveBeenCalledTimes(1); expect(releaseUrl).toHaveBeenCalledTimes(1);
  });
  it('keeps pending decode leased through unmount and separates surface UV conventions', async () => {
    let complete!: (texture: Texture) => void;
    const texture = new Texture(); const disposed = vi.spyOn(texture, 'dispose'); const release = vi.fn();
    const acquire = vi.fn(() => ({ promise: Promise.resolve('blob:pending'), release }));
    const cache = new AppearanceTextureCache(t => t, { acquire }, () => new Promise(resolve => { complete = resolve; }));
    const lease = cache.acquire({ kind: 'local', assetId: 'same' }, 'tile-back'); await Promise.resolve(); lease.release(); await Promise.resolve();
    expect(release).not.toHaveBeenCalled(); complete(texture); await lease.promise; await Promise.resolve(); expect(disposed).toHaveBeenCalledTimes(1); expect(release).toHaveBeenCalledTimes(1);
  });
  it('missing/corrupt assets resolve safely, allowing owner to inherit global; builtin does not load', async () => {
    const decode = vi.fn(async () => { throw new Error('decode'); });
    const cache = new AppearanceTextureCache(t => t, { acquire: () => ({ promise: Promise.resolve(''), release: () => undefined }) }, decode);
    const missing = cache.acquire({ kind: 'local', assetId: 'missing' }, 'tile-back');
    expect(await missing.promise).toBeUndefined(); expect(decode).not.toHaveBeenCalled(); missing.release();
    expect(await cache.acquire({ kind: 'builtin', id: 'default' }, 'tile-back').promise).toBeUndefined();
    const corrupt = new AppearanceTextureCache(t => t, { acquire: () => ({ promise: Promise.resolve('blob:bad'), release: () => undefined }) }, decode);
    const lease = corrupt.acquire({ kind: 'local', assetId: 'bad' }, 'tile-back'); expect(await lease.promise).toBeUndefined(); lease.release();
  });
  it('uses actor ID for owned resources and global for wall/deadwall/dora/unowned', () => {
    const resources = { backColor: '#17483f', players: { 0: { backColor: '#ff0000' }, 1: { backColor: '#0000ff' }, 2: { backColor: '#008000' }, 3: { backColor: '#800080' } } };
    expect(resolveOwnedAppearance3D(resources)).toBe(resources);
    expect(resolveOwnedAppearance3D(resources, 99)).toBe(resources);
    for (const id of [3, 0, 2, 1] as const) expect(resolveOwnedAppearance3D(resources, id)).toBe(resources.players[id]);
  });
});
