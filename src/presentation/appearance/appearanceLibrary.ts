import { DEFAULT_AVATAR_ID, getCustomAvatarAssetId, type AvatarId } from '../../profile/avatars';
import { playerSlotAvatarStore } from './playerSlotAvatars';
import { collectPlayerSlotAppearanceAssetIds, playerSlotAppearanceStore } from './playerSlotAppearance';
import { appearanceAssetCatalog, type AppearanceAssetCatalog, type AppearanceLibraryEntry, type AppearanceLibraryScope } from './appearanceAssetCatalog';
import { appearanceAssetStorage, type AppearanceAssetStore } from './appearanceAssetStorage';
import { appearanceAssetUrlCache } from './appearanceAssetResolver';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceAssetRef, type AppearanceSettings, type TileAppearanceId } from './appearanceSettings';

type LibraryDependencies = {
  store: AppearanceAssetStore;
  catalog: AppearanceAssetCatalog;
  cache: Pick<typeof appearanceAssetUrlCache, 'invalidate'>;
};
const defaults: LibraryDependencies = { store: appearanceAssetStorage, catalog: appearanceAssetCatalog, cache: appearanceAssetUrlCache };

/** Missing Blob repair uses the same selection authorities as explicit delete,
 * but never deletes binary data (nor any other saved library entry). */
export function repairMissingAppearanceAsset(assetId: string, repairCurrent: (assetId: string) => void, dependencies = defaults) {
  playerSlotAvatarStore.removeAsset(assetId);
  playerSlotAppearanceStore.removeAsset(assetId);
  repairCurrent(assetId);
  if (dependencies.catalog.getSnapshot().some(entry => entry.assetId === assetId)) dependencies.catalog.remove(assetId);
  dependencies.cache.invalidate(assetId);
}

/** Dimensions come from the saved crop, never a second thumbnail payload. */
export async function inspectAppearanceImage(blob: Blob): Promise<{ width: number; height: number }> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('不支持的图片格式。');
  const bitmap = await createImageBitmap(blob);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('图片无法解码。');
    return { width: bitmap.width, height: bitmap.height };
  } finally { bitmap.close(); }
}

export async function addAppearanceLibraryImage(
  blob: Blob,
  scope: AppearanceLibraryScope,
  dependencies = defaults,
  inspect = inspectAppearanceImage,
): Promise<AppearanceLibraryEntry> {
  const size = await inspect(blob);
  const record = await dependencies.store.put(blob);
  const entry: AppearanceLibraryEntry = { ...scope, assetId: record.id, createdAt: Date.parse(record.createdAt), mimeType: blob.type, ...size };
  try { dependencies.catalog.add(entry); }
  catch (error) {
    // Only the new, never-published upload is rolled back on catalog failure.
    await dependencies.store.delete(record.id);
    throw error;
  }
  return entry;
}

/** Caller clears EVERY current reference through its existing authority first. */
export async function deleteAppearanceLibraryAsset(
  assetId: string,
  beforeDelete: (assetId: string) => void | Promise<void>,
  dependencies = defaults,
): Promise<void> {
  const entries = dependencies.catalog.getSnapshot().filter((entry) => entry.assetId === assetId);
  if (!entries.length) throw new Error('只能删除已保存的自定义图片。');
  playerSlotAvatarStore.removeAsset(assetId);
  playerSlotAppearanceStore.removeAsset(assetId);
  await beforeDelete(assetId);
  dependencies.catalog.remove(assetId);
  try { await dependencies.store.delete(assetId); }
  catch (error) {
    entries.forEach((entry) => dependencies.catalog.add(entry));
    throw error;
  }
  dependencies.cache.invalidate(assetId);
}

export function collectCurrentAppearanceAssetIds(settings: AppearanceSettings, avatarId: AvatarId): Set<string> {
  const ids = collectPlayerSlotAppearanceAssetIds(playerSlotAppearanceStore.getSnapshot());
  const avatar = getCustomAvatarAssetId(avatarId);
  if (avatar) ids.add(avatar);
  for (const selection of Object.values(playerSlotAvatarStore.getSnapshot())) {
    const id = getCustomAvatarAssetId(selection);
    if (id) ids.add(id);
  }
  for (const ref of [settings.tileBack.texture, settings.tableFelt.asset, settings.riichiStick.asset,
    ...Object.values(settings.tileFaces).map((slot) => slot.face)]) {
    if (ref.kind === 'local') ids.add(ref.assetId);
  }
  return ids;
}

/** Pure presentation fallback, including the future per-tile editor contract. */
export function removeAppearanceAssetReferences(settings: AppearanceSettings, avatarId: AvatarId, assetId: string) {
  const replace = (ref: AppearanceAssetRef, fallback: AppearanceAssetRef) => ref.kind === 'local' && ref.assetId === assetId ? fallback : ref;
  return {
    avatarId: getCustomAvatarAssetId(avatarId) === assetId ? DEFAULT_AVATAR_ID : avatarId,
    settings: {
      ...settings,
      tileBack: { ...settings.tileBack, texture: replace(settings.tileBack.texture, DEFAULT_APPEARANCE_SETTINGS.tileBack.texture) },
      tableFelt: { asset: replace(settings.tableFelt.asset, DEFAULT_APPEARANCE_SETTINGS.tableFelt.asset) },
      riichiStick: { asset: replace(settings.riichiStick.asset, DEFAULT_APPEARANCE_SETTINGS.riichiStick.asset) },
      tileFaces: Object.fromEntries(Object.entries(settings.tileFaces).map(([key, slot]) => [key, {
        ...slot, face: replace(slot.face, DEFAULT_APPEARANCE_SETTINGS.tileFaces[key as TileAppearanceId].face),
      }])) as AppearanceSettings['tileFaces'],
    } satisfies AppearanceSettings,
  };
}

export function selectLibraryAppearance(settings: AppearanceSettings, scope: Exclude<AppearanceLibraryScope, { kind: 'avatar' }>, ref: AppearanceAssetRef): AppearanceSettings {
  if (scope.kind === 'tileBack') return { ...settings, tileBack: { ...settings.tileBack, texture: ref } };
  if (scope.kind === 'tableFelt') return { ...settings, tableFelt: { asset: ref } };
  if (scope.kind === 'riichiStick') return { ...settings, riichiStick: { asset: ref } };
  if (scope.kind === 'tileFace') return { ...settings, tileFaces: { ...settings.tileFaces, [scope.tileKey]: { ...settings.tileFaces[scope.tileKey], face: ref } } };
  return settings;
}

/** Protect catalogued inactive images AND current (including pre-library) refs. */
export async function cleanupAppearanceLibraryOrphans(settings: AppearanceSettings, avatarId: AvatarId, dependencies = defaults) {
  const removed = await dependencies.store.cleanupOrphans(collectCurrentAppearanceAssetIds(settings, avatarId));
  removed.forEach((assetId) => dependencies.cache.invalidate(assetId));
  return removed;
}

const adopting = new Map<string, Promise<void>>();
/** Incremental adoption: existing selected blobs survive the first library upgrade. */
export async function adoptCurrentAppearanceAssets(settings: AppearanceSettings, avatarId: AvatarId): Promise<void> {
  const selections: Array<{ scope: AppearanceLibraryScope; ref: AppearanceAssetRef }> = [
    { scope: { kind: 'tileBack' }, ref: settings.tileBack.texture },
    { scope: { kind: 'tableFelt' }, ref: settings.tableFelt.asset },
    { scope: { kind: 'riichiStick' }, ref: settings.riichiStick.asset },
    ...Object.entries(settings.tileFaces).map(([tileKey, slot]) => ({ scope: { kind: 'tileFace' as const, tileKey: tileKey as TileAppearanceId }, ref: slot.face })),
  ];
  const avatar = getCustomAvatarAssetId(avatarId);
  if (avatar) selections.push({ scope: { kind: 'avatar' }, ref: { kind: 'local', assetId: avatar } });
  await Promise.all(selections.map(async ({ scope, ref }) => {
    if (ref.kind !== 'local' || appearanceAssetCatalog.list(scope).some((e) => e.assetId === ref.assetId)) return;
    const key = `${scope.kind}:${scope.tileKey ?? ''}:${ref.assetId}`;
    if (!adopting.has(key)) {
      adopting.set(key, (async () => {
        const blob = await appearanceAssetStorage.get(ref.assetId);
        if (!blob) return;
        const size = await inspectAppearanceImage(blob);
        appearanceAssetCatalog.add({ ...scope, assetId: ref.assetId, createdAt: 0, mimeType: blob.type, ...size });
      })().finally(() => adopting.delete(key)));
    }
    await adopting.get(key);
  }));
}
