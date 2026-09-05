import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppearanceAssetUrlCache } from './appearanceAssetResolver';

describe('AppearanceAssetUrlCache', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreate });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevoke });
  });

  it('reclaims unused URLs without deleting saved Blobs, but permits same-commit reacquisition', async () => {
    const revoke = vi.fn();
    const get = vi.fn(async () => new Blob(['saved']));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:saved' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const cache = new AppearanceAssetUrlCache({ get });
    const ref = { kind: 'local' as const, assetId: 'saved' };
    const first = cache.acquire(ref, ''); await first.promise;
    first.release();
    const remount = cache.acquire(ref, ''); await remount.promise;
    expect(revoke).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
    remount.release(); await Promise.resolve(); await Promise.resolve();
    expect(revoke).toHaveBeenCalledTimes(1);
    const later = cache.acquire(ref, ''); await later.promise;
    expect(get).toHaveBeenCalledTimes(2);
    later.release();
  });

  it('reads one local asset once, shares its URL, and revokes it on replacement cleanup', async () => {
    const get = vi.fn(async () => new Blob(['image'], { type: 'image/png' }));
    const create = vi.fn(() => 'blob:appearance-a');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const cache = new AppearanceAssetUrlCache({ get });
    const reference = { kind: 'local' as const, assetId: 'appearance-a' };

    await expect(Promise.all([
      cache.resolve(reference, '/default.png'),
      cache.resolve(reference, '/default.png'),
    ])).resolves.toEqual(['blob:appearance-a', 'blob:appearance-a']);
    expect(get).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);

    cache.invalidate(reference.assetId);
    await Promise.resolve();
    expect(revoke).toHaveBeenCalledWith('blob:appearance-a');
  });

  it('falls back without creating a URL when the local asset is missing', async () => {
    const cache = new AppearanceAssetUrlCache({ get: async () => null });
    await expect(cache.resolve({ kind: 'local', assetId: 'missing' }, '/default.png')).resolves.toBe('/default.png');
    await expect(cache.resolve({ kind: 'local', assetId: 'missing' }, '/other-default.png')).resolves.toBe('/other-default.png');
  });

  it('reports confirmed missing binaries once, never transient IndexedDB failures', async () => {
    const missing = vi.fn();
    const cache = new AppearanceAssetUrlCache({ get: async () => null }, missing);
    await cache.resolve({ kind: 'local', assetId: 'missing' }, 'default');
    await cache.resolve({ kind: 'local', assetId: 'missing' }, 'default');
    expect(missing.mock.calls).toEqual([['missing']]);
    const unavailable = new AppearanceAssetUrlCache({ get: async () => { throw new Error('IDB unavailable'); } }, missing);
    expect(await unavailable.resolve({ kind: 'local', assetId: 'keep' }, 'default')).toBe('default');
    expect(missing).toHaveBeenCalledTimes(1);
  });

  it('shares thumbnail/avatar leases and cannot revoke a replacement through an old lease', async () => {
    let count = 0;
    const revoke = vi.fn();
    const get = vi.fn(async () => new Blob(['image']));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => `blob:${++count}` });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const cache = new AppearanceAssetUrlCache({ get });
    const ref = { kind: 'local' as const, assetId: 'shared' };
    const thumbnail = cache.acquire(ref, '');
    const avatar = cache.acquire(ref, '');
    expect(await thumbnail.promise).toBe(await avatar.promise);
    expect(get).toHaveBeenCalledTimes(1);
    cache.invalidate('shared');
    const replacement = cache.acquire(ref, '');
    await replacement.promise;
    thumbnail.release(); avatar.release(); avatar.release();
    await Promise.resolve();
    expect(revoke.mock.calls).toEqual([['blob:1']]);
    cache.invalidate('shared'); replacement.release();
    await Promise.resolve();
    expect(revoke.mock.calls).toEqual([['blob:1'], ['blob:2']]);
  });

  it('does not revoke an active URL until its mounted consumer releases it', async () => {
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:active-appearance' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const cache = new AppearanceAssetUrlCache({ get: async () => new Blob(['image'], { type: 'image/png' }) });
    const lease = cache.acquire({ kind: 'local', assetId: 'active' }, '/default.png');

    await expect(lease.promise).resolves.toBe('blob:active-appearance');
    cache.invalidate('active');
    await Promise.resolve();
    expect(revoke).not.toHaveBeenCalled();

    lease.release();
    await Promise.resolve();
    expect(revoke).toHaveBeenCalledWith('blob:active-appearance');
  });
});
