import { useSyncExternalStore } from 'react';
import { normalizeAssetRef, normalizeAppearanceColor, type AppearanceAssetRef, type AppearanceSettings } from './appearanceSettings';

export const PLAYER_APPEARANCE_SLOTS = [0, 1, 2, 3] as const;
export type AppearancePlayerSlot = typeof PLAYER_APPEARANCE_SLOTS[number];
export type InheritableAsset = 'inherit' | AppearanceAssetRef;
export type PlayerSlotAppearance = Readonly<{
  tileBack: Readonly<{ texture: InheritableAsset; sideColor: string }>;
  riichiStick: InheritableAsset;
}>;
export type PlayerSlotAppearances = Readonly<Record<AppearancePlayerSlot, PlayerSlotAppearance>>;
export const PLAYER_SLOT_APPEARANCE_KEY = 'local-mahjong.player-slot-appearance.v1';
const defaultSlot: PlayerSlotAppearance = Object.freeze({ tileBack: Object.freeze({ texture: 'inherit', sideColor: 'inherit' }), riichiStick: 'inherit' });
export const DEFAULT_PLAYER_SLOT_APPEARANCES: PlayerSlotAppearances = Object.freeze({ 0: defaultSlot, 1: defaultSlot, 2: defaultSlot, 3: defaultSlot });
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
function browserStorage(): StoragePort | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
const asset = (value: unknown): InheritableAsset => normalizeAssetRef(value) ?? 'inherit';
function normalizeSlot(value: unknown): PlayerSlotAppearance {
  const data = value as Partial<PlayerSlotAppearance> | null;
  return { tileBack: { texture: asset(data?.tileBack?.texture), sideColor: normalizeAppearanceColor(data?.tileBack?.sideColor) ?? 'inherit' }, riichiStick: asset(data?.riichiStick) };
}
export function loadPlayerSlotAppearances(storage = browserStorage()): PlayerSlotAppearances {
  try {
    const data = JSON.parse(storage?.getItem(PLAYER_SLOT_APPEARANCE_KEY) ?? 'null');
    if (data?.version !== 1) return DEFAULT_PLAYER_SLOT_APPEARANCES;
    return Object.fromEntries(PLAYER_APPEARANCE_SLOTS.map(slot => [slot, normalizeSlot(data.players?.[slot])])) as PlayerSlotAppearances;
  } catch { return DEFAULT_PLAYER_SLOT_APPEARANCES; }
}
export function collectPlayerSlotAppearanceAssetIds(players: PlayerSlotAppearances): Set<string> {
  return new Set(Object.values(players).flatMap(player => [player.tileBack.texture, player.riichiStick])
    .flatMap(ref => ref !== 'inherit' && ref.kind === 'local' ? [ref.assetId] : []));
}
/** Stable player ID, never seat/wind. Profile and global appearance retain their own authority. */
export function createPlayerSlotAppearanceStore(storage = browserStorage()) {
  let snapshot = loadPlayerSlotAppearances(storage);
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  const save = (next: PlayerSlotAppearances) => {
    storage?.setItem(PLAYER_SLOT_APPEARANCE_KEY, JSON.stringify({ version: 1, players: next }));
    snapshot = next;
    publish();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reload: () => { snapshot = loadPlayerSlotAppearances(storage); publish(); },
    select: (slot: AppearancePlayerSlot, selection: PlayerSlotAppearance) => {
      if (!PLAYER_APPEARANCE_SLOTS.includes(slot)) throw new Error('无效的玩家位置。');
      save({ ...snapshot, [slot]: normalizeSlot(selection) });
    },
    removeAsset: (assetId: string) => {
      if (!collectPlayerSlotAppearanceAssetIds(snapshot).has(assetId)) return;
      const remove = (ref: InheritableAsset): InheritableAsset => ref !== 'inherit' && ref.kind === 'local' && ref.assetId === assetId ? 'inherit' : ref;
      save(Object.fromEntries(PLAYER_APPEARANCE_SLOTS.map(slot => [slot, {
        tileBack: { ...snapshot[slot].tileBack, texture: remove(snapshot[slot].tileBack.texture) },
        riichiStick: remove(snapshot[slot].riichiStick),
      }])) as PlayerSlotAppearances);
    },
  };
}
export const playerSlotAppearanceStore = createPlayerSlotAppearanceStore();
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === PLAYER_SLOT_APPEARANCE_KEY || event.key === null) playerSlotAppearanceStore.reload();
});
export function usePlayerSlotAppearances() {
  return useSyncExternalStore(playerSlotAppearanceStore.subscribe, playerSlotAppearanceStore.getSnapshot, playerSlotAppearanceStore.getSnapshot);
}
export function resolvePlayerSlotAppearance(playerId: number | undefined, players: PlayerSlotAppearances, global: AppearanceSettings) {
  const player = players[playerId as AppearancePlayerSlot] ?? defaultSlot;
  return {
    tileBack: { texture: player.tileBack.texture === 'inherit' ? global.tileBack.texture : player.tileBack.texture,
      sideColor: player.tileBack.sideColor === 'inherit' ? global.tileBack.sideColor : player.tileBack.sideColor },
    riichiStick: player.riichiStick === 'inherit' ? global.riichiStick.asset : player.riichiStick,
  };
}
