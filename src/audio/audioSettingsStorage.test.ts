import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from './audioSettings';
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  loadAudioSettings,
  resetAudioSettings,
  saveAudioSettings,
} from './audioSettingsStorage';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('AudioSettings storage', () => {
  it('无数据时读取稳定默认值，保存后刷新可恢复同值', () => {
    const storage = memoryStorage();
    expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
    const settings = { ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0.5, bgmEnabled: false };
    saveAudioSettings(settings, storage);
    expect(loadAudioSettings(storage)).toEqual(settings);
  });

  it('损坏 JSON、空值、数组和未知版本安全回退', () => {
    const storage = memoryStorage();
    for (const value of ['{broken json', 'null', '[]', '{"version":2,"settings":{}}']) {
      storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, value);
      expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
    }
  });

  it('合法版本按字段回退并 clamp 有限数值，拒绝字符串、NaN、Infinity 和 null', () => {
    const storage = memoryStorage();
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({
      version: 1,
      settings: {
        masterVolume: -1,
        bgmVolume: 2,
        sfxVolume: '0.5',
        voiceVolume: null,
        bgmEnabled: false,
        sfxEnabled: 'false',
      },
    }));
    expect(loadAudioSettings(storage)).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      masterVolume: 0,
      bgmVolume: 1,
      sfxVolume: DEFAULT_AUDIO_SETTINGS.sfxVolume,
      voiceVolume: DEFAULT_AUDIO_SETTINGS.voiceVolume,
      bgmEnabled: false,
    });

    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({
      version: 1,
      settings: { masterVolume: Number.NaN, bgmVolume: Number.POSITIVE_INFINITY },
    }));
    expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('reset 删除存储并返回独立默认对象', () => {
    const storage = memoryStorage();
    saveAudioSettings({ ...DEFAULT_AUDIO_SETTINGS, voiceEnabled: false }, storage);
    const reset = resetAudioSettings(storage);
    expect(reset).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(reset).not.toBe(DEFAULT_AUDIO_SETTINGS);
    expect(storage.getItem(AUDIO_SETTINGS_STORAGE_KEY)).toBeNull();
  });
});
