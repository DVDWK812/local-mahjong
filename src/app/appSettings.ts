import {
  RuleConfigStorageError,
  createRuleConfigStorageAdapter,
  type RuleConfigStorageAdapter,
  type RuleConfigStorageResult,
} from '../game/match/matchRules';

export type ResolutionPreset = 'auto' | '720p' | '1080p' | '2k' | '4k';

export interface AppSettingsV1 {
  version: 1;
  resolutionPreset: ResolutionPreset;
}

export interface ResolutionConfig {
  preset: ResolutionPreset;
  width: number | null;
  height: number | null;
  label: string;
}

export const RESOLUTION_PRESETS: Record<ResolutionPreset, { width: number | null; height: number | null; label: string }> = {
  auto: { width: null, height: null, label: '自动' },
  '720p': { width: 1280, height: 720, label: '720p' },
  '1080p': { width: 1920, height: 1080, label: '1080p' },
  '2k': { width: 2560, height: 1440, label: '2K' },
  '4k': { width: 3840, height: 2160, label: '4K' },
};

export const APP_SETTINGS_STORAGE_KEY = 'local-mahjong.app-settings.v1';
export const DEFAULT_APP_SETTINGS: AppSettingsV1 = { version: 1, resolutionPreset: 'auto' };
export const APP_SETTINGS_SAVE_FAILURE_NOTICE = '设置已应用，但无法保存到浏览器；刷新页面后可能恢复原设置。';
export const APP_SETTINGS_LOAD_FAILURE_NOTICE = '无法读取浏览器中的设置，当前会话将使用默认设置。';

export type AppSettingsLoadResult =
  | { ok: true; settings: AppSettingsV1 }
  | { ok: false; settings: AppSettingsV1; error: RuleConfigStorageError };

export function resolutionConfigForPreset(preset: ResolutionPreset): ResolutionConfig {
  return { preset, ...RESOLUTION_PRESETS[preset] };
}

export function loadAppSettings(storage?: RuleConfigStorageAdapter): AppSettingsLoadResult {
  try {
    const raw = (storage ?? defaultSettingsStorage()).getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return { ok: true, settings: { ...DEFAULT_APP_SETTINGS } };
    const parsed = JSON.parse(raw) as { version?: unknown; resolutionPreset?: unknown };
    if (parsed.version !== 1) return { ok: true, settings: { ...DEFAULT_APP_SETTINGS } };
    return {
      ok: true,
      settings: {
        version: 1,
        resolutionPreset: isResolutionPreset(parsed.resolutionPreset) ? parsed.resolutionPreset : DEFAULT_APP_SETTINGS.resolutionPreset,
      },
    };
  } catch (error) {
    return {
      ok: false,
      settings: { ...DEFAULT_APP_SETTINGS },
      error: new RuleConfigStorageError('read', error, error instanceof SyntaxError ? 'invalid-data' : undefined),
    };
  }
}

export function saveAppSettings(settings: AppSettingsV1, storage?: RuleConfigStorageAdapter): RuleConfigStorageResult {
  try {
    (storage ?? defaultSettingsStorage()).setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: new RuleConfigStorageError('write', error) };
  }
}

export function persistAppSettingsUpdate(settings: AppSettingsV1, storage?: RuleConfigStorageAdapter): {
  settings: AppSettingsV1;
  result: RuleConfigStorageResult;
  notice: string | null;
} {
  const result = saveAppSettings(settings, storage);
  return { settings, result, notice: result.ok ? null : APP_SETTINGS_SAVE_FAILURE_NOTICE };
}

function isResolutionPreset(value: unknown): value is ResolutionPreset {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RESOLUTION_PRESETS, value);
}

function defaultSettingsStorage(): RuleConfigStorageAdapter {
  if (typeof localStorage === 'undefined') throw new RuleConfigStorageError('read', new Error('localStorage 不可用'));
  return createRuleConfigStorageAdapter(localStorage);
}
