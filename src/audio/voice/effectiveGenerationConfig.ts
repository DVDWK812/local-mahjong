import type { VoiceLine, VoicePackMeta, VoiceSynthesisSettings } from './types';
import { normalizeVoiceSynthesisSettings } from './voiceSynthesisSettings';

export const VOICE_FINGERPRINT_VERSION = 'voice-fingerprint-v2' as const;

/** Minimal v3 capability context. Omitted means the current generator contract is unchanged. */
export interface GenerationCapabilityContext {
  readonly controls?: Partial<Record<'speed' | 'volume' | 'stability' | 'similarity' | 'language' | 'textNormalization' | 'pitch' | 'emotion' | 'instruction', boolean>>;
}

export const GENERATION_CONTROL_NAMES = ['speed', 'volume', 'stability', 'similarity', 'language', 'textNormalization', 'pitch', 'emotion', 'instruction'] as const;
type GenerationControlName = typeof GENERATION_CONTROL_NAMES[number];

/**
 * A saved capability snapshot is authoritative only when discovery supplied
 * every control. Older partial snapshots must retain legacy semantics rather
 * than silently treating omitted numeric controls as unsupported.
 */
export function completeGenerationCapabilityContext(capabilities?: GenerationCapabilityContext): GenerationCapabilityContext | undefined {
  const controls = capabilities?.controls;
  if (!controls || !GENERATION_CONTROL_NAMES.every((name) => typeof controls[name] === 'boolean')) return undefined;
  return { controls: Object.fromEntries(GENERATION_CONTROL_NAMES.map((name) => [name, controls[name] as boolean])) as Record<GenerationControlName, boolean> };
}

/** The single identity used by plans, cache fingerprints, and future Fish requests. */
export interface EffectiveGenerationConfig {
  readonly text: string;
  readonly voiceId: string;
  readonly modelId: string;
  readonly format: string;
  readonly speed?: number;
  readonly volume?: number;
  readonly stability?: number;
  readonly similarity?: number;
  readonly effectiveLanguage?: string;
  readonly textNormalization?: boolean;
  readonly pitch?: number;
  readonly ttsEmotion?: string;
  readonly ttsInstruction?: string;
}

// Legacy Packs omit the whole capability snapshot and retain the historical
// controls. Once a snapshot exists, a control is effective only when Fish
// explicitly declared it true; this mirrors generate_voice.py exactly.
const enabled = (capabilities: GenerationCapabilityContext | undefined, control: GenerationControlName) => capabilities?.controls === undefined || capabilities.controls[control] === true;
const newControlEnabled = (capabilities: GenerationCapabilityContext | undefined, control: 'pitch' | 'emotion' | 'instruction') => capabilities?.controls?.[control] === true;

export function resolveEffectiveGenerationConfig(
  line: Pick<VoiceLine, 'line' | 'tts_text' | 'speed' | 'volume' | 'stability' | 'similarity' | 'language_override' | 'text_normalization' | 'pitch' | 'tts_emotion' | 'tts_instruction'>,
  meta: Pick<VoicePackMeta, 'voiceId' | 'modelId' | 'locale'>,
  synthesis: Pick<VoiceSynthesisSettings, 'format'>,
  capabilities?: GenerationCapabilityContext,
): EffectiveGenerationConfig {
  const normalized = normalizeVoiceSynthesisSettings(line);
  const authoritativeCapabilities = completeGenerationCapabilityContext(capabilities);
  return {
    text: line.tts_text.trim() ? line.tts_text : line.line.trim(),
    voiceId: meta.voiceId,
    modelId: meta.modelId,
    format: synthesis.format,
    ...(enabled(authoritativeCapabilities, 'speed') ? { speed: normalized.speed } : {}),
    ...(enabled(authoritativeCapabilities, 'volume') ? { volume: normalized.volume } : {}),
    ...(enabled(authoritativeCapabilities, 'stability') ? { stability: normalized.stability } : {}),
    ...(enabled(authoritativeCapabilities, 'similarity') ? { similarity: normalized.similarity } : {}),
    ...(enabled(authoritativeCapabilities, 'language') ? { effectiveLanguage: normalized.languageOverride || meta.locale } : {}),
    ...(enabled(authoritativeCapabilities, 'textNormalization') ? { textNormalization: normalized.textNormalization } : {}),
    ...(newControlEnabled(authoritativeCapabilities, 'pitch') && normalized.pitch !== undefined ? { pitch: normalized.pitch } : {}),
    ...(newControlEnabled(authoritativeCapabilities, 'emotion') && normalized.ttsEmotion ? { ttsEmotion: normalized.ttsEmotion } : {}),
    ...(newControlEnabled(authoritativeCapabilities, 'instruction') && normalized.ttsInstruction ? { ttsInstruction: normalized.ttsInstruction } : {}),
  };
}

const canonicalNumber = (value: number | undefined): string => value === undefined ? '' : Number.isInteger(value) ? value.toFixed(1) : String(value);

/** Fixed-order, cross-language serialization. Never hash arbitrary object JSON. */
export function canonicalEffectiveGenerationConfigPayload(config: EffectiveGenerationConfig): string {
  return [
    VOICE_FINGERPRINT_VERSION, config.text, config.voiceId, config.modelId, config.format,
    canonicalNumber(config.speed), canonicalNumber(config.volume), canonicalNumber(config.stability), canonicalNumber(config.similarity),
    config.effectiveLanguage ?? '', config.textNormalization === undefined ? '' : String(config.textNormalization),
    canonicalNumber(config.pitch), config.ttsEmotion ?? '', config.ttsInstruction ?? '',
  ].join('\x1f');
}
