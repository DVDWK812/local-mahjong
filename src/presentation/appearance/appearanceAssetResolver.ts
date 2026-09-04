import { useEffect, useState } from 'react';
import type { AppearanceAssetRef } from './appearanceSettings';
import type { AppearanceAssetStore } from './appearanceAssetStorage';
import { appearanceAssetStorage } from './appearanceAssetStorage';

type CachedAsset = {
  promise: Promise<string | null>;
  consumers: number;
  retired: boolean;
  reclaimed: boolean;
};

export type AppearanceAssetLease = Readonly<{
  promise: Promise<string>;
  release: () => void;
}>;

/**
 * A local asset is read once and represented by one Object URL for all DOM and
 * WebGL consumers. Settings still persist only the lightweight asset ref.
 */
export class AppearanceAssetUrlCache {
  private readonly entries = new Map<string, CachedAsset>();

  constructor(private readonly store: Pick<AppearanceAssetStore, 'get'> = appearanceAssetStorage) {}

  resolve(reference: AppearanceAssetRef, fallbackSource: string): Promise<string> {
    if (reference.kind !== 'local') return Promise.resolve(fallbackSource);
    return this.getEntry(reference.assetId).promise.then((url) => url ?? fallbackSource);
  }

  private getEntry(assetId: string): CachedAsset {
    const existing = this.entries.get(assetId);
    if (existing) return existing;
    const entry: CachedAsset = {
      promise: this.store.get(assetId).then((blob) => blob ? URL.createObjectURL(blob) : null).catch(() => null),
      consumers: 0, retired: false, reclaimed: false,
    };
    this.entries.set(assetId, entry);
    return entry;
  }

  /**
   * Keeps an Object URL alive until the renderer/DOM consumer has committed its
   * replacement. Calling invalidate while a texture is still mounted must not
   * revoke the URL underneath Three's loader.
   */
  acquire(reference: AppearanceAssetRef, fallbackSource: string): AppearanceAssetLease {
    if (reference.kind !== 'local') {
      return { promise: Promise.resolve(fallbackSource), release: () => undefined };
    }
    const entry = this.getEntry(reference.assetId);
    const promise = entry.promise.then((url) => url ?? fallbackSource);
    entry.consumers += 1;
    let released = false;
    return {
      promise,
      release: () => {
        if (released) return;
        released = true;
        entry.consumers -= 1;
        this.reclaimIfUnused(entry);
      },
    };
  }

  invalidate(assetId: string): void {
    const entry = this.entries.get(assetId);
    if (!entry) return;
    this.entries.delete(assetId);
    entry.retired = true;
    this.reclaimIfUnused(entry);
  }

  dispose(): void {
    for (const assetId of [...this.entries.keys()]) this.invalidate(assetId);
  }

  private reclaimIfUnused(entry: CachedAsset): void {
    if (!entry.retired || entry.consumers > 0 || entry.reclaimed) return;
    entry.reclaimed = true;
    void entry.promise.then((url) => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }
}

export const appearanceAssetUrlCache = new AppearanceAssetUrlCache();

/** Resolves a persisted asset ref safely; missing/corrupt blobs retain the builtin. */
export function useAppearanceAssetSource(reference: AppearanceAssetRef, fallbackSource: string): string {
  const [source, setSource] = useState(fallbackSource);

  const key = reference.kind === 'local' ? reference.assetId : null;
  useEffect(() => {
    let active = true;
    setSource(fallbackSource);
    const lease = appearanceAssetUrlCache.acquire(key ? { kind: 'local', assetId: key } : { kind: 'builtin', id: 'default' }, fallbackSource);
    void lease.promise.then((resolved) => {
      if (active) setSource(resolved);
    });
    return () => {
      active = false;
      lease.release();
    };
  }, [fallbackSource, key]);

  return source;
}
