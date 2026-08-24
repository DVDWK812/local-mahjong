import type { VoiceLine, VoicePackDetail } from './types';
import { isLegacyCacheCompatible, isV1CacheCompatible, isV2CacheCompatible } from './voiceFingerprint';
import { resolveEffectiveGenerationConfig } from './effectiveGenerationConfig';

export type VoiceGenerationStatus = 'generated' | 'changed' | 'not-generated' | 'missing-audio' | 'failed';
export type VoiceGenerationStatusByKey = Readonly<Record<string, VoiceGenerationStatus>>;

export function getVoiceLineGenerationStatus(detail: VoicePackDetail, line: VoiceLine): VoiceGenerationStatus {
  const availability = detail.voiceAvailability[line.key];
  if (availability?.status === 'missing-audio') return 'missing-audio';
  if (detail.failedKeys.includes(line.key)) return 'failed';
  const cached = detail.generationCache[line.key];
  if (!cached) return 'not-generated';
  const effective = resolveEffectiveGenerationConfig(line, detail.meta, detail.synthesis, detail.meta.ttsControls ? { controls: detail.meta.ttsControls } : undefined);
  return isV2CacheCompatible(cached, effective) || isV1CacheCompatible(cached, effective)
    || isLegacyCacheCompatible(cached, effective, detail.synthesis, detail.meta.locale) ? 'generated' : 'changed';
}

export function getVoicePackGenerationStatuses(detail: VoicePackDetail, lines: readonly VoiceLine[]): VoiceGenerationStatusByKey {
  return Object.fromEntries(lines.map((line) => [line.key, getVoiceLineGenerationStatus(detail, line)]));
}

export function generationStatusSummary(statuses: VoiceGenerationStatusByKey): Record<VoiceGenerationStatus, number> {
  const summary: Record<VoiceGenerationStatus, number> = { generated: 0, changed: 0, 'not-generated': 0, 'missing-audio': 0, failed: 0 };
  Object.values(statuses).forEach((status) => { summary[status] += 1; });
  return summary;
}
