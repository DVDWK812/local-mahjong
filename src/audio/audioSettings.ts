export interface AudioSettings {
  readonly masterVolume: number;
  readonly bgmVolume: number;
  readonly bgmGameVolume: number;
  readonly bgmRiichiVolume: number;
  readonly sfxVolume: number;
  readonly voiceVolume: number;
  readonly bgmEnabled: boolean;
  readonly bgmGameEnabled: boolean;
  readonly riichiMusicEnabled: boolean;
  readonly sfxEnabled: boolean;
  readonly voiceEnabled: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  masterVolume: 0.8,
  bgmVolume: 0.6,
  bgmGameVolume: 0.6,
  bgmRiichiVolume: 0.6,
  sfxVolume: 0.8,
  voiceVolume: 0.8,
  bgmEnabled: true,
  bgmGameEnabled: true,
  riichiMusicEnabled: true,
  sfxEnabled: true,
  voiceEnabled: true,
});

export type AudioChannel = 'bgm' | 'sfx' | 'voice';

function normalizeVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeAudioSettings(value: unknown): AudioSettings {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Record<keyof AudioSettings, unknown>>
    : {};
  return {
    masterVolume: normalizeVolume(input.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
    bgmVolume: normalizeVolume(input.bgmVolume, DEFAULT_AUDIO_SETTINGS.bgmVolume),
    bgmGameVolume: normalizeVolume(input.bgmGameVolume, DEFAULT_AUDIO_SETTINGS.bgmGameVolume),
    bgmRiichiVolume: normalizeVolume(input.bgmRiichiVolume, DEFAULT_AUDIO_SETTINGS.bgmRiichiVolume),
    sfxVolume: normalizeVolume(input.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
    voiceVolume: normalizeVolume(input.voiceVolume, DEFAULT_AUDIO_SETTINGS.voiceVolume),
    bgmEnabled: normalizeBoolean(input.bgmEnabled, DEFAULT_AUDIO_SETTINGS.bgmEnabled),
    bgmGameEnabled: normalizeBoolean(input.bgmGameEnabled, DEFAULT_AUDIO_SETTINGS.bgmGameEnabled),
    riichiMusicEnabled: normalizeBoolean(input.riichiMusicEnabled, DEFAULT_AUDIO_SETTINGS.riichiMusicEnabled),
    sfxEnabled: normalizeBoolean(input.sfxEnabled, DEFAULT_AUDIO_SETTINGS.sfxEnabled),
    voiceEnabled: normalizeBoolean(input.voiceEnabled, DEFAULT_AUDIO_SETTINGS.voiceEnabled),
  };
}

/**
 * 从 UI-1B 的 v1 设置迁移到 v2：
 * 旧字段直接保留（bgmVolume / bgmEnabled 即“背景音乐”分类），
 * 新增的游戏音乐 / 立直音乐字段使用默认值。
 */
export function migrateLegacyAudioSettings(legacy: unknown): AudioSettings {
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return { ...DEFAULT_AUDIO_SETTINGS };
  const input = legacy as Partial<Record<string, unknown>>;
  return normalizeAudioSettings({
    masterVolume: input.masterVolume,
    bgmVolume: input.bgmVolume,
    sfxVolume: input.sfxVolume,
    voiceVolume: input.voiceVolume,
    bgmEnabled: input.bgmEnabled,
    sfxEnabled: input.sfxEnabled,
    voiceEnabled: input.voiceEnabled,
    riichiMusicEnabled: input.riichiMusicEnabled,
  });
}

export function audioVolumePercent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}
