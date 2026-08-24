export type GenerationPlanStatus = 'unchanged' | 'changed' | 'new' | 'missing' | 'invalid';
export interface GenerationPlanItem { readonly key: string; readonly line: string; readonly file: string; readonly status: GenerationPlanStatus; readonly reason: string; }
export interface GenerationPlan { readonly packId: string; readonly total: number; readonly unchanged: number; readonly changed: number; readonly new: number; readonly missing: number; readonly apiCalls: number; readonly items: readonly GenerationPlanItem[]; }
export interface GenerationResultItem { readonly key: string; readonly file: string; readonly status: string; readonly error: string | null; readonly warnings?: readonly string[]; }
export interface GenerationResultError { readonly code: string; readonly message: string; }
export interface GenerationResult { readonly success: boolean; readonly generated: number; readonly failed: number; readonly skipped: number; readonly items: readonly GenerationResultItem[]; readonly error?: GenerationResultError; }
export interface VoiceGenerationOverride {
  readonly key: string; readonly line?: string; readonly ttsText?: string;
  readonly speed?: number; readonly volume?: number; readonly stability?: number; readonly similarity?: number;
  readonly languageOverride?: string; readonly textNormalization?: boolean; readonly pitch?: number | null; readonly ttsEmotion?: string; readonly ttsInstruction?: string;
}
export interface VoiceGenerationService { previewGeneration(packId: string, keys?: readonly string[], overrides?: readonly VoiceGenerationOverride[]): Promise<GenerationPlan>; generate(packId: string, keys?: readonly string[], overrides?: readonly VoiceGenerationOverride[]): Promise<GenerationResult>; }

/** Browser client for the development-only generation bridge; it has no Fish/API-key access. */
export class LocalVoiceGenerationService implements VoiceGenerationService {
  async previewGeneration(packId: string, keys?: readonly string[], overrides?: readonly VoiceGenerationOverride[]): Promise<GenerationPlan> {
    return parsePlan((await requestGeneration(packId, 'generation-plan', keys, overrides)).plan);
  }
  async generate(packId: string, keys?: readonly string[], overrides?: readonly VoiceGenerationOverride[]): Promise<GenerationResult> {
    return parseResult((await requestGeneration(packId, 'generate', keys, overrides)).result);
  }
}

async function requestGeneration(packId: string, operation: 'generation-plan' | 'generate', keys?: readonly string[], overrides?: readonly VoiceGenerationOverride[]): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/voice-packs/${encodeURIComponent(packId)}/${operation}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ ...(keys ? { keys } : {}), ...(overrides?.length ? { overrides } : {}) }),
  });
  const value: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : '语音生成服务不可用。');
  return isRecord(value) ? value : {};
}

function parsePlan(value: unknown): GenerationPlan {
  if (!isRecord(value) || typeof value.packId !== 'string' || !Array.isArray(value.items)) throw new Error('语音生成计划返回无效数据。');
  const numeric = ['total', 'unchanged', 'changed', 'new', 'missing', 'apiCalls'] as const;
  if (numeric.some((key) => typeof value[key] !== 'number')) throw new Error('语音生成计划返回无效数据。');
  const items = value.items.filter(isRecord).flatMap((item): GenerationPlanItem[] => typeof item.key === 'string' && typeof item.line === 'string' && typeof item.file === 'string' && typeof item.status === 'string' && typeof item.reason === 'string'
    ? [{ key: item.key, line: item.line, file: item.file, status: item.status as GenerationPlanStatus, reason: item.reason }] : []);
  return { packId: value.packId, total: value.total as number, unchanged: value.unchanged as number, changed: value.changed as number, new: value.new as number, missing: value.missing as number, apiCalls: value.apiCalls as number, items };
}

function parseResult(value: unknown): GenerationResult {
  if (!isRecord(value) || typeof value.success !== 'boolean' || typeof value.generated !== 'number' || typeof value.failed !== 'number' || typeof value.skipped !== 'number' || !Array.isArray(value.items)) throw new Error('语音生成结果返回无效数据。');
  const items = value.items.filter(isRecord).flatMap((item): GenerationResultItem[] => typeof item.key === 'string' && typeof item.file === 'string' && typeof item.status === 'string'
    ? [{ key: item.key, file: item.file, status: item.status, error: typeof item.error === 'string' ? item.error : null, ...(Array.isArray(item.warnings) ? { warnings: item.warnings.filter((warning): warning is string => typeof warning === 'string') } : {}) }] : []);
  const error = isRecord(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string'
    ? { code: value.error.code, message: value.error.message } : undefined;
  return { success: value.success, generated: value.generated, failed: value.failed, skipped: value.skipped, items, ...(error ? { error } : {}) };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

export const LOCAL_VOICE_GENERATION_SERVICE = new LocalVoiceGenerationService();
