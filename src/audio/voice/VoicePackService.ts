import type { VoicePackDetail, VoicePackSummary } from './types';
import type { VoiceGenerationOverride } from './VoiceGenerationService';

export interface CreateVoicePackInput { readonly displayName: string; readonly voiceId: string; readonly locale?: string; readonly modelId?: string; }
export interface CreateVoicePackResult { readonly pack: VoicePackSummary; readonly lineCount: number; }
export interface DeleteVoicePackResult { readonly deletedPackId: string; }
export interface VoicePackService { listPacks(): Promise<readonly VoicePackSummary[]>; createPack(input: CreateVoicePackInput): Promise<CreateVoicePackResult>; deletePack(packId: string): Promise<DeleteVoicePackResult>; getPack(packId: string): Promise<VoicePackDetail>; updateVoiceLines(packId: string, overrides: readonly VoiceGenerationOverride[]): Promise<VoicePackDetail>; }
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

function parseDetail(value: unknown): VoicePackDetail | undefined {
  if (!isRecord(value) || !isRecord(value.meta) || !isRecord(value.manifest) || !Array.isArray(value.voiceLines)
    || !isRecord(value.voiceAvailability) || !isRecord(value.generationCache) || !Array.isArray(value.failedKeys) || !isRecord(value.synthesis)) return undefined;
  const { meta, manifest, voiceLines, voiceAvailability, generationCache, failedKeys, synthesis } = value;
  if (typeof meta.id !== 'string' || typeof meta.name !== 'string' || typeof meta.locale !== 'string' || typeof meta.voiceId !== 'string' || typeof meta.modelId !== 'string'
    || typeof manifest.character !== 'string' || typeof manifest.voiceId !== 'string' || !isRecord(manifest.voices)
    || typeof synthesis.speed !== 'number' || typeof synthesis.format !== 'string') return undefined;
  return {
    meta: { id: meta.id, name: meta.name, locale: meta.locale, voiceId: meta.voiceId, modelId: meta.modelId },
    manifest: { character: manifest.character, voiceId: manifest.voiceId, voices: manifest.voices as VoicePackDetail['manifest']['voices'] },
    voiceLines: voiceLines as VoicePackDetail['voiceLines'], voiceAvailability: voiceAvailability as VoicePackDetail['voiceAvailability'],
    generationCache: generationCache as VoicePackDetail['generationCache'], failedKeys: failedKeys.filter((key): key is string => typeof key === 'string'),
    synthesis: { speed: synthesis.speed, format: synthesis.format },
  };
}

export const LOCAL_VOICE_PACK_SERVICE = new LocalVoicePackService();
