import type { VoiceLine } from './types';
import contract from './voiceSynthesisSettings.contract.json';

export const DEFAULT_VOICE_GENERATION_SETTINGS = {
  speed: contract.defaults.speed,
  volume: contract.defaults.volume,
  stability: contract.defaults.stability,
  similarity: contract.defaults.similarity,
  textNormalization: contract.defaults.text_normalization,
} as const;
export const VOICE_SYNTHESIS_CSV_COLUMNS = contract.columns as unknown as readonly ['speed', 'volume', 'stability', 'similarity', 'language_override', 'text_normalization', 'pitch', 'tts_emotion', 'tts_instruction'];

export type VoiceGenerationSettingsPatch = Partial<Pick<NormalizedVoiceSynthesisSettings, 'speed' | 'volume' | 'stability' | 'similarity' | 'textNormalization'>> & {
  readonly languageOverride?: string; readonly pitch?: number | null; readonly ttsEmotion?: string; readonly ttsInstruction?: string;
};

export interface NormalizedVoiceSynthesisSettings {
  readonly speed: number; readonly volume: number; readonly stability: number; readonly similarity: number;
  readonly languageOverride: string; readonly textNormalization: boolean; readonly pitch?: number; readonly ttsEmotion: string; readonly ttsInstruction: string;
}

const numberOr = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};
const optionalNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function parseTextNormalization(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  if (value.trim().toLowerCase() === 'true') return true;
  if (value.trim().toLowerCase() === 'false') return false;
  return fallback;
}

/** The single browser-side CSV normalization contract for legacy and current VoiceLines. */
export function normalizeVoiceSynthesisSettings(raw: Pick<VoiceLine, 'speed' | 'volume' | 'stability' | 'similarity' | 'language_override' | 'text_normalization' | 'pitch' | 'tts_emotion' | 'tts_instruction'>): NormalizedVoiceSynthesisSettings {
  return {
    speed: numberOr(raw.speed, DEFAULT_VOICE_GENERATION_SETTINGS.speed),
    volume: numberOr(raw.volume, DEFAULT_VOICE_GENERATION_SETTINGS.volume),
    stability: numberOr(raw.stability, DEFAULT_VOICE_GENERATION_SETTINGS.stability),
    similarity: numberOr(raw.similarity, DEFAULT_VOICE_GENERATION_SETTINGS.similarity),
    languageOverride: raw.language_override?.trim() || contract.defaults.language_override,
    textNormalization: parseTextNormalization(raw.text_normalization, DEFAULT_VOICE_GENERATION_SETTINGS.textNormalization),
    ...(optionalNumber(raw.pitch) !== undefined ? { pitch: optionalNumber(raw.pitch) } : {}),
    ttsEmotion: raw.tts_emotion?.trim() ?? '', ttsInstruction: raw.tts_instruction ?? '',
  };
}

export function generationSettingsPatchToCsv(patch: VoiceGenerationSettingsPatch): Partial<Pick<VoiceLine, 'speed' | 'volume' | 'stability' | 'similarity' | 'language_override' | 'text_normalization' | 'pitch' | 'tts_emotion' | 'tts_instruction'>> {
  return {
    ...(patch.speed !== undefined ? { speed: String(patch.speed) } : {}),
    ...(patch.volume !== undefined ? { volume: String(patch.volume) } : {}),
    ...(patch.stability !== undefined ? { stability: String(patch.stability) } : {}),
    ...(patch.similarity !== undefined ? { similarity: String(patch.similarity) } : {}),
    ...(patch.languageOverride !== undefined ? { language_override: patch.languageOverride } : {}),
    ...(patch.textNormalization !== undefined ? { text_normalization: String(patch.textNormalization) } : {}),
    ...(patch.pitch !== undefined ? { pitch: patch.pitch === null ? '' : String(patch.pitch) } : {}),
    ...(patch.ttsEmotion !== undefined ? { tts_emotion: patch.ttsEmotion } : {}),
    ...(patch.ttsInstruction !== undefined ? { tts_instruction: patch.ttsInstruction } : {}),
  };
}

export function defaultGenerationSettingsPatch(): Required<VoiceGenerationSettingsPatch> {
  return {
    ...DEFAULT_VOICE_GENERATION_SETTINGS,
    languageOverride: '',
    pitch: null,
    ttsEmotion: '',
    ttsInstruction: '',
  };
}

export function validateGenerationSettingsPatch(patch: VoiceGenerationSettingsPatch): string | undefined {
  const values: Array<[string, number | undefined, number, number]> = [
    ['语速', patch.speed, 0.5, 2], ['音量', patch.volume, -20, 20],
    ['稳定性', patch.stability, 0, 1], ['相似度', patch.similarity, 0, 1],
    ['音高', patch.pitch ?? undefined, -12, 12],
  ];
  for (const [label, value, min, max] of values) {
    if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) return `${label}必须在 ${min} 到 ${max} 之间。`;
  }
  if (patch.ttsInstruction !== undefined && patch.ttsInstruction.length > 1600) return '风格指令最多 1600 个字符。';
  return undefined;
}
