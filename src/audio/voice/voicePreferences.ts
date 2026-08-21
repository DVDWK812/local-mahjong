import type { VoicePackSummary } from './types';

/** Selects a bundled Pack only; stale localStorage values safely fall back. */
export function resolveSelectedVoicePackId(
  selectedVoicePackId: string | null,
  packs: readonly VoicePackSummary[],
): string | null {
  return selectedVoicePackId && packs.some((pack) => pack.id === selectedVoicePackId)
    ? selectedVoicePackId
    : packs[0]?.id ?? null;
}
