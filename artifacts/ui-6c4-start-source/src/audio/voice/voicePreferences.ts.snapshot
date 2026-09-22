import type { VoicePackSummary } from './types';

export const VOICE_SEAT_COUNT = 4;

/** Persisted explicit opt-out. `null` retains the legacy/default-Pack fallback. */
export const NO_VOICE_PACK_ID = '__no_voice__';

/** Persistent player-slot assignments. Slots are stable player positions, never winds. */
export type VoiceSeatAssignments = readonly [string | null, string | null, string | null, string | null];

export const DEFAULT_VOICE_SEAT_ASSIGNMENTS: VoiceSeatAssignments = Object.freeze([null, null, null, null]);

/** Selects a bundled Pack only; stale localStorage values safely fall back. */
export function resolveSelectedVoicePackId(
  selectedVoicePackId: string | null,
  packs: readonly VoicePackSummary[],
): string | null {
  return selectedVoicePackId && packs.some((pack) => pack.id === selectedVoicePackId)
    ? selectedVoicePackId
    : packs[0]?.id ?? null;
}

/** Runtime-safe Pack fallback. This deliberately ignores the management-page selection. */
export function resolveRuntimeFallbackVoicePackId(packs: readonly VoicePackSummary[]): string | null {
  return packs.find((pack) => pack.id === 'xiaozhang')?.id ?? packs[0]?.id ?? null;
}

/** Accepts old settings safely and always produces four stable player slots. */
export function normalizeVoiceSeatAssignments(value: unknown): VoiceSeatAssignments {
  const source = Array.isArray(value) ? value : [];
  const normalize = (candidate: unknown): string | null => typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
  return [normalize(source[0]), normalize(source[1]), normalize(source[2]), normalize(source[3])];
}

/** Removes deleted or otherwise unavailable Pack ids while preserving every slot. */
export function resolveVoiceSeatAssignments(
  assignments: VoiceSeatAssignments,
  packs: readonly VoicePackSummary[],
): VoiceSeatAssignments {
  const available = new Set(packs.map((pack) => pack.id));
  const keep = (packId: string | null): string | null => packId === NO_VOICE_PACK_ID || (packId && available.has(packId)) ? packId : null;
  return [keep(assignments[0]), keep(assignments[1]), keep(assignments[2]), keep(assignments[3])];
}

export interface VoiceActorSeatContext {
  /** Current game players in stable player-slot order; actorId is matched against these IDs. */
  readonly playerIds: readonly (string | number)[];
  readonly playerCount: number;
}

export function resolveSeatIndexForActor(actorId: string | undefined, context: VoiceActorSeatContext): number | undefined {
  if (!actorId) return undefined;
  const activeCount = Math.max(0, Math.min(VOICE_SEAT_COUNT, Math.trunc(context.playerCount)));
  const seat = context.playerIds.slice(0, activeCount).findIndex((playerId) => String(playerId) === actorId);
  return seat >= 0 ? seat : undefined;
}

/**
 * Resolves game audio through stable player slots only. Actorless table events belong
 * to active seat 0 (Player 1); the management-page selection is never consulted.
 */
export function resolveVoicePackForActor(
  actorId: string | undefined,
  context: VoiceActorSeatContext,
  assignments: VoiceSeatAssignments,
  packs: readonly VoicePackSummary[],
): string | null {
  const fallback = resolveRuntimeFallbackVoicePackId(packs);
  const activeCount = Math.max(0, Math.min(VOICE_SEAT_COUNT, Math.trunc(context.playerCount)));
  const seat = actorId === undefined ? (activeCount > 0 ? 0 : undefined) : resolveSeatIndexForActor(actorId, context);
  const assigned = seat === undefined ? null : assignments[seat];
  if (assigned === NO_VOICE_PACK_ID) return null;
  return assigned && packs.some((pack) => pack.id === assigned) ? assigned : fallback;
}
