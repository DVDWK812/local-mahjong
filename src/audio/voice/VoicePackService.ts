import type { VoiceModelControls, VoicePackDetail, VoicePackSummary } from './types';
import type { VoiceGenerationOverride } from './VoiceGenerationService';

export interface CreateVoicePackInput { readonly displayName: string; readonly voiceId: string; readonly locale?: string; readonly modelId?: string; readonly ttsControls?: Partial<VoiceModelControls>; }
export interface CreateVoicePackResult { readonly pack: VoicePackSummary; readonly lineCount: number; }
export interface DeleteVoicePackResult { readonly deletedPackId: string; }
export type { VoiceModelControls } from './types';
export interface VoiceModelCapability { readonly modelId: string; readonly displayName: string; readonly available: boolean; readonly controls: VoiceModelControls; }
export interface VoiceModelDiscoveryResult { readonly voiceId: string; readonly voiceCompatibleModelIds: readonly string[]; readonly availableModels: readonly VoiceModelCapability[]; readonly compatibleModels: readonly VoiceModelCapability[]; readonly recommendedModelId?: string; readonly voiceName?: string; readonly primaryLanguage?: string; readonly languages?: readonly string[]; }
export interface VoicePackService { listPacks(): Promise<readonly VoicePackSummary[]>; discoverVoiceModels(voiceId: string): Promise<VoiceModelDiscoveryResult>; createPack(input: CreateVoicePackInput): Promise<CreateVoicePackResult>; deletePack(packId: string): Promise<DeleteVoicePackResult>; getPack(packId: string): Promise<VoicePackDetail>; updateVoiceLines(packId: string, overrides: readonly VoiceGenerationOverride[]): Promise<VoicePackDetail>; }
export type VoicePackServiceAvailability = 'available' | 'unavailable';

/** Development bridge capability check; it only reads the Pack index. */
export async function checkVoicePackService(service: Pick<VoicePackService, 'listPacks'>): Promise<VoicePackServiceAvailability> {
  try { await service.listPacks(); return 'available'; } catch { return 'unavailable'; }
}

/** Browser client for the development-only Local Voice Bridge. It has no filesystem or secret access. */
export class LocalVoicePackService implements VoicePackService {
  async listPacks(): Promise<readonly VoicePackSummary[]> {
    const value = await requestJson('/api/voice-packs');
    return Array.isArray(value.packs) ? value.packs as VoicePackSummary[] : [];
  }
  async discoverVoiceModels(voiceId: string): Promise<VoiceModelDiscoveryResult> {
    const value = await requestJson(`/api/voice-models?voiceId=${encodeURIComponent(voiceId)}`);
    const discovery = parseDiscovery(value.discovery);
    if (!discovery) throw new Error('模型发现服务返回无效数据。');
    return discovery;
  }
  async createPack(input: CreateVoicePackInput): Promise<CreateVoicePackResult> {
    const value = await requestJson('/api/voice-packs', { method: 'POST', body: JSON.stringify(input) });
    const pack = parseSummary(value.pack); const lineCount = value.lineCount;
    if (!pack || typeof lineCount !== 'number') throw new Error('角色语音服务返回无效数据。');
    return { pack, lineCount };
  }
  async deletePack(packId: string): Promise<DeleteVoicePackResult> {
    const value = await requestJson(`/api/voice-packs/${encodeURIComponent(packId)}`, { method: 'DELETE' });
    if (typeof value.deletedPackId !== 'string') throw new Error('角色语音服务返回无效数据。');
    return { deletedPackId: value.deletedPackId };
  }
  async getPack(packId: string): Promise<VoicePackDetail> {
    const value = await requestJson(`/api/voice-packs/${encodeURIComponent(packId)}`);
    const detail = parseDetail(value.pack); if (!detail) throw new Error('角色语音服务返回无效数据。'); return detail;
  }
  async updateVoiceLines(packId: string, overrides: readonly VoiceGenerationOverride[]): Promise<VoicePackDetail> {
    const value = await requestJson(`/api/voice-packs/${encodeURIComponent(packId)}/voice-lines`, { method: 'POST', body: JSON.stringify({ overrides }) });
    const detail = parseDetail(value.pack); if (!detail) throw new Error('角色语音服务返回无效数据。'); return detail;
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init?.headers ?? {}) } });
  const value: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : '角色语音服务暂不可用。');
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function parseSummary(value: unknown): VoicePackSummary | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.locale !== 'string' || typeof value.path !== 'string') return undefined;
  return { id: value.id, name: value.name, locale: value.locale, path: value.path };
}

function parseDiscovery(value: unknown): VoiceModelDiscoveryResult | undefined {
  if (!isRecord(value) || typeof value.voiceId !== 'string' || !Array.isArray(value.voiceCompatibleModelIds)
    || !Array.isArray(value.availableModels) || !Array.isArray(value.compatibleModels)) return undefined;
  const availableModels = value.availableModels.map(parseCapability).filter((model): model is VoiceModelCapability => Boolean(model));
  const compatibleModels = value.compatibleModels.map(parseCapability).filter((model): model is VoiceModelCapability => Boolean(model));
  if (availableModels.length !== value.availableModels.length || compatibleModels.length !== value.compatibleModels.length) return undefined;
  if (!value.voiceCompatibleModelIds.every((modelId) => typeof modelId === 'string')) return undefined;
  if (value.recommendedModelId !== undefined && typeof value.recommendedModelId !== 'string') return undefined;
  if (value.voiceName !== undefined && typeof value.voiceName !== 'string') return undefined;
  if (value.primaryLanguage !== undefined && typeof value.primaryLanguage !== 'string') return undefined;
  if (value.languages !== undefined && (!Array.isArray(value.languages) || !value.languages.every((language) => typeof language === 'string'))) return undefined;
  return { voiceId: value.voiceId, voiceCompatibleModelIds: value.voiceCompatibleModelIds as string[], availableModels, compatibleModels,
    ...(typeof value.recommendedModelId === 'string' ? { recommendedModelId: value.recommendedModelId } : {}),
    ...(typeof value.voiceName === 'string' ? { voiceName: value.voiceName } : {}),
    ...(typeof value.primaryLanguage === 'string' ? { primaryLanguage: value.primaryLanguage } : {}),
    ...(Array.isArray(value.languages) ? { languages: value.languages as string[] } : {}) };
}

function parseCapability(value: unknown): VoiceModelCapability | undefined {
  if (!isRecord(value) || typeof value.modelId !== 'string' || typeof value.displayName !== 'string' || typeof value.available !== 'boolean' || !isRecord(value.controls)) return undefined;
  const controls = value.controls;
  const names = ['speed', 'volume', 'pitch', 'stability', 'similarity', 'language', 'textNormalization', 'emotion', 'instruction'] as const;
  if (!names.every((name) => typeof controls[name] === 'boolean')) return undefined;
  return { modelId: value.modelId, displayName: value.displayName, available: value.available,
    controls: {
      speed: controls.speed as boolean, volume: controls.volume as boolean, pitch: controls.pitch as boolean,
      stability: controls.stability as boolean, similarity: controls.similarity as boolean, language: controls.language as boolean,
      textNormalization: controls.textNormalization as boolean, emotion: controls.emotion as boolean, instruction: controls.instruction as boolean,
    } };
}

function parseDetail(value: unknown): VoicePackDetail | undefined {
  if (!isRecord(value) || !isRecord(value.meta) || !isRecord(value.manifest) || !Array.isArray(value.voiceLines)
    || !isRecord(value.voiceAvailability) || !isRecord(value.generationCache) || !Array.isArray(value.failedKeys) || !isRecord(value.synthesis)) return undefined;
  const { meta, manifest, voiceLines, voiceAvailability, generationCache, failedKeys, synthesis } = value;
  if (typeof meta.id !== 'string' || typeof meta.name !== 'string' || typeof meta.locale !== 'string' || typeof meta.voiceId !== 'string' || typeof meta.modelId !== 'string'
    || typeof manifest.character !== 'string' || typeof manifest.voiceId !== 'string' || !isRecord(manifest.voices)
    || typeof synthesis.speed !== 'number' || typeof synthesis.format !== 'string') return undefined;
  const names = ['speed', 'volume', 'pitch', 'stability', 'similarity', 'language', 'textNormalization', 'emotion', 'instruction'] as const;
  const rawControls = isRecord(meta.ttsControls) ? meta.ttsControls : undefined;
  // A partial old snapshot is not authoritative. Treat it as absent so the
  // browser matches Python's legacy behaviour instead of hiding controls.
  const ttsControls = rawControls && names.every((name) => typeof rawControls[name] === 'boolean')
    ? Object.fromEntries(names.map((name) => [name, rawControls[name] as boolean])) as unknown as VoiceModelControls
    : undefined;
  return {
    meta: { id: meta.id, name: meta.name, locale: meta.locale, voiceId: meta.voiceId, modelId: meta.modelId, ...(ttsControls ? { ttsControls } : {}) },
    manifest: { character: manifest.character, voiceId: manifest.voiceId, voices: manifest.voices as VoicePackDetail['manifest']['voices'] },
    voiceLines: voiceLines as VoicePackDetail['voiceLines'], voiceAvailability: voiceAvailability as VoicePackDetail['voiceAvailability'],
    generationCache: generationCache as VoicePackDetail['generationCache'], failedKeys: failedKeys.filter((key): key is string => typeof key === 'string'),
    synthesis: { speed: synthesis.speed, format: synthesis.format },
  };
}

export const LOCAL_VOICE_PACK_SERVICE = new LocalVoicePackService();
