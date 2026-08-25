import { loadFishAudioApiKeys } from './fishAudioModelDiscovery.mjs';
import { readFileSync } from 'node:fs';

const API_BASE = 'https://fishaudio.org/api/open/v1';
const TTS_API_BASE = 'https://fishaudio.org/api/open/v3/speech/tts';
const MAX_FILE_BYTES = Math.floor(4.5 * 1024 * 1024);
const MAX_FILES = 5;
const EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.ogg', '.flac']);
const MIME_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/flac', 'audio/x-flac']);
const CLONE_LANGUAGE_CODES = new Set(JSON.parse(readFileSync(new URL('../src/audio/voice/fishCloneLanguages.json', import.meta.url), 'utf8')).languages.map((entry) => entry.cloneLanguage));

export class FishVoiceCreationError extends Error {
  constructor(code, message, status = 502, cause) { super(message, cause ? { cause } : undefined); this.code = code; this.status = status; }
}

/** Server-only v1 adapter. Its public results never contain credentials or raw Fish payloads. */
export class FishVoiceCreationService {
  constructor({ projectRoot, registry, fetchImpl = globalThis.fetch, apiBase = API_BASE, keyLoader = loadFishAudioApiKeys, randomId = () => crypto.randomUUID() } = {}) {
    this.projectRoot = projectRoot; this.registry = registry; this.fetchImpl = fetchImpl;
    this.apiBase = apiBase.replace(/\/$/, ''); this.keyLoader = keyLoader; this.randomId = randomId;
  }

  async cloneVoice(input) {
    const normalized = validateCloneInput(input);
    await validateReliableCloneDurations(normalized.audioFiles);
    const result = await this.requestSideEffect('/voices', formForClone(normalized), 'clone');
    const voice = normalizePermanentVoice(result, normalized.name);
    if (!voice) throw new FishVoiceCreationError('FISH_INVALID_RESPONSE', 'Fish 未返回有效的永久音色。');
    return this.registry.upsert({ ...voice, source: 'clone', language: normalized.language, ...(normalized.description ? { description: normalized.description } : {}) });
  }

  async createDesign(input) {
    const normalized = validateDesignInput(input);
    const result = await this.requestSideEffect('/voice-designs', JSON.stringify(normalized), 'design');
    const design = normalizeDesign(result);
    if (!design) throw new FishVoiceCreationError('FISH_INVALID_RESPONSE', 'Fish 未返回可用的设计候选。');
    return design;
  }

  async candidateAudio(designId, candidateId) {
    assertIdentifier(designId, '设计候选无效。'); assertIdentifier(candidateId, '设计候选无效。');
    const response = await this.requestRead(`/voice-designs/${encodeURIComponent(designId)}/candidates/${encodeURIComponent(candidateId)}/audio`);
    return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'audio/mpeg' };
  }

  async saveDesignVoice(designId, input) {
    assertIdentifier(designId, '设计候选无效。');
    const candidateId = stringField(input?.candidateId); const name = stringField(input?.name);
    if (!candidateId || !name) throw new FishVoiceCreationError('INVALID_REQUEST', '请选择候选并填写音色名称。', 400);
    const body = { candidateId, name, visibility: 'private', ...(stringField(input.description) ? { description: stringField(input.description) } : {}), ...(stringField(input.referenceText) ? { referenceText: stringField(input.referenceText) } : {}) };
    const result = await this.requestSideEffect(`/voice-designs/${encodeURIComponent(designId)}/voices`, JSON.stringify(body), 'save-design');
    const voice = normalizePermanentVoice(result, name);
    if (!voice) throw new FishVoiceCreationError('FISH_INVALID_RESPONSE', 'Fish 未返回有效的永久音色。');
    return this.registry.upsert({ ...voice, source: 'design', ...(stringField(input.description) ? { description: stringField(input.description) } : {}) });
  }

  async deleteVoice(voiceId) {
    assertIdentifier(voiceId, '音色 ID 无效。');
    const key = await this.firstKey(); let response;
    try { response = await this.fetchImpl(`${this.apiBase}/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } }); }
    catch (cause) { throw new FishVoiceCreationError('FISH_NETWORK_AMBIGUOUS', '删除结果不确定，请检查已生成音色列表后再重试。', 502, cause); }
    if (!response.ok) throw fishResponseError(response.status);
    return true;
  }

  /** Ordinary v3 TTS preview for a permanent cloned voice. Audio stays in the
   * response only; it is never written to a Mahjong Voice Pack. */
  async previewVoice(input) {
    const voiceId = stringField(input?.voiceId); const modelId = stringField(input?.modelId); const text = stringField(input?.text);
    if (!voiceId || !modelId || !text) throw new FishVoiceCreationError('INVALID_REQUEST', '请选择兼容模型并填写试听文本。', 400);
    const key = await this.firstKey(); const requestId = this.randomId(); let response;
    try {
      response = await this.fetchImpl(TTS_API_BASE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, Accept: 'audio/mpeg', 'Content-Type': 'application/json; charset=utf-8', 'Idempotency-Key': requestId, 'X-Request-Id': requestId },
        body: JSON.stringify({ text, voiceId, modelId, format: 'mp3' }),
      });
    } catch (cause) { throw new FishVoiceCreationError('FISH_NETWORK', '试听请求失败，请稍后重试。', 502, cause); }
    if (!response.ok) throw fishResponseError(response.status);
    return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'audio/mpeg' };
  }

  async requestSideEffect(pathname, body, action) {
    const key = await this.firstKey(); const idempotency = this.randomId(); let response;
    try { response = await this.fetchImpl(`${this.apiBase}${pathname}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(typeof body === 'string' ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), 'Idempotency-Key': idempotency, 'X-Request-Id': idempotency }, body }); }
    catch (cause) { throw new FishVoiceCreationError('FISH_NETWORK_AMBIGUOUS', `${labelFor(action)}结果不确定，请检查已生成音色列表后再重试。`, 502, cause); }
    return responseJson(response);
  }

  async requestRead(pathname) {
    const key = await this.firstKey(); let response;
    try { response = await this.fetchImpl(`${this.apiBase}${pathname}`, { headers: { Authorization: `Bearer ${key}`, Accept: 'audio/*' } }); }
    catch (cause) { throw new FishVoiceCreationError('FISH_NETWORK', '候选音频加载失败，请稍后重试。', 502, cause); }
    if (!response.ok) throw fishResponseError(response.status); return response;
  }

  async firstKey() {
    const keys = await this.keyLoader(this.projectRoot);
    if (!keys.length) throw new FishVoiceCreationError('FISH_AUTH_UNAVAILABLE', '本地 Fish Audio 凭据不可用。', 503);
    return keys[0];
  }
}

export function validateCloneInput(input) {
  const name = stringField(input?.name); const files = Array.isArray(input?.audioFiles) ? input.audioFiles : [];
  if (!name) throw new FishVoiceCreationError('INVALID_REQUEST', '请填写音色名称。', 400);
  if (!files.length) throw new FishVoiceCreationError('UPLOAD_REQUIRED', '请至少上传一个参考音频。', 400);
  if (files.length > MAX_FILES) throw new FishVoiceCreationError('UPLOAD_TOO_MANY', `最多上传 ${MAX_FILES} 个参考音频。`, 413);
  const seen = new Set();
  for (const file of files) {
    const filename = typeof file?.name === 'string' ? file.name : ''; const bytes = Number(file?.size);
    const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase(); const duplicate = `${filename}:${bytes}`;
    if (!filename || !Number.isFinite(bytes) || bytes <= 0) throw new FishVoiceCreationError('UPLOAD_INVALID', '参考音频为空或无效。', 400);
    if (!EXTENSIONS.has(extension)) throw new FishVoiceCreationError('UPLOAD_FORMAT', '参考音频格式不支持。请使用 WAV、MP3、M4A、OGG 或 FLAC。', 400);
    if (typeof file.type === 'string' && file.type && !MIME_TYPES.has(file.type.toLowerCase())) throw new FishVoiceCreationError('UPLOAD_FORMAT', '参考音频 MIME 类型不支持。', 400);
    if (bytes > MAX_FILE_BYTES) throw new FishVoiceCreationError('UPLOAD_TOO_LARGE', '单个参考音频不能超过 4.5MB。', 413);
    if (seen.has(duplicate)) throw new FishVoiceCreationError('UPLOAD_DUPLICATE', '请移除重复的参考音频。', 400); seen.add(duplicate);
  }
  const languages = Array.isArray(input.languages) ? input.languages.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [];
  if (languages.length !== 1 || !CLONE_LANGUAGE_CODES.has(languages[0])) throw new FishVoiceCreationError('CLONE_LANGUAGE_INVALID', '请明确选择一个受支持的音色语言。', 400);
  return { name, audioFiles: files, language: languages[0], ...(stringField(input.description) ? { description: stringField(input.description) } : {}), ...(stringField(input.referenceText) ? { referenceText: stringField(input.referenceText) } : {}) };
}

export function validateDesignInput(input) {
  const prompt = stringField(input?.prompt); const previewText = stringField(input?.previewText); const providers = Array.isArray(input?.providers) ? input.providers.filter((value) => value === 'fishaudio' || value === 'minimax') : [];
  if (prompt.length > 2000) throw new FishVoiceCreationError('DESIGN_PROMPT_TOO_LONG', '音色描述最多 2000 个字符。', 400);
  if (previewText.length > 150) throw new FishVoiceCreationError('DESIGN_PREVIEW_TEXT_TOO_LONG', '试听文本最多 150 个字符。', 400);
  if (!prompt || !previewText || !providers.length) throw new FishVoiceCreationError('INVALID_REQUEST', '请填写音色描述、试听文本，并选择至少一个提供方。', 400);
  return { prompt, previewText, providers: [...new Set(providers)] };
}

/** WAV headers are cheap and reliable to inspect in-memory. Other accepted
 * formats are duration-validated in the browser where decoding support exists. */
async function validateReliableCloneDurations(files) {
  let totalSeconds = 0;
  for (const file of files) {
    if (!file?.name?.toLowerCase().endsWith('.wav') || typeof file.arrayBuffer !== 'function') continue;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const seconds = wavDurationSeconds(buffer);
    if (seconds !== undefined) totalSeconds += seconds;
  }
  if (totalSeconds > 60) throw new FishVoiceCreationError('UPLOAD_DURATION_TOO_LONG', '所有参考音频总时长不能超过 60 秒。', 413);
}
function wavDurationSeconds(bytes) {
  if (bytes.length < 44 || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.slice(8, 12)) !== 'WAVE') return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const byteRate = view.getUint32(28, true); const dataBytes = view.getUint32(40, true);
  return byteRate > 0 ? dataBytes / byteRate : undefined;
}

function formForClone(input) {
  const form = new FormData(); form.append('name', input.name); form.append('visibility', 'private');
  if (input.description) form.append('description', input.description); if (input.referenceText) form.append('referenceText', input.referenceText);
  form.append('languages', JSON.stringify([input.language]));
  for (const file of input.audioFiles) form.append('audioFiles', file, file.name);
  return form;
}

function normalizePermanentVoice(value, fallbackName) {
  const record = value?.voice && typeof value.voice === 'object' ? value.voice : value;
  const voiceId = firstString(record?.voiceId, record?.id, record?.voice_id); const name = firstString(record?.name, fallbackName);
  return voiceId && name ? { voiceId, name } : undefined;
}
function normalizeDesign(value) {
  const record = value?.design && typeof value.design === 'object' ? value.design : value;
  const designId = firstString(record?.designId, record?.id, record?.design_id);
  const rawCandidates = Array.isArray(record?.candidates) ? record.candidates : Array.isArray(value?.candidates) ? value.candidates : [];
  const candidates = rawCandidates.map((candidate, index) => {
    const candidateId = firstString(candidate?.candidateId, candidate?.id, candidate?.candidate_id); const provider = firstString(candidate?.provider, candidate?.providerId, candidate?.provider_id);
    return candidateId && provider ? { candidateId, provider, label: firstString(candidate?.name, candidate?.label) || `候选 ${index + 1}` } : undefined;
  }).filter(Boolean);
  return designId && candidates.length ? { designId, candidates } : undefined;
}
async function responseJson(response) { if (!response.ok) throw fishResponseError(response.status); try { return await response.json(); } catch (cause) { throw new FishVoiceCreationError('FISH_INVALID_RESPONSE', 'Fish 返回的数据无效。', 502, cause); } }
function fishResponseError(status) { const map = { 400: ['FISH_INVALID_REQUEST', '请求参数无效，请检查输入。'], 401: ['FISH_AUTH_FAILED', 'Fish Audio 凭据无效或已过期。'], 402: ['FISH_QUOTA_EXHAUSTED', 'Fish Audio 额度不足。'], 403: ['FISH_FORBIDDEN', '没有访问该 Fish 资源的权限。'], 404: ['FISH_NOT_FOUND', 'Fish 资源不存在或已失效。'], 413: ['FISH_UPLOAD_TOO_LARGE', '上传音频过大。'], 429: ['FISH_RATE_LIMIT', 'Fish Audio 请求过于频繁，请稍后重试。'], 503: ['FISH_UNAVAILABLE', 'Fish Audio 服务暂不可用，请稍后重试。'] }; const [code, message] = map[status] ?? ['FISH_UPSTREAM_ERROR', 'Fish Audio 服务请求失败，请稍后重试。']; return new FishVoiceCreationError(code, message, status >= 500 ? 502 : status); }
function assertIdentifier(value, message) { if (typeof value !== 'string' || !value.trim() || /[\\/\s]/.test(value)) throw new FishVoiceCreationError('INVALID_REQUEST', message, 400); }
function stringField(value) { return typeof value === 'string' && value.trim() ? value.trim() : ''; }
function firstString(...values) { return values.find((value) => typeof value === 'string' && value.trim())?.trim(); }
function labelFor(action) { return action === 'clone' ? '创建音色' : action === 'design' ? '生成候选' : '保存音色'; }
export { MAX_FILE_BYTES, MAX_FILES, normalizeDesign, normalizePermanentVoice, wavDurationSeconds };
