import { DEFAULT_PLAYER_PROFILE, normalizePlayerProfile, type PlayerProfile } from './playerProfile';

export const PLAYER_PROFILE_STORAGE_KEY = 'local-mahjong.player-profile.v1';
export const PLAYER_PROFILE_STORAGE_VERSION = 2;

interface StoredPlayerProfile extends PlayerProfile {
  version: typeof PLAYER_PROFILE_STORAGE_VERSION;
}

export function loadPlayerProfile(storage?: Pick<Storage, 'getItem'>): PlayerProfile {
  if (!storage) return { ...DEFAULT_PLAYER_PROFILE };
  try {
    const raw = storage.getItem(PLAYER_PROFILE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER_PROFILE };
    const stored = JSON.parse(raw) as Partial<StoredPlayerProfile>;
    const version = (stored as { version?: unknown } | null)?.version;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored) || (version !== 1 && version !== PLAYER_PROFILE_STORAGE_VERSION)) {
      return { ...DEFAULT_PLAYER_PROFILE };
    }
    return normalizePlayerProfile(stored);
  } catch {
    return { ...DEFAULT_PLAYER_PROFILE };
  }
}

export function savePlayerProfile(profile: PlayerProfile, storage?: Pick<Storage, 'setItem'>): void {
  if (!storage) return;
  const normalized = normalizePlayerProfile(profile);
  try {
    storage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify({
      version: PLAYER_PROFILE_STORAGE_VERSION,
      ...normalized,
    } satisfies StoredPlayerProfile));
  } catch {
    // Storage failures must not prevent the local game from continuing.
  }
}

export function resetPlayerProfile(storage?: Pick<Storage, 'removeItem'>): PlayerProfile {
  try {
    storage?.removeItem(PLAYER_PROFILE_STORAGE_KEY);
  } catch {
    // The in-memory default is still safe when storage is unavailable.
  }
  return { ...DEFAULT_PLAYER_PROFILE };
}
