import {
  DEFAULT_AUDIO_SETTINGS,
  migrateLegacyAudioSettings,
  normalizeAudioSettings,
  type AudioSettings,
} from './audioSettings';

export const AUDIO_SETTINGS_STORAGE_KEY = 'local-mahjong.audio-settings.v2';
export const AUDIO_SETTINGS_LEGACY_STORAGE_KEY = 'local-mahjong.audio-settings.v1';
export const AUDIO_SETTINGS_STORAGE_VERSION = 2;

interface StoredAudioSettings {
  version: typeof AUDIO_SETTINGS_STORAGE_VERSION;
  settings: AudioSettings;
}

function readStoredRaw(storage: Pick<Storage, 'getItem'>, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadAudioSettings(storage?: Pick<Storage, 'getItem'>): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };

  const current = readStoredRaw(storage, AUDIO_SETTINGS_STORAGE_KEY) as Partial<StoredAudioSettings> | null;
  if (current && typeof current === 'object' && !Array.isArray(current) && current.version === AUDIO_SETTINGS_STORAGE_VERSION) {
    return normalizeAudioSettings(current.settings);
  }

  const legacy = readStoredRaw(storage, AUDIO_SETTINGS_LEGACY_STORAGE_KEY) as Partial<{ version: number; settings: unknown }> | null;
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy) && legacy.version === 1) {
    return migrateLegacyAudioSettings(legacy.settings);
  }

  return { ...DEFAULT_AUDIO_SETTINGS };
}

export function saveAudioSettings(settings: AudioSettings, storage?: Pick<Storage, 'setItem'>): void {
  if (!storage) return;
  try {
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({
      version: AUDIO_SETTINGS_STORAGE_VERSION,
      settings: normalizeAudioSettings(settings),
    } satisfies StoredAudioSettings));
  } catch {
    // Audio preferences must never prevent the application from continuing.
  }
}

export function resetAudioSettings(storage?: Pick<Storage, 'removeItem'>): AudioSettings {
  try {
    storage?.removeItem(AUDIO_SETTINGS_STORAGE_KEY);
  } catch {
    // The in-memory defaults remain usable when storage is unavailable.
  }
  return { ...DEFAULT_AUDIO_SETTINGS };
}
