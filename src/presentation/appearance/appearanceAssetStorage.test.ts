import { describe, expect, it } from 'vitest';
import { createAppearanceAssetStorage } from './appearanceAssetStorage';

describe('AppearanceAssetStorage', () => {
  it('supports put/get/replace/delete/exists and safe missing assets in memory fallback', async () => {
    const store = createAppearanceAssetStorage();
    expect(store.name).toBe('memory');
    const first = await store.put(new Blob(['first'], { type: 'image/png' }));
    expect(await store.exists(first.id)).toBe(true);
    expect(await (await store.get(first.id))?.text()).toBe('first');
    expect(await store.replace(first.id, new Blob(['second'], { type: 'image/png' }))).toMatchObject({ id: first.id });
    expect(await (await store.get(first.id))?.text()).toBe('second');
    expect(await store.replace('missing', new Blob())).toBeNull();
    await store.delete(first.id);
    expect(await store.get(first.id)).toBeNull();
  });

  it('cleans orphaned local assets while retaining referenced assets for reload consumers', async () => {
    const store = createAppearanceAssetStorage();
    const kept = await store.put(new Blob(['keep']));
    const orphan = await store.put(new Blob(['remove']));
    expect(await store.cleanupOrphans(new Set([kept.id]))).toEqual([orphan.id]);
    expect(await store.exists(kept.id)).toBe(true);
    expect(await store.exists(orphan.id)).toBe(false);
  });
});
