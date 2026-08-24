import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_API_BASE = 'https://fishaudio.org/api/open/v3';
const CACHE_TTL_MS = 10 * 60 * 1000;
const SAFE_VOICE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

/** A safe, normalized subset of Fish's current API contract for browser clients. */
export class FishAudioModelDiscoveryService {
  constructor({ projectRoot, fetchImpl = globalThis.fetch, now = () => Date.now(), sleep = defaultSleep, apiBase = DEFAULT_API_BASE, cacheTtlMs = CACHE_TTL_MS } = {}) {
    this.projectRoot = projectRoot ? path.resolve(projectRoot) : process.cwd();
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.apiBase = apiBase.replace(/\/$/, '');
    this.sleep = sleep;
    this.cacheTtlMs = cacheTtlMs;
    this.cache = new Map();
  }

  async discover(voiceId) {
    const normalizedVoiceId = normalizeVoiceId(voiceId);
    const cached = this.cache.get(normalizedVoiceId);
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const [voice, capabilities] = await Promise.all([
      this.withApiKeys((apiKey) => this.fetchVoice(normalizedVoiceId, apiKey)),
      this.fetchCapabilities(),
    ]);
    const result = normalizeDiscovery(normalizedVoiceId, voice, capabilities);
    this.cache.set(normalizedVoiceId, { value: result, expiresAt: this.now() + this.cacheTtlMs });
    return result;
  }

  clearCache() { this.cache.clear(); }

  async fetchVoice(voiceId, apiKey) {
    return this.requestJson(`${this.apiBase}/voices/${encodeURIComponent(voiceId)}`, { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' });
  }

  async fetchCapabilities() {
    const value = await this.requestJson(`${this.apiBase}/speech/tts/capabilities`, { Accept: 'application/json' });
    return normalizeCapabilities(value);
  }

  async requestJson(url, headers) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response;
      try { response = await this.fetchImpl(url, { headers }); }
      catch (error) { throw new FishDiscoveryError('FISH_NETWORK', '模型信息加载失败，请稍后重试。', 502, error); }
      if (response.status === 429 && attempt === 0) {
        await this.sleep(retryAfterMilliseconds(response.headers));
        continue;
      }
      if (!response.ok) throw responseError(response.status);
      try { return await response.json(); }
      catch (error) { throw new FishDiscoveryError('FISH_INVALID_RESPONSE', '模型信息加载失败，请稍后重试。', 502, error); }
    }
    throw new FishDiscoveryError('FISH_RATE_LIMIT', '模型信息加载过于频繁，请稍后重试。', 429);
  }

  async withApiKeys(operation) {
    const keys = await loadFishAudioApiKeys(this.projectRoot);
    if (!keys.length) throw new FishDiscoveryError('FISH_AUTH_UNAVAILABLE', '模型信息加载失败，请检查本地 Fish Audio 配置。', 503);
    let error;
    for (const apiKey of keys) {
      try { return await operation(apiKey); }
      catch (cause) {
        error = cause;
        // Credential rotation is intentionally limited to authentication/quota failures.
        // Rate limits use Retry-After/backoff in requestJson and never rotate keys.
        if (!(cause instanceof FishDiscoveryError) || ![401, 402].includes(cause.status)) throw cause;
      }
    }
    throw error ?? new FishDiscoveryError('FISH_AUTH_FAILED', '模型信息加载失败，请检查本地 Fish Audio 配置。', 502);
  }
}

export class FishDiscoveryError extends Error {
  constructor(code, message, status = 502, cause) { super(message, cause ? { cause } : undefined); this.code = code; this.status = status; }
}

export function normalizeVoiceId(voiceId) {
  const normalized = typeof voiceId === 'string' ? voiceId.trim() : '';
  if (!SAFE_VOICE_ID.test(normalized)) throw new FishDiscoveryError('VOICE_ID_INVALID', 'Fish Audio Voice ID 格式无效。', 400);
  return normalized;
}

/** Normalizes only the v3 capabilities response; it is the model/control source of truth. */
export function normalizeCapabilities(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.models)) {
    throw new FishDiscoveryError('FISH_CAPABILITIES_UNAVAILABLE', '模型信息加载失败，请稍后重试。', 502);
  }
  const models = value.models.map((candidate) => {
    const modelId = isNonEmptyString(candidate?.modelId) ? candidate.modelId : candidate?.id;
    if (!isNonEmptyString(modelId)) return undefined;
    return {
      modelId,
      displayName: isNonEmptyString(candidate.displayName) ? candidate.displayName : isNonEmptyString(candidate.name) ? candidate.name : modelId,
      available: candidate.available === true,
      controls: normalizeControls(candidate.controls),
    };
  }).filter(Boolean);
  return {
    models,
    recommendedModelId: firstNonEmptyString(value.recommendedModelId, value.recommended_model_id, value.defaultModelId, value.default_model_id),
  };
}

/** Produces a safe v3-only browser shape and intentionally drops account/author data. */
export function normalizeDiscovery(voiceId, rawVoice, capabilities) {
  const voice = rawVoice?.voice && typeof rawVoice.voice === 'object' ? rawVoice.voice : rawVoice;
  if (!voice || typeof voice !== 'object' || Array.isArray(voice)) throw new FishDiscoveryError('FISH_INVALID_RESPONSE', '无法读取该 Voice，请检查 Voice ID 或访问权限。', 502);
  const voiceCompatibleModelIds = Array.isArray(voice.modelIds) ? voice.modelIds.filter(isNonEmptyString) : [];
  if (!voiceCompatibleModelIds.length) throw new FishDiscoveryError('FISH_INVALID_RESPONSE', '该 Voice 没有可用的模型兼容信息。', 502);
  const availableModels = capabilities.models.map((model) => ({ ...model, controls: { ...model.controls } }));
  const compatibleModels = availableModels.filter((model) => model.available && voiceCompatibleModelIds.includes(model.modelId));
  return {
    voiceId: isNonEmptyString(voice.voiceId) ? voice.voiceId : voiceId,
    voiceCompatibleModelIds: [...new Set(voiceCompatibleModelIds)], availableModels, compatibleModels,
    ...(capabilities.recommendedModelId ? { recommendedModelId: capabilities.recommendedModelId } : {}),
    ...(isNonEmptyString(voice.name) ? { voiceName: voice.name } : {}),
    ...(isNonEmptyString(voice.primaryLanguage) ? { primaryLanguage: voice.primaryLanguage } : {}),
    ...(Array.isArray(voice.languages) ? { languages: voice.languages.filter(isNonEmptyString) } : {}),
  };
}

export function chooseDefaultModel(result) {
  if (result.recommendedModelId && result.compatibleModels.some((model) => model.modelId === result.recommendedModelId)) return result.recommendedModelId;
  return result.compatibleModels[0]?.modelId;
}

// Kept server-only. Other Fish bridge adapters may reuse the same local key
// policy, but callers must never return these values to a browser client.
export async function loadFishAudioApiKeys(projectRoot) {
  const keys = [];
  const environmentKey = process.env.FISHAUDIO_API_KEY?.trim();
  if (environmentKey) keys.push(environmentKey);
  try {
    const contents = await fs.readFile(path.join(projectRoot, '.secrets', 'fish_audio_api_keys.txt'), 'utf8');
    for (const rawLine of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      let value = rawLine.trim();
      if (!value || value.startsWith('#')) continue;
      if (/^fishaudio_api_key=/i.test(value)) value = value.split('=', 2)[1]?.trim() ?? '';
      if (/^bearer\s+/i.test(value)) value = value.replace(/^bearer\s+/i, '').trim();
      if (value) keys.push(value);
    }
  } catch (error) { if (error?.code !== 'ENOENT') throw new FishDiscoveryError('FISH_AUTH_UNAVAILABLE', '模型信息加载失败，请检查本地 Fish Audio 配置。', 503); }
  return [...new Set(keys)];
}

function responseError(status) {
  if (status === 404) return new FishDiscoveryError('VOICE_NOT_FOUND', '无法读取该 Voice，请检查 Voice ID 或访问权限。', 404);
  if (status === 400) return new FishDiscoveryError('FISH_INVALID_REQUEST', 'Fish Audio 请求无效，请检查 Voice ID。', 400);
  if (status === 401) return new FishDiscoveryError('FISH_AUTH_FAILED', '模型信息加载失败，请检查本地 Fish Audio 配置。', status);
  if (status === 402) return new FishDiscoveryError('FISH_QUOTA_EXHAUSTED', 'Fish Audio 额度不足，请检查本地账户配置。', status);
  if (status === 403) return new FishDiscoveryError('FISH_FORBIDDEN', '无法读取该 Voice，请检查访问权限。', status);
  if (status === 429) return new FishDiscoveryError('FISH_RATE_LIMIT', '模型信息加载过于频繁，请稍后重试。', status);
  if (status === 503) return new FishDiscoveryError('FISH_MODEL_UNAVAILABLE', '当前模型服务不可用，请稍后重试。', status);
  return new FishDiscoveryError('FISH_UPSTREAM_ERROR', '模型信息加载失败，请稍后重试。', status >= 500 ? 502 : status);
}

function normalizeControls(value) {
  const controls = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    speed: controls.speed === true, volume: controls.volume === true, pitch: controls.pitch === true,
    stability: controls.stability === true, similarity: controls.similarity === true, language: controls.language === true,
    textNormalization: controls.textNormalization === true, emotion: controls.emotion === true, instruction: controls.instruction === true,
  };
}
function firstNonEmptyString(...values) { return values.find(isNonEmptyString); }
function retryAfterMilliseconds(headers) {
  const raw = typeof headers?.get === 'function' ? headers.get('retry-after') : undefined;
  const seconds = raw && Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 250;
}
function defaultSleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function isNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
