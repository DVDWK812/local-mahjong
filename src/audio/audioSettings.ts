export interface AudioSettings {
  readonly masterVolume: number;
  readonly bgmVolume: number;
  readonly sfxVolume: number;
  readonly voiceVolume: number;
  readonly bgmEnabled: boolean;
  readonly sfxEnabled: boolean;
  readonly voiceEnabled: boolean;
  readonly riichiMusicEnabled: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  masterVolume: 0.8,
  bgmVolume: 0.6,
  sfxVolume: 0.8,
  voiceVolume: 0.8,
  bgmEnabled: true,
  sfxEnabled: true,
  voiceEnabled: true,
  riichiMusicEnabled: true,
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
    sfxVolume: normalizeVolume(input.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
    voiceVolume: normalizeVolume(input.voiceVolume, DEFAULT_AUDIO_SETTINGS.voiceVolume),
    bgmEnabled: normalizeBoolean(input.bgmEnabled, DEFAULT_AUDIO_SETTINGS.bgmEnabled),
    sfxEnabled: normalizeBoolean(input.sfxEnabled, DEFAULT_AUDIO_SETTINGS.sfxEnabled),
    voiceEnabled: normalizeBoolean(input.voiceEnabled, DEFAULT_AUDIO_SETTINGS.voiceEnabled),
    riichiMusicEnabled: normalizeBoolean(input.riichiMusicEnabled, DEFAULT_AUDIO_SETTINGS.riichiMusicEnabled),
  };
}

export function audioVolumePercent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}
