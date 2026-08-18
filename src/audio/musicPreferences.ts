import type { GameSfxGroup, MusicCategory, MusicTrackId, PlaybackMode } from './musicTypes';

export const MUSIC_PREFERENCES_STORAGE_KEY = 'local-mahjong.music-preferences.v1';
export const MUSIC_PREFERENCES_VERSION = 1;

export const MUSIC_CATEGORIES: readonly MusicCategory[] = Object.freeze([
  'bgm_main',
  'bgm_game',
  'bgm_richi',
  'effects',
  'voice_lines',
]);

export const GAME_SFX_GROUPS: readonly GameSfxGroup[] = Object.freeze(['draw', 'discard', 'meld']);

export const PLAYBACK_MODES: readonly PlaybackMode[] = Object.freeze(['shuffle', 'sequential', 'repeat-one']);

export interface MusicPreferences {
  readonly disabledBuiltinTrackIds: readonly MusicTrackId[];
  readonly order: Readonly<Partial<Record<MusicCategory, readonly MusicTrackId[]>>>;
  readonly playbackMode: Readonly<Partial<Record<MusicCategory, PlaybackMode>>>;
  readonly lastSelectedTrackId: Readonly<Partial<Record<MusicCategory, MusicTrackId | null>>>;
  readonly sfxLastSelectedTrackId: Readonly<Partial<Record<GameSfxGroup, MusicTrackId | null>>>;
  readonly sfxOrder: Readonly<Partial<Record<GameSfxGroup, readonly MusicTrackId[]>>>;
  readonly sfxPlaybackMode: Readonly<Partial<Record<GameSfxGroup, PlaybackMode>>>;
}

export const DEFAULT_MUSIC_PREFERENCES: Readonly<MusicPreferences> = Object.freeze({
  disabledBuiltinTrackIds: Object.freeze([]),
  order: Object.freeze({}),
  playbackMode: Object.freeze({
    bgm_main: 'sequential',
    bgm_game: 'sequential',
    bgm_richi: 'sequential',
    effects: 'sequential',
    voice_lines: 'sequential',
  }),
  lastSelectedTrackId: Object.freeze({
    bgm_main: null,
    bgm_game: null,
    bgm_richi: null,
    effects: null,
    voice_lines: null,
  }),
  sfxLastSelectedTrackId: Object.freeze({
    draw: null,
    discard: null,
    meld: null,
  }),
  sfxOrder: Object.freeze({}),
  sfxPlaybackMode: Object.freeze({
    draw: 'sequential',
    discard: 'sequential',
    meld: 'sequential',
  }),
});

function normalizeTrackIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizePlaybackMode(value: unknown): PlaybackMode {
  return value === 'shuffle' || value === 'repeat-one' ? value : 'sequential';
}

function normalizeCategoryMap<T>(
  value: unknown,
  normalize: (item: unknown) => T | null,
): Partial<Record<MusicCategory, T>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const result: Partial<Record<MusicCategory, T>> = {};
  MUSIC_CATEGORIES.forEach((category) => {
    if (input[category] === undefined) return;
    const normalized = normalize(input[category]);
    if (normalized !== null) result[category] = normalized;
  });
  return result;
}

function normalizeSfxMap<T>(
  value: unknown,
  normalize: (item: unknown) => T | null,
): Partial<Record<GameSfxGroup, T>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const result: Partial<Record<GameSfxGroup, T>> = {};
  GAME_SFX_GROUPS.forEach((group) => {
    if (input[group] === undefined) return;
    const normalized = normalize(input[group]);
    if (normalized !== null) result[group] = normalized;
  });
  return result;
}

export function normalizeMusicPreferences(value: unknown): MusicPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_MUSIC_PREFERENCES };
  const input = value as Partial<Record<string, unknown>>;
  const lastSelectedInput = input.lastSelectedTrackId
    && typeof input.lastSelectedTrackId === 'object'
    && !Array.isArray(input.lastSelectedTrackId)
    ? input.lastSelectedTrackId as Record<string, unknown>
    : {};
  const lastSelectedTrackId: Partial<Record<MusicCategory, MusicTrackId | null>> = {};
  MUSIC_CATEGORIES.forEach((category) => {
    if (lastSelectedInput[category] === undefined) return;
    lastSelectedTrackId[category] = typeof lastSelectedInput[category] === 'string'
      ? lastSelectedInput[category]
      : null;
  });
  const sfxLastSelectedInput = input.sfxLastSelectedTrackId
    && typeof input.sfxLastSelectedTrackId === 'object'
    && !Array.isArray(input.sfxLastSelectedTrackId)
    ? input.sfxLastSelectedTrackId as Record<string, unknown>
    : {};
  const sfxLastSelectedTrackId: Partial<Record<GameSfxGroup, MusicTrackId | null>> = {};
  GAME_SFX_GROUPS.forEach((group) => {
    if (sfxLastSelectedInput[group] === undefined) return;
    sfxLastSelectedTrackId[group] = typeof sfxLastSelectedInput[group] === 'string'
      ? sfxLastSelectedInput[group]
      : null;
  });
  return {
    disabledBuiltinTrackIds: normalizeTrackIdList(input.disabledBuiltinTrackIds),
    order: normalizeCategoryMap(input.order, (item) => {
      const ids = normalizeTrackIdList(item);
      return ids.length > 0 ? ids : null;
    }),
    playbackMode: normalizeCategoryMap(input.playbackMode, (item) => normalizePlaybackMode(item)),
    lastSelectedTrackId,
    sfxLastSelectedTrackId,
    sfxOrder: normalizeSfxMap(input.sfxOrder, (item) => {
      const ids = normalizeTrackIdList(item);
      return ids.length > 0 ? ids : null;
    }),
    sfxPlaybackMode: normalizeSfxMap(input.sfxPlaybackMode, (item) => normalizePlaybackMode(item)),
  };
}

export function loadMusicPreferences(storage?: Pick<Storage, 'getItem'>): MusicPreferences {
  if (!storage) return { ...DEFAULT_MUSIC_PREFERENCES };
  try {
    const raw = storage.getItem(MUSIC_PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MUSIC_PREFERENCES };
    const stored = JSON.parse(raw) as Partial<{ version: number; preferences: unknown }>;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored) || stored.version !== MUSIC_PREFERENCES_VERSION) {
      return { ...DEFAULT_MUSIC_PREFERENCES };
    }
    return normalizeMusicPreferences(stored.preferences);
  } catch {
    return { ...DEFAULT_MUSIC_PREFERENCES };
  }
}

export function saveMusicPreferences(
  preferences: MusicPreferences,
  storage?: Pick<Storage, 'setItem'>,
): void {
  if (!storage) return;
  try {
    storage.setItem(MUSIC_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: MUSIC_PREFERENCES_VERSION,
      preferences: normalizeMusicPreferences(preferences),
    }));
  } catch {
    // Preferences must never prevent the application from continuing.
  }
}

export function resetMusicPreferences(storage?: Pick<Storage, 'removeItem'>): MusicPreferences {
  try {
    storage?.removeItem(MUSIC_PREFERENCES_STORAGE_KEY);
  } catch {
    // In-memory defaults remain usable.
  }
  return { ...DEFAULT_MUSIC_PREFERENCES };
}
