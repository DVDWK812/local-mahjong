import { describe, expect, it } from 'vitest';
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  persistAppSettingsUpdate,
  resolutionConfigForPreset,
  saveAppSettings,
} from './appSettings';

describe('应用设置持久化', () => {
  it('默认分辨率为auto', () => {
    expect(loadAppSettings(memoryStorage()).settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(DEFAULT_APP_SETTINGS.resolutionPreset).toBe('auto');
  });

  it.each(['auto', '720p', '2k', '4k'] as const)('修改为%s后立即保存且重新加载可恢复', (resolutionPreset) => {
    const storage = memoryStorage();
    const settings = { version: 1 as const, resolutionPreset };
    expect(saveAppSettings(settings, storage)).toEqual({ ok: true });
    expect(loadAppSettings(storage)).toEqual({ ok: true, settings });
  });

  it('旧数据缺少分辨率以及无效值时回退auto', () => {
    const missing = memoryStorage(JSON.stringify({ version: 1 }));
    const invalid = memoryStorage(JSON.stringify({ version: 1, resolutionPreset: '8k' }));
    expect(loadAppSettings(missing).settings.resolutionPreset).toBe('auto');
    expect(loadAppSettings(invalid).settings.resolutionPreset).toBe('auto');
  });

  it.each(['1080p', '4k'] as const)('兼容读取旧%s设置且不丢失', (resolutionPreset) => {
    const storage = memoryStorage(JSON.stringify({ version: 1, resolutionPreset }));
    expect(loadAppSettings(storage).settings.resolutionPreset).toBe(resolutionPreset);
  });

  it('写入失败时当前内存选择仍生效并返回非阻断提示', () => {
    const original = JSON.stringify({ version: 1, resolutionPreset: '1080p' });
    const storage = {
      getItem: () => original,
      setItem: () => { throw namedError('QuotaExceededError'); },
      removeItem: () => undefined,
    };
    const settings = { version: 1 as const, resolutionPreset: '4k' as const };
    const outcome = persistAppSettingsUpdate(settings, storage);
    expect(outcome.settings).toBe(settings);
    expect(outcome.result).toMatchObject({ ok: false, error: { operation: 'write', kind: 'quota' } });
    expect(outcome.notice).toContain('已应用');
    expect(loadAppSettings(storage).settings.resolutionPreset).toBe('1080p');
  });

  it('使用独立设置键且不写规则、存档或牌谱键', () => {
    const writes: string[] = [];
    saveAppSettings({ version: 1, resolutionPreset: '720p' }, {
      getItem: () => null,
      setItem: (key) => writes.push(key),
      removeItem: () => undefined,
    });
    expect(writes).toEqual([APP_SETTINGS_STORAGE_KEY]);
    expect(APP_SETTINGS_STORAGE_KEY).toBe('local-mahjong.app-settings.v1');
  });

  it.each([
    ['auto', null, null],
    ['720p', 1280, 720],
    ['1080p', 1920, 1080],
    ['2k', 2560, 1440],
    ['4k', 3840, 2160],
  ] as const)('%s转换为共享逻辑渲染尺寸', (preset, width, height) => {
    expect(resolutionConfigForPreset(preset)).toMatchObject({ preset, width, height });
  });
});

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(APP_SETTINGS_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function namedError(name: string): Error {
  const error = new Error('write failed');
  error.name = name;
  return error;
}
