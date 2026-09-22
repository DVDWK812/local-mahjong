import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MUSIC_PREFERENCES,
  MUSIC_PREFERENCES_STORAGE_KEY,
  loadMusicPreferences,
  resetMusicPreferences,
  saveMusicPreferences,
} from './musicPreferences';

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

describe('Music Preferences', () => {
  it('无数据时读取默认值，保存后可恢复顺序、模式、禁用与最近播放', () => {
    const storage = memoryStorage();
    expect(loadMusicPreferences(storage)).toEqual(DEFAULT_MUSIC_PREFERENCES);
    const preferences = {
      disabledBuiltinTrackIds: ['builtin:bgm_main:old'],
      order: { bgm_main: ['b', 'a'], effects: ['x'] },
      playbackMode: { bgm_main: 'shuffle' as const, bgm_game: 'repeat-one' as const },
      lastSelectedTrackId: { bgm_richi: 'builtin:bgm_richi:tenpai', bgm_main: null },
      sfxLastSelectedTrackId: { draw: 'builtin:effects:draw-b', discard: null },
      sfxOrder: { meld: ['builtin:effects:meld-a', 'builtin:effects:meld-b'] },
      sfxPlaybackMode: { draw: 'shuffle' as const, discard: 'repeat-one' as const },
    };
    saveMusicPreferences(preferences, storage);
    expect(loadMusicPreferences(storage)).toEqual(preferences);
  });

  it('损坏 JSON、空值、数组和未知版本安全回退', () => {
    const storage = memoryStorage();
    for (const value of ['{broken', 'null', '[]', '{"version":2,"preferences":{}}']) {
      storage.setItem(MUSIC_PREFERENCES_STORAGE_KEY, value);
      expect(loadMusicPreferences(storage)).toEqual(DEFAULT_MUSIC_PREFERENCES);
    }
  });

  it('无效播放模式回退顺序播放，缺失字段使用默认值', () => {
    const storage = memoryStorage();
    storage.setItem(MUSIC_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: 1,
      preferences: {
        playbackMode: { bgm_main: 'party', bgm_game: 'repeat-one' },
        order: { bgm_main: ['a', 42, 'b'] },
        disabledBuiltinTrackIds: ['ok', 7, null],
        lastSelectedTrackId: { bgm_main: 'track-a', bgm_game: 9 },
      },
    }));
    expect(loadMusicPreferences(storage)).toEqual({
      disabledBuiltinTrackIds: ['ok'],
      order: { bgm_main: ['a', 'b'] },
      playbackMode: { bgm_main: 'sequential', bgm_game: 'repeat-one' },
      lastSelectedTrackId: { bgm_main: 'track-a', bgm_game: null },
      sfxLastSelectedTrackId: {},
      sfxOrder: {},
      sfxPlaybackMode: {},
    });
  });

  it('sfx 偏好独立归一化：无效 order 项过滤、lastSelected 保持 null 语义', () => {
    const storage = memoryStorage();
    storage.setItem(MUSIC_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: 1,
      preferences: {
        sfxOrder: { draw: ['a', 42, 'b'], meld: 'not-array' },
        sfxLastSelectedTrackId: { draw: 'target', discard: 7, meld: null },
        sfxPlaybackMode: { draw: 'party', discard: 'repeat-one' },
      },
    }));
    expect(loadMusicPreferences(storage)).toEqual({
      disabledBuiltinTrackIds: [],
      order: {},
      playbackMode: {},
      lastSelectedTrackId: {},
      sfxLastSelectedTrackId: { draw: 'target', discard: null, meld: null },
      sfxOrder: { draw: ['a', 'b'] },
      sfxPlaybackMode: { draw: 'sequential', discard: 'repeat-one' },
    });
  });

  it('reset 删除存储并返回独立默认对象', () => {
    const storage = memoryStorage();
    saveMusicPreferences({ ...DEFAULT_MUSIC_PREFERENCES, playbackMode: { bgm_main: 'shuffle' } }, storage);
    const reset = resetMusicPreferences(storage);
    expect(reset).toEqual(DEFAULT_MUSIC_PREFERENCES);
    expect(reset).not.toBe(DEFAULT_MUSIC_PREFERENCES);
    expect(storage.getItem(MUSIC_PREFERENCES_STORAGE_KEY)).toBeNull();
  });
});
