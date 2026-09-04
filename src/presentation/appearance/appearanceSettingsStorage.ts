import {
  createDefaultAppearanceSettings,
  migrateAppearanceSettings,
  type AppearanceSettings,
} from './appearanceSettings';

export const APPEARANCE_SETTINGS_STORAGE_KEY = 'local-mahjong.presentation-appearance.v1';

/** Local preference persistence only; never use this store for GameState or replay data. */
export function loadAppearanceSettings(storage?: Pick<Storage, 'getItem'>): AppearanceSettings {
  if (!storage) return createDefaultAppearanceSettings();
  try {
    const raw = storage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultAppearanceSettings();
    return migrateAppearanceSettings(JSON.parse(raw)) ?? createDefaultAppearanceSettings();
  } catch {
    return createDefaultAppearanceSettings();
  }
}

export function saveAppearanceSettings(
  settings: AppearanceSettings,
  storage?: Pick<Storage, 'setItem'>,
): void {
  if (!storage) return;
  const normalized = migrateAppearanceSettings(settings) ?? createDefaultAppearanceSettings();
  try {
    storage.setItem(APPEARANCE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // A local preference write must never block gameplay or presentation.
  }
}

export function resetAppearanceSettings(storage?: Pick<Storage, 'removeItem'>): AppearanceSettings {
  try {
    storage?.removeItem(APPEARANCE_SETTINGS_STORAGE_KEY);
  } catch {
    // The in-memory default is safe when local storage is unavailable.
  }
  return createDefaultAppearanceSettings();
}
