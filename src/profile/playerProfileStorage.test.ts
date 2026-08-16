import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_PROFILE } from './playerProfile';
import {
  PLAYER_PROFILE_STORAGE_KEY,
  loadPlayerProfile,
  resetPlayerProfile,
  savePlayerProfile,
} from './playerProfileStorage';

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

describe('PlayerProfile storage', () => {
  it('无存储数据时读取默认值，保存后可读取同值', () => {
    const storage = memoryStorage();
    expect(loadPlayerProfile(storage)).toEqual(DEFAULT_PLAYER_PROFILE);
    savePlayerProfile({ nickname: '麻将玩家', avatarId: 'avatar-04' }, storage);
    expect(loadPlayerProfile(storage)).toEqual({ nickname: '麻将玩家', avatarId: 'avatar-04' });
  });

  it('新增头像沿用 v1 存储格式并可立即读回', () => {
    const storage = memoryStorage();
    savePlayerProfile({ nickname: '水豚玩家', avatarId: 'animal-capybara' }, storage);
    expect(loadPlayerProfile(storage)).toEqual({ nickname: '水豚玩家', avatarId: 'animal-capybara' });
  });

  it('损坏 JSON、未知版本和任意对象不会阻止启动', () => {
    const storage = memoryStorage();
    for (const value of ['{broken json', 'null', '[]', '{"version":2,"nickname":"旧数据","avatarId":"avatar-01"}']) {
      storage.setItem(PLAYER_PROFILE_STORAGE_KEY, value);
      expect(loadPlayerProfile(storage)).toEqual(DEFAULT_PLAYER_PROFILE);
    }
  });

  it('合法版本采用字段级 fallback，并支持 reset', () => {
    const storage = memoryStorage();
    storage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify({
      version: 1,
      nickname: '  Wenkai  ',
      avatarId: 'not-exist',
    }));
    expect(loadPlayerProfile(storage)).toEqual({ nickname: 'Wenkai', avatarId: DEFAULT_PLAYER_PROFILE.avatarId });
    expect(resetPlayerProfile(storage)).toEqual(DEFAULT_PLAYER_PROFILE);
    expect(storage.getItem(PLAYER_PROFILE_STORAGE_KEY)).toBeNull();
  });
});
