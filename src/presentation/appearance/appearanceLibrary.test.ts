import { describe, expect, it, vi } from 'vitest';
import { AppearanceAssetCatalog, APPEARANCE_CATALOG_KEY, type AppearanceLibraryEntry } from './appearanceAssetCatalog';
import { createAppearanceAssetStorage } from './appearanceAssetStorage';
import { addAppearanceLibraryImage, cleanupAppearanceLibraryOrphans, collectCurrentAppearanceAssetIds, deleteAppearanceLibraryAsset, removeAppearanceAssetReferences, selectLibraryAppearance } from './appearanceLibrary';
import { createDefaultAppearanceSettings } from './appearanceSettings';
import { DEFAULT_AVATAR_ID } from '../../profile/avatars';
import { playerSlotAvatarStore } from './playerSlotAvatars';
import { playerSlotAppearanceStore, DEFAULT_PLAYER_SLOT_APPEARANCES, PLAYER_APPEARANCE_SLOTS } from './playerSlotAppearance';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
function entry(assetId: string, createdAt = 1) {
  return { assetId, createdAt, kind: 'tableFelt' as const, mimeType: 'image/png', width: 512, height: 406 };
}
function dependencies() {
  const storage = memoryStorage();
  const catalog = new AppearanceAssetCatalog(storage);
  const store = createAppearanceAssetStorage(undefined, catalog);
  return { catalog, store, cache: { invalidate: vi.fn() }, storage };
}
const inspect = async () => ({ width: 512, height: 406 });

describe('appearance catalog', () => {
  it('persists metadata separately, sorts newest first and reloads/deletes', () => {
    const storage = memoryStorage();
    const catalog = new AppearanceAssetCatalog(storage);
    catalog.add(entry('a', 1));
    catalog.add(entry('b', 2));
    catalog.add({ ...entry('avatar'), kind: 'avatar' });
    const reloaded = new AppearanceAssetCatalog(storage);
    expect(reloaded.list({ kind: 'tableFelt' }).map((e) => e.assetId)).toEqual(['b', 'a']);
    expect(reloaded.list({ kind: 'avatar' }).map((e) => e.assetId)).toEqual(['avatar']);
    reloaded.remove('a');
    expect(new AppearanceAssetCatalog(storage).list({ kind: 'tableFelt' }).map((e) => e.assetId)).toEqual(['b']);
    expect(storage.getItem(APPEARANCE_CATALOG_KEY)).not.toMatch(/blob:|data:|base64/);
  });

  it('requires an authoritative tile key and never mixes per-tile libraries', () => {
    const catalog = new AppearanceAssetCatalog();
    catalog.add({ ...entry('one'), kind: 'tileFace', tileKey: 'm1' });
    catalog.add({ ...entry('two'), kind: 'tileFace', tileKey: 'm2' });
    catalog.add({ ...entry('red'), kind: 'tileFace', tileKey: 'red5m' });
    expect(catalog.list({ kind: 'tileFace', tileKey: 'm1' }).map((e) => e.assetId)).toEqual(['one']);
    expect(catalog.list({ kind: 'tileFace', tileKey: 'm2' }).map((e) => e.assetId)).toEqual(['two']);
    expect(() => catalog.add({ ...entry('invalid'), kind: 'tileFace' } as AppearanceLibraryEntry)).toThrow();
    expect(() => catalog.add({ ...entry('invalid'), kind: 'tileFace', tileKey: 'not-a-tile' } as unknown as AppearanceLibraryEntry)).toThrow();
    const settings = createDefaultAppearanceSettings();
    const selected = selectLibraryAppearance(settings, { kind: 'tileFace', tileKey: 'm1' }, { kind: 'local', assetId: 'one' });
    expect(selected.tileFaces.m1.face).toEqual({ kind: 'local', assetId: 'one' });
    expect(selected.tileFaces.m2).toBe(settings.tileFaces.m2);
  });

  it.each(['{broken', '{"version":99,"entries":[]}', '{"version":1,"entries":[{"assetId":"saved"}]}'])('fails closed for malformed/future catalog %s', async (raw) => {
    const d = dependencies();
    const asset = await d.store.put(new Blob(['keep']));
    d.storage.setItem(APPEARANCE_CATALOG_KEY, raw);
    d.catalog.reload();
    expect(d.catalog.getSnapshot()).toEqual([]);
    expect(d.catalog.protectedAssetIds()).toBeNull();
    expect(await d.store.cleanupOrphans(new Set())).toEqual([]);
    expect(await d.store.exists(asset.id)).toBe(true);
    expect(() => d.catalog.add(entry('new'))).toThrow();
    expect(d.storage.getItem(APPEARANCE_CATALOG_KEY)).toBe(raw);
  });
});

describe('saved appearance library lifecycle', () => {
  it('protects uncatalogued player refs from cleanup and clears every player before deleting a shared Blob', async () => {
    const d = dependencies();
    const record = await d.store.put(new Blob(['shared'], { type: 'image/png' }));
    try {
      for (const slot of PLAYER_APPEARANCE_SLOTS) playerSlotAppearanceStore.select(slot, { tileBack: { texture: { kind: 'local', assetId: record.id }, sideColor: '#123456' }, riichiStick: { kind: 'local', assetId: record.id } });
      expect(await cleanupAppearanceLibraryOrphans(createDefaultAppearanceSettings(), DEFAULT_AVATAR_ID, d)).toEqual([]);
      expect(await d.store.exists(record.id)).toBe(true);
      d.catalog.add({ ...entry(record.id), kind: 'tileBack' });
      await deleteAppearanceLibraryAsset(record.id, () => {
        expect(collectCurrentAppearanceAssetIds(createDefaultAppearanceSettings(), DEFAULT_AVATAR_ID).has(record.id)).toBe(false);
      }, d);
      expect(await d.store.exists(record.id)).toBe(false);
      for (const slot of PLAYER_APPEARANCE_SLOTS) expect(playerSlotAppearanceStore.getSnapshot()[slot]).toEqual({ tileBack: { texture: 'inherit', sideColor: '#123456' }, riichiStick: 'inherit' });
    } finally { for (const slot of PLAYER_APPEARANCE_SLOTS) playerSlotAppearanceStore.select(slot, DEFAULT_PLAYER_SLOT_APPEARANCES[slot]); }
  });
  it.each(['tileBack', 'tableFelt', 'riichiStick'] as const)('%s keeps A/B across selection, default, reload and cleanup; only explicit delete removes A', async (kind) => {
    const d = dependencies();
    const a = await addAppearanceLibraryImage(new Blob(['A'], { type: 'image/png' }), { kind }, d, inspect);
    const b = await addAppearanceLibraryImage(new Blob(['B'], { type: 'image/png' }), { kind }, d, inspect);
    let settings = createDefaultAppearanceSettings();
    settings = selectLibraryAppearance(settings, { kind }, { kind: 'local', assetId: a.assetId });
    settings = selectLibraryAppearance(settings, { kind }, { kind: 'local', assetId: b.assetId });
    settings = selectLibraryAppearance(settings, { kind }, { kind: 'builtin', id: kind === 'tableFelt' ? 'classic-green' : 'default' });
    expect(await cleanupAppearanceLibraryOrphans(settings, DEFAULT_AVATAR_ID, d)).toEqual([]);
    expect(new AppearanceAssetCatalog(d.storage).list({ kind })).toHaveLength(2);
    expect(await (await d.store.get(a.assetId))?.text()).toBe('A');
    await deleteAppearanceLibraryAsset(a.assetId, () => undefined, d);
    expect(await d.store.exists(a.assetId)).toBe(false);
    expect(await d.store.exists(b.assetId)).toBe(true);
    expect(d.catalog.list({ kind }).map((e) => e.assetId)).toEqual([b.assetId]);
    expect(d.cache.invalidate).toHaveBeenCalledWith(a.assetId);
  });

  it('falls back active Profile and all matching settings refs before deleting the blob, preserving colors/unrelated refs', async () => {
    const d = dependencies();
    const a = await addAppearanceLibraryImage(new Blob(['A'], { type: 'image/png' }), { kind: 'avatar' }, d, inspect);
    let settings = createDefaultAppearanceSettings();
    settings = { ...settings, tileBack: { texture: { kind: 'local', assetId: a.assetId }, sideColor: '#123456' } };
    settings = selectLibraryAppearance(settings, { kind: 'tileFace', tileKey: 'm1' }, { kind: 'local', assetId: a.assetId });
    let avatarId: import('../../profile/avatars').AvatarId = `custom:${a.assetId}`;
    for (const slot of [1, 2, 3] as const) playerSlotAvatarStore.select(slot, avatarId);
    // A library entry itself has no selected/current state.
    expect(d.catalog.getSnapshot()[0]).not.toHaveProperty('selected');
    await deleteAppearanceLibraryAsset(a.assetId, async (id) => {
      expect(await d.store.exists(id)).toBe(true);
      const next = removeAppearanceAssetReferences(settings, avatarId, id);
      settings = next.settings; avatarId = next.avatarId;
    }, d);
    expect(avatarId).toBe(DEFAULT_AVATAR_ID);
    expect(Object.values(playerSlotAvatarStore.getSnapshot())).toEqual([DEFAULT_AVATAR_ID, DEFAULT_AVATAR_ID, DEFAULT_AVATAR_ID]);
    expect(collectCurrentAppearanceAssetIds(settings, avatarId).has(a.assetId)).toBe(false);
    expect(settings.tileBack.sideColor).toBe('#123456');
    expect(settings.tileFaces.m1.face.kind).toBe('builtin');
    expect(await d.store.exists(a.assetId)).toBe(false);
  });

  it('protects inactive catalog images and pre-library current refs; collects only true orphans', async () => {
    const d = dependencies();
    const inactive = await addAppearanceLibraryImage(new Blob(['saved'], { type: 'image/png' }), { kind: 'avatar' }, d, inspect);
    const active = await d.store.put(new Blob(['pre-library']));
    const orphan = await d.store.put(new Blob(['abandoned']));
    expect(await cleanupAppearanceLibraryOrphans(createDefaultAppearanceSettings(), `custom:${active.id}`, d)).toEqual([orphan.id]);
    expect(await d.store.exists(inactive.assetId)).toBe(true);
    expect(await d.store.exists(active.id)).toBe(true);
  });

  it('never deletes defaults or a blob when authority fallback fails', async () => {
    const d = dependencies();
    await expect(deleteAppearanceLibraryAsset('default', () => undefined, d)).rejects.toThrow();
    const a = await addAppearanceLibraryImage(new Blob(['A'], { type: 'image/png' }), { kind: 'avatar' }, d, inspect);
    await expect(deleteAppearanceLibraryAsset(a.assetId, () => { throw new Error('settings quota'); }, d)).rejects.toThrow();
    expect(await d.store.exists(a.assetId)).toBe(true);
    expect(d.catalog.getSnapshot()).toHaveLength(1);
  });

  it('rolls back only a new upload on metadata write failure, and restores catalog on blob deletion failure', async () => {
    const d = dependencies();
    const a = await addAppearanceLibraryImage(new Blob(['A'], { type: 'image/png' }), { kind: 'avatar' }, d, inspect);
    const addSpy = vi.spyOn(d.catalog, 'add').mockImplementationOnce(() => { throw new Error('quota'); });
    await expect(addAppearanceLibraryImage(new Blob(['B'], { type: 'image/png' }), { kind: 'avatar' }, d, inspect)).rejects.toThrow('quota');
    addSpy.mockRestore();
    expect(await d.store.exists(a.assetId)).toBe(true);
    expect(await d.store.cleanupOrphans(new Set())).toEqual([]);
    vi.spyOn(d.store, 'delete').mockRejectedValueOnce(new Error('IDB abort'));
    await expect(deleteAppearanceLibraryAsset(a.assetId, () => undefined, d)).rejects.toThrow();
    expect(d.catalog.list({ kind: 'avatar' })).toHaveLength(1);
    expect(await d.store.exists(a.assetId)).toBe(true);
  });
});
