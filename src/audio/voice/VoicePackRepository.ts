import voicePackIndex from '../../music/voice_lines/voice_packs.json';
import fishAudioConfig from '../config/fish_audio.example.json';
import type { VoiceAvailability, VoiceGenerationCacheEntry, VoiceLine, VoiceManifest, VoiceManifestEntry, VoicePackDetail, VoicePackDiagnostic, VoicePackIndex, VoicePackMeta, VoicePackSummary, VoiceSynthesisSettings } from './types';

type JsonModuleMap = Readonly<Record<string, unknown>>;
type AudioModuleMap = Readonly<Record<string, string>>;
export interface VoicePackRepositorySources {
  readonly index: unknown; readonly packMetadata: JsonModuleMap; readonly manifests: JsonModuleMap; readonly voiceLines: JsonModuleMap; readonly audio: AudioModuleMap;
  readonly caches?: JsonModuleMap; readonly failures?: JsonModuleMap; readonly generationLogs?: JsonModuleMap; readonly synthesis?: unknown;
}

const PACK_PATH_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const SOURCE_ROOT = '../../music/voice_lines';
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonEmptyString = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const safePackPath = (path: string): boolean => PACK_PATH_PATTERN.test(path);
const diagnostic = (code: VoicePackDiagnostic['code'], message: string, packId?: string, key?: string): VoicePackDiagnostic => ({ code, message, ...(packId ? { packId } : {}), ...(key ? { key } : {}) });
const packFilePath = (path: string, file: 'pack.json' | 'manifest.json' | 'voice_lines.json' | '.voice_cache.json' | 'failed.json' | 'generation_log.json'): string => `${SOURCE_ROOT}/${path}/${file}`;
const audioFilePath = (path: string, file: string): string => `${SOURCE_ROOT}/${path}/${file}`;

function parseIndex(value: unknown): { index?: VoicePackIndex; diagnostics: VoicePackDiagnostic[] } {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.packs)) return { diagnostics: [diagnostic('invalid-index', 'Voice Pack index must contain schemaVersion 1 and a packs array.')] };
  const packs: VoicePackSummary[] = [];
  const diagnostics: VoicePackDiagnostic[] = [];
  for (const candidate of value.packs) {
    if (!isRecord(candidate)) { diagnostics.push(diagnostic('invalid-index', 'Voice Pack index contains a non-object entry.')); continue; }
    const id = nonEmptyString(candidate.id); const name = nonEmptyString(candidate.name); const locale = nonEmptyString(candidate.locale); const path = nonEmptyString(candidate.path);
    if (!id || !name || !locale || !path || !safePackPath(id) || !safePackPath(path) || !LOCALE_PATTERN.test(locale)) { diagnostics.push(diagnostic('invalid-index', 'Voice Pack index entry has invalid id, name, locale, or path.', id)); continue; }
    packs.push({ id, name, locale, path });
  }
  return { index: { schemaVersion: 1, packs }, diagnostics };
}

function parseMeta(value: unknown, packId: string): { meta?: VoicePackMeta; diagnostic?: VoicePackDiagnostic } {
  if (!isRecord(value)) return { diagnostic: diagnostic('invalid-pack-metadata', 'pack.json must contain an object.', packId) };
  const id = nonEmptyString(value.id); const name = nonEmptyString(value.name); const locale = nonEmptyString(value.locale); const voiceId = nonEmptyString(value.voiceId); const modelId = nonEmptyString(value.modelId);
  if (!id || !name || !locale || !voiceId || !modelId || !safePackPath(id) || !LOCALE_PATTERN.test(locale)) return { diagnostic: diagnostic('invalid-pack-metadata', 'pack.json has missing or invalid required fields.', packId) };
  const rawControls = isRecord(value.ttsControls) ? value.ttsControls : undefined;
  const controlNames = ['speed', 'volume', 'pitch', 'stability', 'similarity', 'language', 'textNormalization', 'emotion', 'instruction'] as const;
  const ttsControls = rawControls && controlNames.every((name) => typeof rawControls[name] === 'boolean')
    ? Object.fromEntries(controlNames.map((name) => [name, rawControls[name] as boolean]))
    : undefined;
  return { meta: { id, name, locale, voiceId, modelId, ...(ttsControls ? { ttsControls } : {}) } };
}

function parseManifest(value: unknown, packId: string): { manifest?: VoiceManifest; diagnostics: VoicePackDiagnostic[] } {
  if (!isRecord(value)) return { diagnostics: [diagnostic('invalid-manifest', 'manifest.json must contain an object.', packId)] };
  const character = nonEmptyString(value.character); const voiceId = nonEmptyString(value.voiceId);
  if (!character || !voiceId || !isRecord(value.voices)) return { diagnostics: [diagnostic('invalid-manifest', 'manifest.json has missing required fields.', packId)] };
  const voices: Record<string, VoiceManifestEntry> = {}; const diagnostics: VoicePackDiagnostic[] = [];
  for (const [key, entry] of Object.entries(value.voices)) {
    const file = isRecord(entry) ? nonEmptyString(entry.file) : undefined;
    if (!key.trim() || !file || !file.startsWith('audio/') || !file.endsWith('.mp3') || file.includes('..') || file.includes('\\')) { diagnostics.push(diagnostic('invalid-manifest', 'Manifest entry has an invalid key or audio path.', packId, key)); continue; }
    voices[key] = { file };
  }
  return { manifest: { character, voiceId, voices }, diagnostics };
}

function parseVoiceLines(value: unknown, packId: string): { lines?: VoiceLine[]; diagnostic?: VoicePackDiagnostic } {
  if (!Array.isArray(value)) return { diagnostic: diagnostic('invalid-voice-lines', 'voice_lines.json must contain an array.', packId) };
  const lines: VoiceLine[] = []; const seenKeys = new Set<string>();
  for (const candidate of value) {
    if (!isRecord(candidate)) return { diagnostic: diagnostic('invalid-voice-lines', 'voice_lines.json contains a non-object row.', packId) };
    const key = nonEmptyString(candidate.key); const category = nonEmptyString(candidate.category); const action = nonEmptyString(candidate.action); const line = nonEmptyString(candidate.line); const ttsText = typeof candidate.tts_text === 'string' ? candidate.tts_text : ''; const locale = nonEmptyString(candidate.locale); const character = nonEmptyString(candidate.character); const emotion = nonEmptyString(candidate.emotion); const actionCn = nonEmptyString(candidate.action_cn);
    const speed = typeof candidate.speed === 'string' ? candidate.speed : undefined; const volume = typeof candidate.volume === 'string' ? candidate.volume : undefined;
    const stability = typeof candidate.stability === 'string' ? candidate.stability : undefined; const similarity = typeof candidate.similarity === 'string' ? candidate.similarity : undefined;
    const languageOverride = typeof candidate.language_override === 'string' ? candidate.language_override : undefined;
    const textNormalization = typeof candidate.text_normalization === 'string' ? candidate.text_normalization : undefined;
    const pitch = typeof candidate.pitch === 'string' ? candidate.pitch : undefined; const ttsEmotion = typeof candidate.tts_emotion === 'string' ? candidate.tts_emotion : undefined; const ttsInstruction = typeof candidate.tts_instruction === 'string' ? candidate.tts_instruction : undefined;
    // Empty tts_text is the canonical default-pronunciation representation:
    // Python then uses line as the actual TTS input.
    if (!key || !category || !action || !line || !locale || !character || !emotion || !LOCALE_PATTERN.test(locale) || seenKeys.has(key)) return { diagnostic: diagnostic('invalid-voice-lines', 'voice_lines.json has a duplicate key or invalid required field.', packId, key) };
    seenKeys.add(key); lines.push({ key, category, action, line, tts_text: ttsText, locale, character, emotion, ...(actionCn ? { action_cn: actionCn } : {}), ...(speed !== undefined ? { speed } : {}), ...(volume !== undefined ? { volume } : {}), ...(stability !== undefined ? { stability } : {}), ...(similarity !== undefined ? { similarity } : {}), ...(languageOverride !== undefined ? { language_override: languageOverride } : {}), ...(textNormalization !== undefined ? { text_normalization: textNormalization } : {}), ...(pitch !== undefined ? { pitch } : {}), ...(ttsEmotion !== undefined ? { tts_emotion: ttsEmotion } : {}), ...(ttsInstruction !== undefined ? { tts_instruction: ttsInstruction } : {}) });
  }
  return { lines };
}

function parseSynthesis(value: unknown): VoiceSynthesisSettings {
  if (!isRecord(value)) return { speed: 1, format: 'mp3' };
  const speed = typeof value.speed === 'number' && Number.isFinite(value.speed) ? value.speed : 1;
  return { speed, format: nonEmptyString(value.format) ?? 'mp3' };
}

function parseCache(value: unknown): Record<string, VoiceGenerationCacheEntry> {
  if (!isRecord(value)) return {};
  const cache: Record<string, VoiceGenerationCacheEntry> = {};
  for (const [index, candidate] of Object.entries(value)) {
    if (!isRecord(candidate)) continue;
    const key = nonEmptyString(candidate.key) ?? index;
    const fingerprint = nonEmptyString(candidate.fingerprint); const fingerprintVersion = typeof candidate.fingerprintVersion === 'string' ? candidate.fingerprintVersion : undefined; const line = typeof candidate.line === 'string' ? candidate.line : '';
    const ttsText = typeof candidate.ttsText === 'string' ? candidate.ttsText : typeof candidate.text === 'string' ? candidate.text : '';
    const voiceId = nonEmptyString(candidate.voiceId); const modelId = nonEmptyString(candidate.modelId); const format = nonEmptyString(candidate.format); const file = nonEmptyString(candidate.file);
    const speed = typeof candidate.speed === 'number' && Number.isFinite(candidate.speed) ? candidate.speed : undefined;
    const volume = typeof candidate.volume === 'number' && Number.isFinite(candidate.volume) ? candidate.volume : undefined;
    const stability = typeof candidate.stability === 'number' && Number.isFinite(candidate.stability) ? candidate.stability : undefined;
    const similarity = typeof candidate.similarity === 'number' && Number.isFinite(candidate.similarity) ? candidate.similarity : undefined;
    const language = typeof candidate.language === 'string' ? candidate.language : undefined;
    const textNormalization = typeof candidate.textNormalization === 'boolean' ? candidate.textNormalization : undefined;
    const cachePitch = typeof candidate.pitch === 'number' && Number.isFinite(candidate.pitch) ? candidate.pitch : undefined;
    const cacheTtsEmotion = typeof candidate.ttsEmotion === 'string' ? candidate.ttsEmotion : undefined;
    const cacheTtsInstruction = typeof candidate.ttsInstruction === 'string' ? candidate.ttsInstruction : undefined;
    if (!key || !fingerprint || !voiceId || !modelId || !format || !file || speed === undefined) continue;
    cache[key] = { key, fingerprint, ...(fingerprintVersion ? { fingerprintVersion } : {}), line, ttsText, voiceId, modelId, speed, format, file, ...(volume !== undefined ? { volume } : {}), ...(stability !== undefined ? { stability } : {}), ...(similarity !== undefined ? { similarity } : {}), ...(language !== undefined ? { language } : {}), ...(textNormalization !== undefined ? { textNormalization } : {}), ...(cachePitch !== undefined ? { pitch: cachePitch } : {}), ...(cacheTtsEmotion ? { ttsEmotion: cacheTtsEmotion } : {}), ...(cacheTtsInstruction ? { ttsInstruction: cacheTtsInstruction } : {}) };
  }
  return cache;
}

function parseFailedKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((candidate) => isRecord(candidate) ? [nonEmptyString(candidate.key)] : []).filter((key): key is string => Boolean(key)))];
}

function parseFailedLogKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((candidate) => isRecord(candidate) && candidate.status === 'failed' ? [nonEmptyString(candidate.key)] : []).filter((key): key is string => Boolean(key)))];
}

/** Browser-only, read-only repository. It discovers only bundled, validated Voice Packs. */
export class VoicePackRepository {
  private readonly details = new Map<string, VoicePackDetail>();
  private readonly summaries: VoicePackSummary[] = [];
  private readonly diagnostics: VoicePackDiagnostic[] = [];
  public constructor(private readonly sources: VoicePackRepositorySources) {
    const parsedIndex = parseIndex(sources.index); this.diagnostics.push(...parsedIndex.diagnostics); if (!parsedIndex.index) return;
    const seenIds = new Set<string>();
    for (const summary of parsedIndex.index.packs) {
      if (seenIds.has(summary.id)) { this.diagnostics.push(diagnostic('duplicate-pack-id', `Duplicate Voice Pack id: ${summary.id}`, summary.id)); continue; }
      seenIds.add(summary.id); const detail = this.loadPack(summary);
      if (detail) { this.summaries.push(summary); this.details.set(summary.id, detail); }
    }
  }
  public listPacks(): readonly VoicePackSummary[] { return this.summaries; }
  public getPack(packId: string): VoicePackDetail | undefined { return this.details.get(packId); }
  public getVoiceLine(packId: string, key: string): VoiceLine | undefined { return this.getPack(packId)?.voiceLines.find((line) => line.key === key); }
  public getAudioForKey(packId: string, key: string): string | undefined {
    const detail = this.getPack(packId); const availability = detail?.voiceAvailability[key]; const summary = this.summaries.find((candidate) => candidate.id === packId);
    if (!detail || availability?.status !== 'available' || !summary) return undefined;
    const filename = availability.file.replace(/^audio\//, '');
    // The dev bridge resolves manifest-authorized files dynamically, so an MP3
    // produced after Vite starts is immediately previewable. Production stays bundled.
    return import.meta.env.DEV
      ? `/api/voice-packs/${encodeURIComponent(packId)}/audio/${encodeURIComponent(filename)}`
      : this.sources.audio[audioFilePath(summary.path, availability.file)];
  }
  public getDiagnostics(): readonly VoicePackDiagnostic[] { return this.diagnostics; }
  private loadPack(summary: VoicePackSummary): VoicePackDetail | undefined {
    const metadata = this.sources.packMetadata[packFilePath(summary.path, 'pack.json')];
    if (metadata === undefined) { this.diagnostics.push(diagnostic('missing-pack-metadata', 'pack.json was not bundled.', summary.id)); return undefined; }
    const parsedMeta = parseMeta(metadata, summary.id);
    if (!parsedMeta.meta) { this.diagnostics.push(parsedMeta.diagnostic ?? diagnostic('invalid-pack-metadata', 'Invalid pack metadata.', summary.id)); return undefined; }
    if (parsedMeta.meta.id !== summary.id || parsedMeta.meta.name !== summary.name || parsedMeta.meta.locale !== summary.locale) { this.diagnostics.push(diagnostic('invalid-pack-metadata', 'pack.json does not match the generated index.', summary.id)); return undefined; }
    const manifestValue = this.sources.manifests[packFilePath(summary.path, 'manifest.json')];
    if (manifestValue === undefined) { this.diagnostics.push(diagnostic('missing-manifest', 'manifest.json was not bundled.', summary.id)); return undefined; }
    const parsedManifest = parseManifest(manifestValue, summary.id); this.diagnostics.push(...parsedManifest.diagnostics); if (!parsedManifest.manifest) return undefined;
    const linesValue = this.sources.voiceLines[packFilePath(summary.path, 'voice_lines.json')];
    if (linesValue === undefined) { this.diagnostics.push(diagnostic('missing-voice-lines', 'voice_lines.json was not bundled.', summary.id)); return undefined; }
    const parsedLines = parseVoiceLines(linesValue, summary.id);
    if (!parsedLines.lines) { this.diagnostics.push(parsedLines.diagnostic ?? diagnostic('invalid-voice-lines', 'Invalid voice lines.', summary.id)); return undefined; }
    const keysWithLines = new Set(parsedLines.lines.map((line) => line.key)); const voiceAvailability: Record<string, VoiceAvailability> = {};
    for (const [key, entry] of Object.entries(parsedManifest.manifest.voices)) {
      const sourcePath = audioFilePath(summary.path, entry.file); const hasAudio = typeof this.sources.audio[sourcePath] === 'string'; const status = !keysWithLines.has(key) ? 'missing-voice-line' : hasAudio ? 'available' : 'missing-audio';
      voiceAvailability[key] = { key, file: entry.file, status };
      if (status === 'missing-audio') this.diagnostics.push(diagnostic('missing-audio', `Missing bundled MP3: ${entry.file}`, summary.id, key));
      if (status === 'missing-voice-line') this.diagnostics.push(diagnostic('missing-voice-line', 'Manifest key has no CSV voice line.', summary.id, key));
    }
    const manifestAudio = new Set(Object.values(parsedManifest.manifest.voices).map((entry) => audioFilePath(summary.path, entry.file)));
    const packAudioPrefix = `${SOURCE_ROOT}/${summary.path}/audio/`;
    for (const sourcePath of Object.keys(this.sources.audio)) {
      if (sourcePath.startsWith(packAudioPrefix) && !manifestAudio.has(sourcePath)) {
        this.diagnostics.push(diagnostic('orphan-audio', `Bundled MP3 is not referenced by manifest: ${sourcePath}`, summary.id));
      }
    }
    const cache = parseCache(this.sources.caches?.[packFilePath(summary.path, '.voice_cache.json')]);
    const failedKeys = [...new Set([
      ...parseFailedKeys(this.sources.failures?.[packFilePath(summary.path, 'failed.json')]),
      ...parseFailedLogKeys(this.sources.generationLogs?.[packFilePath(summary.path, 'generation_log.json')]),
    ])];
    return { meta: parsedMeta.meta, manifest: parsedManifest.manifest, voiceLines: parsedLines.lines, voiceAvailability, generationCache: cache, failedKeys, synthesis: parseSynthesis(this.sources.synthesis) };
  }
}

const defaultSources: VoicePackRepositorySources = {
  index: voicePackIndex,
  packMetadata: import.meta.glob('../../music/voice_lines/*/pack.json', { eager: true, import: 'default' }) as JsonModuleMap,
  manifests: import.meta.glob('../../music/voice_lines/*/manifest.json', { eager: true, import: 'default' }) as JsonModuleMap,
  voiceLines: import.meta.glob('../../music/voice_lines/*/voice_lines.json', { eager: true, import: 'default' }) as JsonModuleMap,
  audio: import.meta.glob('../../music/voice_lines/*/audio/*.mp3', { eager: true, import: 'default' }) as AudioModuleMap,
  caches: import.meta.glob('../../music/voice_lines/*/.voice_cache.json', { eager: true, import: 'default' }) as JsonModuleMap,
  failures: import.meta.glob('../../music/voice_lines/*/failed.json', { eager: true, import: 'default' }) as JsonModuleMap,
  generationLogs: import.meta.glob('../../music/voice_lines/*/generation_log.json', { eager: true, import: 'default' }) as JsonModuleMap,
  synthesis: fishAudioConfig,
};

/** Default source of validated Voice Pack data for later phases; it performs no playback. */
export const VOICE_PACK_REPOSITORY = new VoicePackRepository(defaultSources);
