export type CreatedVoiceSource = 'clone' | 'design' | 'existing';
export interface CreatedVoice { readonly voiceId: string; readonly name: string; readonly source: CreatedVoiceSource; readonly createdAt: string; readonly language?: string; readonly linkedPackIds?: readonly string[]; readonly description?: string; readonly provider?: string; }
export interface VoiceDesignCandidate { readonly candidateId: string; readonly provider: string; readonly label: string; }
export interface VoiceDesign { readonly designId: string; readonly candidates: readonly VoiceDesignCandidate[]; }
export interface CloneVoiceInput { readonly name: string; readonly audioFiles: readonly File[]; readonly description?: string; readonly referenceText?: string; readonly language: string; }
export interface VoiceDesignInput { readonly prompt: string; readonly previewText: string; readonly providers: readonly ('fishaudio' | 'minimax')[]; }

/** Browser client for the loopback-only development bridge. It carries no Fish credentials. */
export class CreatedVoiceService {
  async list(): Promise<readonly CreatedVoice[]> { const value = await requestJson('/api/generated-voices'); return Array.isArray(value.voices) ? value.voices.map(parseCreatedVoice).filter((voice): voice is CreatedVoice => Boolean(voice)) : []; }
  async remove(voiceId: string): Promise<boolean> { const value = await requestJson(`/api/generated-voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE' }); return value.removed === true; }
  async deleteCloudVoice(voiceId: string): Promise<boolean> { const value = await requestJson(`/api/generated-voices/${encodeURIComponent(voiceId)}/cloud`, { method: 'DELETE' }); return value.removed === true; }
  async clone(input: CloneVoiceInput): Promise<CreatedVoice> {
    validateBrowserFiles(input.audioFiles);
    const form = new FormData(); form.append('name', input.name);
    if (input.description?.trim()) form.append('description', input.description.trim()); if (input.referenceText?.trim()) form.append('referenceText', input.referenceText.trim());
    if (!input.language.trim()) throw new Error('请明确选择音色语言。');
    form.append('languages', JSON.stringify([input.language.trim()]));
    for (const file of input.audioFiles) form.append('audioFiles', file, file.name);
    const value = await requestJson('/api/generated-voices/clone', { method: 'POST', body: form, headers: {} }); const voice = parseCreatedVoice(value.voice);
    if (!voice) throw new Error('音色创建服务返回无效数据。'); return voice;
  }
  async createDesign(input: VoiceDesignInput): Promise<VoiceDesign> { const value = await requestJson('/api/generated-voices/designs', { method: 'POST', body: JSON.stringify(input) }); const design = parseDesign(value.design); if (!design) throw new Error('音色设计服务返回无效数据。'); return design; }
  async candidateAudio(designId: string, candidateId: string): Promise<Blob> { const response = await fetch(`/api/generated-voices/designs/${encodeURIComponent(designId)}/candidates/${encodeURIComponent(candidateId)}/audio`); if (!response.ok) throw new Error(await messageFor(response)); return response.blob(); }
  async previewClone(voiceId: string, input: { readonly modelId: string; readonly text: string }): Promise<Blob> {
    const response = await fetch(`/api/generated-voices/${encodeURIComponent(voiceId)}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error(await messageFor(response)); return response.blob();
  }
  async saveDesign(designId: string, input: { readonly candidateId: string; readonly name: string; readonly description?: string; readonly referenceText?: string }): Promise<CreatedVoice> { const value = await requestJson(`/api/generated-voices/designs/${encodeURIComponent(designId)}/voices`, { method: 'POST', body: JSON.stringify(input) }); const voice = parseCreatedVoice(value.voice); if (!voice) throw new Error('音色保存服务返回无效数据。'); return voice; }
}

export const LOCAL_CREATED_VOICE_SERVICE = new CreatedVoiceService();
export const MAX_REFERENCE_FILE_BYTES = Math.floor(4.5 * 1024 * 1024);
export const MAX_REFERENCE_FILES = 5;
export const MAX_REFERENCE_SECONDS = 60;
const allowedExtensions = new Set(['wav', 'mp3', 'm4a', 'ogg', 'flac']);

export function validateBrowserFiles(files: readonly File[]): void {
  if (!files.length) throw new Error('请至少上传一个参考音频。'); if (files.length > MAX_REFERENCE_FILES) throw new Error(`最多上传 ${MAX_REFERENCE_FILES} 个参考音频。`);
  const seen = new Set<string>();
  for (const file of files) { const extension = file.name.split('.').pop()?.toLowerCase() ?? ''; const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!file.size) throw new Error('参考音频为空或无效。'); if (!allowedExtensions.has(extension)) throw new Error('参考音频格式不支持。请使用 WAV、MP3、M4A、OGG 或 FLAC。'); if (file.size > MAX_REFERENCE_FILE_BYTES) throw new Error('单个参考音频不能超过 4.5MB。'); if (seen.has(key)) throw new Error('请移除重复的参考音频。'); seen.add(key); }
}

/** Browser metadata decoding provides duration checks for formats it supports. */
export async function validateBrowserAudioDurations(files: readonly File[]): Promise<void> {
  const seconds = await Promise.all(files.map(readBrowserAudioDuration)); const total = seconds.reduce((sum, value) => sum + value, 0);
  if (total > MAX_REFERENCE_SECONDS) throw new Error('所有参考音频总时长不能超过 60 秒。建议使用 10–20 秒参考音频。');
}
function readBrowserAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => { const url = URL.createObjectURL(file); const audio = new Audio(); const done = (duration: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(duration) ? duration : 0); }; audio.onloadedmetadata = () => done(audio.duration); audio.onerror = () => done(0); audio.src = url; });
}

async function requestJson(path: string, init?: RequestInit): Promise<Record<string, unknown>> { const response = await fetch(path, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json; charset=utf-8' }), ...(init?.headers ?? {}) } }); if (!response.ok) throw new Error(await messageFor(response)); const value: unknown = await response.json().catch(() => ({})); return isRecord(value) ? value : {}; }
async function messageFor(response: Response): Promise<string> { const value: unknown = await response.json().catch(() => ({})); return isRecord(value) && typeof value.error === 'string' ? value.error : '角色语音服务暂不可用。'; }
function parseCreatedVoice(value: unknown): CreatedVoice | undefined { if (!isRecord(value) || typeof value.voiceId !== 'string' || typeof value.name !== 'string' || (value.source !== 'clone' && value.source !== 'design' && value.source !== 'existing') || typeof value.createdAt !== 'string') return undefined; const linkedPackIds = Array.isArray(value.linkedPackIds) && value.linkedPackIds.every((id) => typeof id === 'string') ? value.linkedPackIds as string[] : undefined; return { voiceId: value.voiceId, name: value.name, source: value.source, createdAt: value.createdAt, ...(linkedPackIds ? { linkedPackIds } : {}), ...(typeof value.language === 'string' ? { language: value.language } : {}), ...(typeof value.description === 'string' ? { description: value.description } : {}), ...(typeof value.provider === 'string' ? { provider: value.provider } : {}) }; }
function parseDesign(value: unknown): VoiceDesign | undefined { if (!isRecord(value) || typeof value.designId !== 'string' || !Array.isArray(value.candidates)) return undefined; const candidates = value.candidates.map((candidate) => isRecord(candidate) && typeof candidate.candidateId === 'string' && typeof candidate.provider === 'string' && typeof candidate.label === 'string' ? { candidateId: candidate.candidateId, provider: candidate.provider, label: candidate.label } : undefined).filter((candidate): candidate is VoiceDesignCandidate => Boolean(candidate)); return candidates.length ? { designId: value.designId, candidates } : undefined; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
