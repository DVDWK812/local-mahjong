import { useSyncExternalStore } from 'react';
import { DEFAULT_AVATAR_ID, getCustomAvatarAssetId, isAvatarId, type AvatarId } from '../../profile/avatars';
import { normalizeNickname } from '../../profile/playerProfile';

export type OpponentSlot = 1 | 2 | 3;
export type PlayerSlotAvatars = Readonly<Record<OpponentSlot, AvatarId>>;
export type PlayerSlotNicknames = Readonly<Record<OpponentSlot, string>>;
const defaultNicknames: PlayerSlotNicknames = { 1: 'Player 2', 2: 'Player 3', 3: 'Player 4' };
export const PLAYER_SLOT_AVATARS_KEY = 'local-mahjong.player-slot-avatars.v1';
const defaults: PlayerSlotAvatars = { 1: DEFAULT_AVATAR_ID, 2: DEFAULT_AVATAR_ID, 3: DEFAULT_AVATAR_ID };
const slots = [1, 2, 3] as const;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): StoragePort | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}

export function loadPlayerSlotAvatars(storage = browserStorage()): PlayerSlotAvatars {
  try {
    const data = JSON.parse(storage?.getItem(PLAYER_SLOT_AVATARS_KEY) ?? 'null');
    if (!data || ![1, 2].includes(data.version) || !data.avatars) return defaults;
    return Object.fromEntries(slots.map(slot => [slot, isAvatarId(data.avatars[slot]) ? data.avatars[slot] : DEFAULT_AVATAR_ID])) as PlayerSlotAvatars;
  } catch { return defaults; }
}

export function loadPlayerSlotNicknames(storage = browserStorage()): PlayerSlotNicknames {
  try {
    const data = JSON.parse(storage?.getItem(PLAYER_SLOT_AVATARS_KEY) ?? 'null');
    if (!data || data.version !== 2) return defaultNicknames;
    return Object.fromEntries(slots.map(slot => [slot, normalizeNickname(data.nicknames?.[slot]) ?? defaultNicknames[slot]])) as PlayerSlotNicknames;
  } catch { return defaultNicknames; }
}

/** Selection only; Player 1 remains owned by PlayerProfile. No seat/wind or Blob state. */
export function createPlayerSlotAvatarStore(storage = browserStorage()) {
  let snapshot = loadPlayerSlotAvatars(storage);
  let nicknames = loadPlayerSlotNicknames(storage);
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  const save = (next: PlayerSlotAvatars, nextNicknames = nicknames) => {
    // Fail before publishing on quota errors, especially during shared-asset deletion.
    storage?.setItem(PLAYER_SLOT_AVATARS_KEY, JSON.stringify({ version: 2, avatars: next, nicknames: nextNicknames }));
    snapshot = next;
    nicknames = nextNicknames;
    publish();
  };
  return {
    getSnapshot: () => snapshot,
    getNicknames: () => nicknames,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reload: () => { snapshot = loadPlayerSlotAvatars(storage); nicknames = loadPlayerSlotNicknames(storage); publish(); },
    setNickname: (slot: OpponentSlot, value: string) => {
      const nickname = normalizeNickname(value);
      if (!slots.includes(slot) || !nickname) throw new Error('昵称不能为空。');
      save(snapshot, { ...nicknames, [slot]: nickname });
    },
    select: (slot: OpponentSlot, avatar: AvatarId) => {
      if (!slots.includes(slot) || !isAvatarId(avatar)) throw new Error('无效的玩家头像。');
      save({ ...snapshot, [slot]: avatar });
    },
    removeAsset: (assetId: string) => {
      if (!Object.values(snapshot).some(avatar => getCustomAvatarAssetId(avatar) === assetId)) return;
      save(Object.fromEntries(slots.map(slot => [slot, getCustomAvatarAssetId(snapshot[slot]) === assetId ? DEFAULT_AVATAR_ID : snapshot[slot]])) as PlayerSlotAvatars);
    },
  };
}

export const playerSlotAvatarStore = createPlayerSlotAvatarStore();
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === PLAYER_SLOT_AVATARS_KEY || event.key === null) playerSlotAvatarStore.reload();
});
export function usePlayerSlotAvatars() {
  return useSyncExternalStore(playerSlotAvatarStore.subscribe, playerSlotAvatarStore.getSnapshot, playerSlotAvatarStore.getSnapshot);
}
export function usePlayerSlotNicknames() {
  return useSyncExternalStore(playerSlotAvatarStore.subscribe, playerSlotAvatarStore.getNicknames, playerSlotAvatarStore.getNicknames);
}
export function resolvePlayerSlotNickname(playerId: number, profileNickname: string | undefined, nicknames: PlayerSlotNicknames, fallback: string): string {
  return playerId === 0 ? normalizeNickname(profileNickname) ?? fallback : nicknames[playerId as OpponentSlot] ?? fallback;
}
export function resolvePlayerSlotAvatar(playerId: number, profileAvatar: AvatarId | undefined, avatars: PlayerSlotAvatars): AvatarId {
  return playerId === 0 ? profileAvatar ?? DEFAULT_AVATAR_ID : avatars[playerId as OpponentSlot] ?? DEFAULT_AVATAR_ID;
}
