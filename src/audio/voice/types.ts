/** Runtime-safe data contracts for build-time discovered Voice Packs. */

export type VoiceAvailabilityStatus = 'available' | 'missing-audio' | 'missing-voice-line';

export interface VoicePackMeta { readonly id: string; readonly name: string; readonly locale: string; readonly voiceId: string; readonly modelId: string; }
export interface VoiceManifestEntry { readonly file: string; }
export interface VoiceManifest { readonly character: string; readonly voiceId: string; readonly voices: Readonly<Record<string, VoiceManifestEntry>>; }
export interface VoiceLine {
  readonly key: string; readonly category: string; readonly action: string; readonly line: string;
  readonly tts_text: string; readonly locale: string; readonly character: string; readonly emotion: string;
  readonly action_cn?: string;
}
export interface VoicePackSummary { readonly id: string; readonly name: string; readonly locale: string; readonly path: string; }
export interface VoiceAvailability { readonly key: string; readonly file: string; readonly status: VoiceAvailabilityStatus; }
export interface VoiceGenerationCacheEntry {
  readonly key: string; readonly fingerprint: string; readonly line: string; readonly ttsText: string;
  readonly voiceId: string; readonly modelId: string; readonly speed: number; readonly format: string; readonly file: string;
}
export interface VoiceSynthesisSettings { readonly speed: number; readonly format: string; }
export interface VoicePackDetail {
  readonly meta: VoicePackMeta; readonly manifest: VoiceManifest; readonly voiceLines: readonly VoiceLine[];
  readonly voiceAvailability: Readonly<Record<string, VoiceAvailability>>;
  readonly generationCache: Readonly<Record<string, VoiceGenerationCacheEntry>>;
  readonly failedKeys: readonly string[];
  readonly synthesis: VoiceSynthesisSettings;
}
export type VoicePackDiagnosticCode =
  | 'invalid-index' | 'duplicate-pack-id' | 'missing-pack-metadata' | 'invalid-pack-metadata'
  | 'missing-manifest' | 'invalid-manifest' | 'missing-voice-lines' | 'invalid-voice-lines'
  | 'missing-audio' | 'missing-voice-line' | 'orphan-audio';
export interface VoicePackDiagnostic { readonly code: VoicePackDiagnosticCode; readonly message: string; readonly packId?: string; readonly key?: string; }
export interface VoicePackIndex { readonly schemaVersion: 1; readonly packs: readonly VoicePackSummary[]; }
