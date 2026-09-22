import type { PlayerId } from '../../game/types';
import type { MatchResultPresentationEvent } from '../../presentation/PresentationEventBus';

export interface MatchVoiceSequenceItem {
  readonly voiceKey: 'game.end' | 'result.second_place' | 'result.third_place' | 'result.fourth_place';
  readonly actorId: PlayerId;
}

export interface MatchResultSequence {
  readonly id: string;
  readonly items: readonly MatchVoiceSequenceItem[];
}

const RANK_VOICE_KEYS = {
  1: 'game.end',
  2: 'result.second_place',
  3: 'result.third_place',
  4: 'result.fourth_place',
} as const;

/**
 * Ranks come from MatchState.finalResult. We filter inactive seats but never derive
 * or break ties from point totals here.
 */
export function buildMatchResultSequence(event: MatchResultPresentationEvent): MatchResultSequence {
  const activePlayers = new Set(event.activePlayerIds);
  const items = event.finalResult.players
    .filter((player) => activePlayers.has(player.player))
    .sort((left, right) => left.rank - right.rank || left.rankTieBreakOrder - right.rankTieBreakOrder)
    .flatMap((player) => {
      const voiceKey = RANK_VOICE_KEYS[player.rank];
      return voiceKey ? [{ voiceKey, actorId: player.player }] : [];
    });
  return { id: event.eventId, items };
}
