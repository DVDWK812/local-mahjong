import type { VoiceLine, VoicePackDetail } from './types';
import { effectiveTtsText, voiceFingerprint } from './voiceFingerprint';

export type VoiceGenerationStatus = 'generated' | 'changed' | 'not-generated' | 'missing-audio' | 'failed';
export type VoiceGenerationStatusByKey = Readonly<Record<string, VoiceGenerationStatus>>;

export function getVoiceLineGenerationStatus(detail: VoicePackDetail, line: VoiceLine): VoiceGenerationStatus {
  const availability = detail.voiceAvailability[line.key];
  if (availability?.status === 'missing-audio') return 'missing-audio';
  if (detail.failedKeys.includes(line.key)) return 'failed';
  const cached = detail.generationCache[line.key];
  if (!cached) return 'not-generated';
  const fingerprint = voiceFingerprint(detail.meta, detail.synthesis, effectiveTtsText(line));
  return cached.fingerprint === fingerprint ? 'generated' : 'changed';
}

export function getVoicePackGenerationStatuses(detail: VoicePackDetail, lines: readonly VoiceLine[]): VoiceGenerationStatusByKey {
  return Object.fromEntries(lines.map((line) => [line.key, getVoiceLineGenerationStatus(detail, line)]));
}

export function generationStatusSummary(statuses: VoiceGenerationStatusByKey): Record<VoiceGenerationStatus, number> {
  const summary: Record<VoiceGenerationStatus, number> = { generated: 0, changed: 0, 'not-generated': 0, 'missing-audio': 0, failed: 0 };
  Object.values(statuses).forEach((status) => { summary[status] += 1; });
  return summary;
}
