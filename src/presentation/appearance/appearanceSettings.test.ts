import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_SETTINGS_VERSION,
  DEFAULT_APPEARANCE_SETTINGS,
  TILE_APPEARANCE_IDS,
  createDefaultAppearanceSettings,
  migrateAppearanceSettings,
  normalizeAppearanceColor,
} from './appearanceSettings';
import {
  APPEARANCE_SETTINGS_STORAGE_KEY,
  loadAppearanceSettings,
  resetAppearanceSettings,
  saveAppearanceSettings,
} from './appearanceSettingsStorage';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
  };
}

describe('AppearanceSettings v2', () => {
  it('uses the stable builtin defaults and all 37 authoritative tile appearance identities', () => {
    const defaults = createDefaultAppearanceSettings();
    expect(defaults).toEqual(DEFAULT_APPEARANCE_SETTINGS);
    expect(defaults.version).toBe(APPEARANCE_SETTINGS_VERSION);
    expect(TILE_APPEARANCE_IDS).toHaveLength(37);
    expect(defaults.tileFaces.red5m.face).toEqual({ kind: 'builtin', id: 'default' });
    expect(defaults.tableFelt.asset).toEqual({ kind: 'builtin', id: 'classic-green' });
    expect(defaults.handAppearance).toEqual({ status: 'reserved' });
  });

  it('migrates v1 while retaining each legacy reference under the new v2 contract', () => {
    const migrated = migrateAppearanceSettings({
      version: 1,
      tileFaceSet: { kind: 'local', assetId: 'face-pack' },
      tileBack: { kind: 'local', assetId: 'back-a' },
      tableFelt: { kind: 'builtin', id: 'jade-felt' },
      riichiStick: { kind: 'local', assetId: 'stick-a' },
    });
    expect(migrated?.version).toBe(2);
    expect(migrated?.tileFaces.m1.face).toEqual({ kind: 'local', assetId: 'face-pack' });
    expect(migrated?.tileFaces.red5s.face).toEqual({ kind: 'local', assetId: 'face-pack' });
    expect(migrated?.tileBack.texture).toEqual({ kind: 'local', assetId: 'back-a' });
    expect(migrated?.tableFelt.asset).toEqual({ kind: 'builtin', id: 'jade-felt' });
  });

  it('saves, reloads, and resets v2 without serializing image payloads', () => {
    const storage = memoryStorage();
    const defaults = createDefaultAppearanceSettings();
    const settings = {
      ...defaults,
      tileFaces: { ...defaults.tileFaces, m1: { face: { kind: 'local' as const, assetId: 'm1-ink' }, sideColor: '#123456' } },
      tileBack: { texture: { kind: 'local' as const, assetId: 'back-1' }, sideColor: '#654321' },
    };
    saveAppearanceSettings(settings, storage);
    expect(loadAppearanceSettings(storage)).toEqual(settings);
    expect(storage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY)).not.toMatch(/base64|blob/i);
    expect(resetAppearanceSettings(storage)).toEqual(DEFAULT_APPEARANCE_SETTINGS);
  });

  it('normalizes invalid fields independently and safely rejects malformed/future values', () => {
    const storage = memoryStorage();
    storage.setItem(APPEARANCE_SETTINGS_STORAGE_KEY, JSON.stringify({
      version: 2,
      tileFaces: { m1: { face: { kind: 'local', assetId: '../bad' }, sideColor: 'red' }, unknown: { face: { kind: 'builtin', id: 'x' }, sideColor: '#ffffff' } },
      tileBack: { texture: { kind: 'remote', url: 'bad' }, sideColor: '#def' },
    }));
    const normalized = loadAppearanceSettings(storage);
    expect(normalized.tileFaces.m1).toEqual(DEFAULT_APPEARANCE_SETTINGS.tileFaces.m1);
    expect(normalized.tileBack).toEqual(DEFAULT_APPEARANCE_SETTINGS.tileBack);
    for (const raw of ['{bad', '[]', JSON.stringify({ version: 3 })]) {
      storage.setItem(APPEARANCE_SETTINGS_STORAGE_KEY, raw);
      expect(loadAppearanceSettings(storage)).toEqual(DEFAULT_APPEARANCE_SETTINGS);
    }
    expect(normalizeAppearanceColor('#A1b2C3')).toBe('#a1b2c3');
    expect(normalizeAppearanceColor('#fff')).toBeNull();
  });

  it('migrates the pre-renderer v2 placeholder back color to the frozen Tile3D default', () => {
    const migrated = migrateAppearanceSettings({
      version: 2,
      tileBack: { texture: { kind: 'builtin', id: 'default' }, sideColor: '#8c3040' },
    });
    expect(migrated?.tileBack.sideColor).toBe('#17483f');
  });
});
