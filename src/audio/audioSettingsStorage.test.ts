import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from './audioSettings';
import {
  AUDIO_SETTINGS_LEGACY_STORAGE_KEY,
  AUDIO_SETTINGS_STORAGE_KEY,
  AUDIO_SETTINGS_STORAGE_VERSION,
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
    const settings = { ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0.5, bgmEnabled: false, bgmGameEnabled: false };
    saveAudioSettings(settings, storage);
    expect(loadAudioSettings(storage)).toEqual(settings);
    expect(storage.getItem(AUDIO_SETTINGS_STORAGE_KEY)).toContain(`"version":${AUDIO_SETTINGS_STORAGE_VERSION}`);
  });

  it('保存后可恢复已选择的角色语音 Pack', () => {
    const storage = memoryStorage();
    const settings = { ...DEFAULT_AUDIO_SETTINGS, selectedVoicePackId: 'xiaozhang' };
    saveAudioSettings(settings, storage);
    expect(loadAudioSettings(storage).selectedVoicePackId).toBe('xiaozhang');
  });

  it('损坏 JSON、空值、数组和未知版本安全回退', () => {
    const storage = memoryStorage();
    for (const value of ['{broken json', 'null', '[]', `{"version":${AUDIO_SETTINGS_STORAGE_VERSION + 1},"settings":{}}`]) {
      storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, value);
      expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
    }
  });

  it('合法版本按字段回退并 clamp 有限数值，拒绝字符串、NaN、Infinity 和 null', () => {
    const storage = memoryStorage();
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({
      version: AUDIO_SETTINGS_STORAGE_VERSION,
      settings: {
        masterVolume: -1,
        bgmVolume: 2,
        bgmGameVolume: '0.5',
        bgmRiichiVolume: null,
        sfxVolume: 0.25,
        voiceVolume: '0.5',
        bgmEnabled: false,
        bgmGameEnabled: 'false',
      },
    }));
    expect(loadAudioSettings(storage)).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      masterVolume: 0,
      bgmVolume: 1,
      bgmGameVolume: DEFAULT_AUDIO_SETTINGS.bgmGameVolume,
      bgmRiichiVolume: DEFAULT_AUDIO_SETTINGS.bgmRiichiVolume,
      sfxVolume: 0.25,
      bgmEnabled: false,
    });

    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({
      version: AUDIO_SETTINGS_STORAGE_VERSION,
      settings: { masterVolume: Number.NaN, bgmVolume: Number.POSITIVE_INFINITY },
    }));
    expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('旧 v1 设置安全迁移：保留全部旧字段，新增分类音量与开关使用默认值', () => {
    const storage = memoryStorage();
    storage.setItem(AUDIO_SETTINGS_LEGACY_STORAGE_KEY, JSON.stringify({
      version: 1,
      settings: {
        masterVolume: 0.55,
        bgmVolume: 0.7,
        sfxVolume: 0.4,
        voiceVolume: 0.9,
        bgmEnabled: false,
        sfxEnabled: false,
        voiceEnabled: true,
        riichiMusicEnabled: false,
      },
    }));
    expect(loadAudioSettings(storage)).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      masterVolume: 0.55,
      bgmVolume: 0.7,
      sfxVolume: 0.4,
      voiceVolume: 0.9,
      bgmEnabled: false,
      sfxEnabled: false,
      voiceEnabled: true,
      riichiMusicEnabled: false,
    });
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
