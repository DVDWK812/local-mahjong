import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings, type AudioSettings } from './audioSettings';

export const AUDIO_SETTINGS_STORAGE_KEY = 'local-mahjong.audio-settings.v1';
export const AUDIO_SETTINGS_STORAGE_VERSION = 1;

interface StoredAudioSettings {
  version: typeof AUDIO_SETTINGS_STORAGE_VERSION;
  settings: AudioSettings;
}

export function loadAudioSettings(storage?: Pick<Storage, 'getItem'>): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const stored = JSON.parse(raw) as Partial<StoredAudioSettings>;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored) || stored.version !== AUDIO_SETTINGS_STORAGE_VERSION) {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
    return normalizeAudioSettings(stored.settings);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
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
