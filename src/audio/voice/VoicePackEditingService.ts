import { VOICE_PACK_REPOSITORY, type VoicePackRepository } from './VoicePackRepository';
import type { VoiceLine } from './types';
import { generationSettingsPatchToCsv, validateGenerationSettingsPatch, type VoiceGenerationSettingsPatch } from './voiceSynthesisSettings';

const STORAGE_KEY = 'local-mahjong.voice-pack-line-overrides.v1';
const MAX_LINE_GRAPHEMES = 30;

export interface VoiceLinePatch extends VoiceGenerationSettingsPatch { readonly line?: string; readonly ttsText?: string; }
export interface VoiceLineDraft { readonly line: string; readonly ttsText: string; }
export interface VoiceLineOverrideStorage { load(): Record<string, Record<string, VoiceLinePatch>>; save(value: Record<string, Record<string, VoiceLinePatch>>): void; }

class BrowserVoiceLineOverrideStorage implements VoiceLineOverrideStorage {
  load(): Record<string, Record<string, VoiceLinePatch>> {
    if (typeof window === 'undefined') return {};
    try { return parseOverrides(window.localStorage.getItem(STORAGE_KEY)); } catch { return {}; }
  }
  save(value: Record<string, Record<string, VoiceLinePatch>>): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
}

export class MemoryVoiceLineOverrideStorage implements VoiceLineOverrideStorage {
  private value: Record<string, Record<string, VoiceLinePatch>> = {};
  load(): Record<string, Record<string, VoiceLinePatch>> { return structuredClone(this.value); }
  save(value: Record<string, Record<string, VoiceLinePatch>>): void { this.value = structuredClone(value); }
}

/** Persistent browser-side editing boundary. It writes only local overrides, never Pack source files or audio. */
export class VoicePackEditingService {
  private overrides: Record<string, Record<string, VoiceLinePatch>>;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly repository: Pick<VoicePackRepository, 'getPack'> = VOICE_PACK_REPOSITORY, private readonly storage: VoiceLineOverrideStorage = new BrowserVoiceLineOverrideStorage()) {
    this.overrides = storage.load();
  }

  getVoiceLines(packId: string, sourceLines?: readonly VoiceLine[]): readonly VoiceLine[] {
    const lines = sourceLines ?? this.repository.getPack(packId)?.voiceLines;
    return lines ? lines.map((line) => applyPatch(line, this.overrides[packId]?.[line.key])) : [];
  }

  getVoiceLine(packId: string, key: string, sourceLines?: readonly VoiceLine[]): VoiceLine | undefined { return this.getVoiceLines(packId, sourceLines).find((line) => line.key === key); }

  /** Patches awaiting persistence by the development-only generation bridge. */
  getPatches(packId: string, keys?: readonly string[]): readonly ({ readonly key: string } & VoiceLinePatch)[] {
    const permitted = keys ? new Set(keys) : undefined;
    return Object.entries(this.overrides[packId] ?? {})
      .filter(([key]) => !permitted || permitted.has(key))
      .map(([key, patch]) => ({ key, ...patch }));
  }

  /** The local bridge has atomically written these overrides into voice_lines.csv. */
  acknowledgePersisted(packId: string, keys: readonly string[]): void {
    const current = this.overrides[packId];
    if (!current) return;
    const acknowledged = new Set(keys);
    const remaining = Object.fromEntries(Object.entries(current).filter(([key]) => !acknowledged.has(key)));
    if (Object.keys(remaining).length === Object.keys(current).length) return;
    const next = { ...this.overrides };
    if (Object.keys(remaining).length) next[packId] = remaining;
    else delete next[packId];
    this.overrides = next;
    this.persist();
  }

  updateVoiceLine(packId: string, key: string, patch: VoiceLinePatch, sourceLines?: readonly VoiceLine[]): VoiceLine {
    const current = this.getVoiceLine(packId, key, sourceLines);
    if (!current) throw new Error('当前语音包或台词不存在，无法保存。');
    if (patch.line !== undefined) {
      const validation = validateDisplayLine(patch.line);
      if (!validation.valid) throw new Error(validation.message ?? '台词无效。');
    }
    const settingsError = validateGenerationSettingsPatch(patch);
    if (settingsError) throw new Error(settingsError);
    // Historical `tts_text === line` is default pronunciation, not a custom override.
    // Editing a default line clears tts_text so Python's fallback follows the new line.
    const followsLine = !current.tts_text.trim() || normalizeForComparison(current.tts_text) === normalizeForComparison(current.line);
    const normalizedPatch = patch.line !== undefined && patch.ttsText === undefined && followsLine
      ? { ...patch, ttsText: '' }
      : patch;
    const next = { ...(this.overrides[packId]?.[key] ?? {}), ...normalizedPatch };
    this.overrides = { ...this.overrides, [packId]: { ...(this.overrides[packId] ?? {}), [key]: next } };
    this.persist();
    return this.getVoiceLine(packId, key, sourceLines) as VoiceLine;
  }

  resetPronunciation(packId: string, key: string, sourceLines?: readonly VoiceLine[]): VoiceLine {
    const line = this.getVoiceLine(packId, key, sourceLines);
    if (!line) throw new Error('当前语音包或台词不存在，无法恢复默认发音。');
    return this.updateVoiceLine(packId, key, { ttsText: '' }, sourceLines);
  }

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private persist(): void { this.storage.save(this.overrides); this.listeners.forEach((listener) => listener()); }
}

export function createVoiceLineDraft(line: VoiceLine): VoiceLineDraft { return { line: line.line, ttsText: line.tts_text }; }

export function hasCustomPronunciation(line: Pick<VoiceLine, 'line' | 'tts_text'>): boolean {
  return Boolean(line.tts_text.trim()) && normalizeForComparison(line.tts_text) !== normalizeForComparison(line.line);
}

export function voiceLineEditorKeyAction(key: string): 'save' | 'cancel' | undefined {
  return key === 'Enter' ? 'save' : key === 'Escape' ? 'cancel' : undefined;
}

export function graphemeCount(value: string): number {
  type Segmenter = { segment(input: string): Iterable<unknown> };
  const SegmenterConstructor = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => Segmenter }).Segmenter;
  return SegmenterConstructor ? [...new SegmenterConstructor(undefined, { granularity: 'grapheme' }).segment(value)].length : Array.from(value).length;
}

export function validateDisplayLine(line: string): { readonly valid: boolean; readonly message: string | null } {
  if (!line.trim()) return { valid: false, message: '台词不能为空。' };
  const count = graphemeCount(line);
  return count <= MAX_LINE_GRAPHEMES ? { valid: true, message: null } : { valid: false, message: `台词最多 30 个字符，当前为 ${count} 个。` };
}

function applyPatch(line: VoiceLine, patch: VoiceLinePatch | undefined): VoiceLine {
  if (!patch) return line;
  return {
    ...line,
    ...(patch.line !== undefined ? { line: patch.line } : {}),
    ...(patch.ttsText !== undefined ? { tts_text: patch.ttsText } : {}),
    ...generationSettingsPatchToCsv(patch),
  };
}

function normalizeForComparison(value: string): string { return value.trim(); }

function parseOverrides(value: string | null): Record<string, Record<string, VoiceLinePatch>> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return {};
    const result: Record<string, Record<string, VoiceLinePatch>> = {};
    for (const [packId, rows] of Object.entries(parsed)) {
      if (!isRecord(rows)) continue;
      const validRows: Record<string, VoiceLinePatch> = {};
      for (const [key, patch] of Object.entries(rows)) {
        if (!isRecord(patch)) continue;
        const line = typeof patch.line === 'string' ? patch.line : undefined; const ttsText = typeof patch.ttsText === 'string' ? patch.ttsText : undefined;
        const speed = typeof patch.speed === 'number' ? patch.speed : undefined; const volume = typeof patch.volume === 'number' ? patch.volume : undefined;
        const stability = typeof patch.stability === 'number' ? patch.stability : undefined; const similarity = typeof patch.similarity === 'number' ? patch.similarity : undefined;
        const languageOverride = typeof patch.languageOverride === 'string' ? patch.languageOverride : undefined; const textNormalization = typeof patch.textNormalization === 'boolean' ? patch.textNormalization : undefined;
        const pitch = typeof patch.pitch === 'number' ? patch.pitch : patch.pitch === null ? null : undefined; const ttsEmotion = typeof patch.ttsEmotion === 'string' ? patch.ttsEmotion : undefined; const ttsInstruction = typeof patch.ttsInstruction === 'string' ? patch.ttsInstruction : undefined;
        if (line !== undefined || ttsText !== undefined || speed !== undefined || volume !== undefined || stability !== undefined || similarity !== undefined || languageOverride !== undefined || textNormalization !== undefined || pitch !== undefined || ttsEmotion !== undefined || ttsInstruction !== undefined) validRows[key] = { ...(line !== undefined ? { line } : {}), ...(ttsText !== undefined ? { ttsText } : {}), ...(speed !== undefined ? { speed } : {}), ...(volume !== undefined ? { volume } : {}), ...(stability !== undefined ? { stability } : {}), ...(similarity !== undefined ? { similarity } : {}), ...(languageOverride !== undefined ? { languageOverride } : {}), ...(textNormalization !== undefined ? { textNormalization } : {}), ...(pitch !== undefined ? { pitch } : {}), ...(ttsEmotion !== undefined ? { ttsEmotion } : {}), ...(ttsInstruction !== undefined ? { ttsInstruction } : {}) };
      }
      if (Object.keys(validRows).length) result[packId] = validRows;
    }
    return result;
  } catch { return {}; }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

export const VOICE_PACK_EDITING_SERVICE = new VoicePackEditingService();
